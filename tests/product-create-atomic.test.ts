import { describe, expect, it, afterEach } from 'vitest';
import { fixture } from './helpers';

let f: ReturnType<typeof fixture> | undefined;
afterEach(() => { f?.db.close(); f = undefined; });
const images = ['https://example.com/a.jpg', 'https://example.com/b.jpg'];
const create = (data: Record<string, unknown>) => f!.request('/api/store/products', 'POST', data);
function count(table: 'products' | 'product_images') {
  return (f!.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
}

describe('Cadastro atômico multiempresa', () => {
  it('grava produto e duas imagens na ordem definida', async () => {
    f = fixture();
    const response = await create({ name: 'Novo móvel', price: 150, images });
    expect(response.status).toBe(201);
    const { product } = await response.json() as any;
    expect(product.store_id).toBe('a');
    const rows = f.db.prepare(
      'SELECT url, is_primary, sort_order FROM product_images WHERE product_id = ? ORDER BY sort_order'
    ).all(product.id);
    expect(rows).toEqual([
      { url: images[0], is_primary: 1, sort_order: 0 },
      { url: images[1], is_primary: 0, sort_order: 1 }
    ]);
  });

  it('reverte todas as gravações quando a segunda imagem falha', async () => {
    f = fixture();
    const before = count('products');
    f.db.exec(`CREATE TRIGGER fail_image BEFORE INSERT ON product_images WHEN NEW.url = 'https://example.com/b.jpg'
      BEGIN SELECT RAISE(ABORT, 'falha de teste'); END`);
    expect((await create({ name: 'Produto rejeitado', price: 150, images })).status).toBe(500);
    expect(count('products')).toBe(before);
    expect(count('product_images')).toBe(0);
  });

  it('URLs repetidas no cadastro geram uma única foto por endereço', async () => {
    f = fixture();
    const result = await create({
      name: 'Móvel com fotos duplicadas', price: 199,
      images: [images[0], images[0], images[1], images[1]]
    });
    expect(result.status).toBe(201);
    const { product } = await result.json() as any;
    const rows = f.db.prepare(
      'SELECT url, is_primary, sort_order FROM product_images WHERE product_id = ? ORDER BY sort_order'
    ).all(product.id);
    expect(rows).toEqual([
      { url: images[0], is_primary: 1, sort_order: 0 },
      { url: images[1], is_primary: 0, sort_order: 1 }
    ]);
  });

  it('conflitos de nome geram slugs distintos sem misturar imagens', async () => {
    f = fixture();
    const first = await create({ name: 'Mesmo nome', price: 10, images });
    const second = await create({ name: 'Mesmo nome', price: 10, images });
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    const a = (await first.json() as any).product;
    const b = (await second.json() as any).product;
    expect(a.slug).not.toBe(b.slug);
    expect((f.db.prepare('SELECT COUNT(*) AS n FROM product_images WHERE product_id = ?').get(a.id) as any).n).toBe(2);
    expect((f.db.prepare('SELECT COUNT(*) AS n FROM product_images WHERE product_id = ?').get(b.id) as any).n).toBe(2);
  });

  it('SKU duplicado não deixa produto ou imagem órfão', async () => {
    f = fixture();
    f.db.prepare("UPDATE products SET sku = 'REPETIDO' WHERE id = 'pa'").run();
    const before = count('products');
    const result = await create({ name: 'Produto com SKU existente', price: 15, sku: 'REPETIDO', images });
    expect(result.status).toBe(409);
    expect(count('products')).toBe(before);
    expect(count('product_images')).toBe(0);
  });

  it('aceita SKU igual ao de outra loja, mantendo isolamento', async () => {
    f = fixture();
    f.db.prepare("UPDATE products SET sku = 'LOJA-B' WHERE id = 'pb'").run();
    const result = await create({ name: 'SKU repetido só fora da loja', price: 15, sku: 'LOJA-B' });
    expect(result.status).toBe(201);
    const { product } = await result.json() as any;
    expect(product.store_id).toBe('a');
    expect((f.db.prepare("SELECT sku FROM products WHERE id = 'pb'").get() as any).sku).toBe('LOJA-B');
  });

  it('duas requisições simultâneas com mesmo SKU não criam duplicatas', async () => {
    f = fixture();
    const [a, b] = await Promise.all([
      create({ name: 'Primeiro lote', price: 15, sku: 'SKU-CONCORRENTE', images }),
      create({ name: 'Segundo lote', price: 15, sku: 'SKU-CONCORRENTE', images })
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect((f.db.prepare("SELECT COUNT(*) AS n FROM products WHERE store_id = 'a' AND sku = 'SKU-CONCORRENTE'").get() as any).n).toBe(1);
    expect((f.db.prepare("SELECT COUNT(*) AS n FROM product_images WHERE store_id = 'a'").get() as any).n).toBe(2);
  });

  it('identifica como IA a imagem gerada antes do cadastro na própria loja', async () => {
    f = fixture();
    const url = '/api/storage/' + encodeURIComponent('stores/a/products/general/generated.png');
    f.db.prepare(`
      INSERT INTO ai_generations
        (id, store_id, user_id, type, status, generated_image_url, ai_style)
      VALUES ('gen-a', 'a', 'ua', 'image', 'completed', ?, 'premium_catalog')
    `).run(url);
    const response = await create({ name: 'Produto com IA', price: 250, images: [url] });
    expect(response.status).toBe(201);
    const product = (await response.json() as any).product;
    const images = f.db.prepare(
      'SELECT url, is_ai_generated, ai_style, store_id FROM product_images WHERE product_id = ?'
    ).all(product.id);
    expect(images).toEqual([{
      url, store_id: 'a', is_ai_generated: 1, ai_style: 'premium_catalog'
    }]);
  });

  it('não marca imagem de geração pendente como IA', async () => {
    f = fixture();
    const url = 'https://example.com/pending.png';
    f.db.prepare(`
      INSERT INTO ai_generations
        (id, store_id, user_id, type, status, generated_image_url, ai_style)
      VALUES ('gen-pending', 'a', 'ua', 'image', 'processing', ?, 'modern_room')
    `).run(url);
    const response = await create({ name: 'Imagem pendente', price: 250, images: [url] });
    expect(response.status).toBe(201);
    const product = (await response.json() as any).product;
    const image = f.db.prepare(
      'SELECT is_ai_generated, ai_style FROM product_images WHERE product_id = ?'
    ).get(product.id);
    expect(image).toMatchObject({ is_ai_generated: 0, ai_style: null });
  });

  it('não confunde geração de outra loja com imagem IA própria', async () => {
    f = fixture();
    const url = 'https://example.com/other-store.png';
    f.db.prepare(`
      INSERT INTO ai_generations
        (id, store_id, user_id, type, status, generated_image_url, ai_style)
      VALUES ('gen-b', 'b', 'ub', 'image', 'completed', ?, 'white_background')
    `).run(url);
    const response = await create({ name: 'Imagem externa', price: 250, images: [url] });
    expect(response.status).toBe(201);
    const product = (await response.json() as any).product;
    const image = f.db.prepare(
      'SELECT is_ai_generated, ai_style, store_id FROM product_images WHERE product_id = ?'
    ).get(product.id);
    expect(image).toMatchObject({ store_id: 'a', is_ai_generated: 0, ai_style: null });
  });

  it('rejeita nome sem slug possível, sem gravar produto ou imagem', async () => {
    f = fixture();
    const before = count('products');
    const result = await create({ name: '🚀🚀', price: 15, images });
    expect(result.status).toBe(400);
    expect(count('products')).toBe(before);
    expect(count('product_images')).toBe(0);
  });

  it('rejeita slug explícito vazio após normalização', async () => {
    f = fixture();
    const before = count('products');
    const result = await create({ name: 'Produto válido', slug: '🚀🚀', price: 15 });
    expect(result.status).toBe(400);
    expect(count('products')).toBe(before);
  });

  it('permite produto sem imagem', async () => {
    f = fixture();
    const response = await create({ name: 'Sem imagem', price: 0 });
    expect(response.status).toBe(201);
    expect(count('product_images')).toBe(0);
  });
});
