import { describe, expect, it, afterEach } from 'vitest';
import { fixture } from './helpers';

let f: ReturnType<typeof fixture> | undefined;
afterEach(() => { f?.db.close(); f = undefined; });

const ai = 'https://example.com/ia.jpg';
const normal = 'https://example.com/original.jpg';
const update = (body: Record<string, unknown>, id = 'pa') =>
  f!.request(`/api/store/products/${id}`, 'PUT', body);
function seed() {
  f = fixture();
  f.db.prepare(
    'INSERT INTO product_images (id, product_id, store_id, url, is_primary, is_ai_generated, ai_style, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run('ai-a', 'pa', 'a', ai, 1, 1, 'modern_room', 0);
  f.db.prepare(
    'INSERT INTO product_images (id, product_id, store_id, url, is_primary, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
  ).run('normal-a', 'pa', 'a', normal, 0, 1);
  f.db.prepare(
    'INSERT INTO product_images (id, product_id, store_id, url, is_primary, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
  ).run('foreign-b', 'pb', 'b', 'https://example.com/foreign.jpg', 1, 0);
}
function ownImages() {
  return f!.db.prepare('SELECT id, url, is_primary, is_ai_generated, ai_style, sort_order FROM product_images WHERE product_id = ? ORDER BY sort_order')
    .all('pa') as any[];
}

describe('Edição transacional de produtos e imagens', () => {
  it('preserva IDs e metadados da IA quando a foto continua selecionada', async () => {
    seed();
    expect((await update({ images: [ai, normal] })).status).toBe(200);
    expect(ownImages().map(p => p.id)).toEqual(['ai-a', 'normal-a']);
    expect(ownImages()[0]).toMatchObject({ is_ai_generated: 1, ai_style: 'modern_room', is_primary: 1 });
  });
  it('remove foto de IA quando ela é retirada da lista', async () => {
    seed();
    expect((await update({ images: [normal] })).status).toBe(200);
    expect(ownImages().map(p => p.id)).toEqual(['normal-a']);
    expect(ownImages()[0].is_primary).toBe(1);
  });
  it('lista vazia apaga todas as imagens da loja correta', async () => {
    seed();
    expect((await update({ images: [] })).status).toBe(200);
    expect(ownImages()).toHaveLength(0);
    expect((f!.db.prepare('SELECT COUNT(*) AS n FROM product_images WHERE id = ?').get('foreign-b') as any).n).toBe(1);
  });
  it('omitir imagens não afeta arquivos existentes', async () => {
    seed();
    expect((await update({ price: 71 })).status).toBe(200);
    expect(ownImages()).toHaveLength(2);
    expect((f!.db.prepare("SELECT price FROM products WHERE id = 'pa'").get() as any).price).toBe(71);
  });
  it('rollback de erro em imagem restaura preço e fotos', async () => {
    seed();
    f!.db.exec(`CREATE TRIGGER reject_image_update BEFORE INSERT ON product_images
      WHEN NEW.url = 'https://example.com/erro.jpg'
      BEGIN SELECT RAISE(ABORT, 'falha da imagem'); END`);
    expect((await update({ price: 71, images: [normal, 'https://example.com/erro.jpg'] })).status).toBe(500);
    expect((f!.db.prepare("SELECT price FROM products WHERE id = 'pa'").get() as any).price).toBe(50);
    expect(ownImages().map(p => p.id)).toEqual(['ai-a', 'normal-a']);
  });
  it('não permite atualizar produto de outra loja', async () => {
    seed();
    expect((await update({ images: [normal] }, 'pb')).status).toBe(404);
    expect((f!.db.prepare('SELECT COUNT(*) AS n FROM product_images WHERE store_id = ?').get('b') as any).n).toBe(1);
  });
  it('retorna 409 para SKU usado por outro produto da mesma loja', async () => {
    seed();
    f!.db.prepare("INSERT INTO products (id,store_id,name,slug,sku,price) VALUES ('p2','a','Segundo','segundo','SKU-OCUPADO',25)").run();
    const original = ownImages();
    const response = await update({ sku: 'SKU-OCUPADO', images: [normal] });
    expect(response.status).toBe(409);
    expect((await response.json() as any).error).toMatch(/SKU/);
    expect(ownImages()).toEqual(original);
  });

  it('retorna 409 para slug de outro produto sem apagar imagens', async () => {
    seed();
    f!.db.prepare("INSERT INTO products (id,store_id,name,slug,price) VALUES ('p2','a','Segundo','slug-ocupado',25)").run();
    const original = ownImages();
    const response = await update({ slug: 'slug-ocupado', images: [normal] });
    expect(response.status).toBe(409);
    expect(ownImages()).toEqual(original);
  });

  it('permite SKU igual ao de outra loja, sem alterar a outra', async () => {
    seed();
    f!.db.prepare("UPDATE products SET sku = 'SKU-B' WHERE id = 'pb'").run();
    const response = await update({ sku: 'SKU-B' });
    expect(response.status).toBe(200);
    expect((f!.db.prepare("SELECT sku FROM products WHERE id = 'pa'").get() as any).sku).toBe('SKU-B');
    expect((f!.db.prepare("SELECT sku FROM products WHERE id = 'pb'").get() as any).sku).toBe('SKU-B');
  });

  it('rejeita slug explícito inválido preservando preço e fotos', async () => {
    seed();
    const original = ownImages();
    const response = await update({ slug: '🚀🚀', price: 10, images: [normal] });
    expect(response.status).toBe(400);
    expect(ownImages()).toEqual(original);
    expect((f!.db.prepare("SELECT price FROM products WHERE id = 'pa'").get() as any).price).toBe(50);
  });

  it('rejeita mudança de nome que produziria slug vazio', async () => {
    seed();
    const original = ownImages();
    const response = await update({ name: '🚀🚀', price: 10 });
    expect(response.status).toBe(400);
    expect(ownImages()).toEqual(original);
    expect((f!.db.prepare("SELECT name FROM products WHERE id = 'pa'").get() as any).name).toBe('Produto A');
  });

  it('reconhece imagem IA adicionada durante edição sem o cliente enviar flags', async () => {
    seed();
    const generated = '/api/storage/' +
      encodeURIComponent('stores/a/products/general/generated.png');
    f!.db.prepare(`
      INSERT INTO ai_generations
        (id, store_id, user_id, type, status, generated_image_url, ai_style)
      VALUES ('generation-own', 'a', 'ua', 'image', 'completed', ?, 'premium_catalog')
    `).run(generated);
    const response = await update({ images: [ai, generated] });
    expect(response.status).toBe(200);
    const result = f!.db.prepare(
      'SELECT is_ai_generated, ai_style, is_primary, sort_order FROM product_images WHERE product_id = ? AND url = ?'
    ).get('pa', generated);
    expect(result).toMatchObject({
      is_ai_generated: 1, ai_style: 'premium_catalog',
      is_primary: 0, sort_order: 1
    });
  });

  it('não classifica imagem de geração de outra loja como IA própria', async () => {
    seed();
    const url = 'https://example.com/catalogo-antigo.png';
    f!.db.prepare(`
      INSERT INTO ai_generations
        (id, store_id, user_id, type, status, generated_image_url, ai_style)
      VALUES ('generation-other', 'b', 'ub', 'image', 'completed', ?, 'promotional')
    `).run(url);
    const response = await update({ images: [url] });
    expect(response.status).toBe(200);
    const result = f!.db.prepare(
      'SELECT is_ai_generated, ai_style FROM product_images WHERE product_id = ? AND url = ?'
    ).get('pa', url);
    expect(result).toMatchObject({ is_ai_generated: 0, ai_style: null });
  });

  it('não reutiliza classificação IA vinculada a outro produto da mesma loja', async () => {
    seed();
    const generated = 'https://example.com/ia-so-do-segundo-produto.png';
    f!.db.prepare(`
      INSERT INTO products (id, store_id, name, slug, price)
      VALUES ('pc', 'a', 'Outro produto', 'outro-produto', 150)
    `).run();
    f!.db.prepare(`
      INSERT INTO ai_generations
        (id, store_id, user_id, product_id, type, status, generated_image_url, ai_style)
      VALUES ('gen-for-pc', 'a', 'ua', 'pc', 'image', 'completed', ?, 'modern_room')
    `).run(generated);
    const response = await update({ images: [generated] });
    expect(response.status).toBe(200);
    expect(f!.db.prepare(
      'SELECT is_ai_generated, ai_style FROM product_images WHERE product_id = ? AND url = ?'
    ).get('pa', generated)).toMatchObject({ is_ai_generated: 0, ai_style: null });
  });

  it('leitura de fotos ignora linha com store_id incompatível com a loja do produto', async () => {
    seed();
    // Referência legada/corrompida: product_id pertence a A, mas imagem marcada B.
    f!.db.prepare(`
      INSERT INTO product_images (id, product_id, store_id, url)
      VALUES ('wrong-tenant-image', 'pa', 'b', 'https://example.com/private-b.png')
    `).run();
    const response = await f!.request('/api/store/products/pa', 'GET');
    expect(response.status).toBe(200);
    const { images } = await response.json() as any;
    expect(images.map((x: any) => x.id)).not.toContain('wrong-tenant-image');
    expect(images.every((x: any) => x.store_id === 'a')).toBe(true);
  });

  it('não classifica uma geração pendente como foto IA aprovada na edição', async () => {
    seed();
    const url = 'https://example.com/geracao-pendente.png';
    f!.db.prepare(`
      INSERT INTO ai_generations
        (id, store_id, user_id, type, status, generated_image_url, ai_style)
      VALUES ('generation-pending', 'a', 'ua', 'image', 'processing', ?, 'modern_room')
    `).run(url);
    const response = await update({ images: [url] });
    expect(response.status).toBe(200);
    const result = f!.db.prepare(
      'SELECT is_ai_generated, ai_style FROM product_images WHERE product_id = ? AND url = ?'
    ).get('pa', url);
    expect(result).toMatchObject({ is_ai_generated: 0, ai_style: null });
  });

  it('repetir URL na edição não gera duas linhas da mesma foto', async () => {
    seed();
    const response = await update({ images: [normal, normal, ai, ai] });
    expect(response.status).toBe(200);
    expect(ownImages().map(image => image.url)).toEqual([normal, ai]);
    expect(ownImages().map(image => image.is_primary)).toEqual([1, 0]);
  });

  it('reordena imagens existentes sem perder os IDs', async () => {
    seed();
    expect((await update({ images: [normal, ai] })).status).toBe(200);
    expect(ownImages().map(p => p.id)).toEqual(['normal-a', 'ai-a']);
    expect(ownImages().map(p => p.is_primary)).toEqual([1, 0]);
  });
});
