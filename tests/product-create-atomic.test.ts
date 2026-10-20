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

  it('permite produto sem imagem', async () => {
    f = fixture();
    const response = await create({ name: 'Sem imagem', price: 0 });
    expect(response.status).toBe(201);
    expect(count('product_images')).toBe(0);
  });
});
