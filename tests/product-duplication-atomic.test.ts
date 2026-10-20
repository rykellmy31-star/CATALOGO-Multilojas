import { afterEach, describe, expect, it } from 'vitest';
import { fixture } from './helpers';

let f: ReturnType<typeof fixture> | undefined;
afterEach(() => { f?.db.close(); f = undefined; });

const duplicate = (productId = 'pa') => f!.request(`/api/store/products/${productId}/duplicate`, 'POST');

describe('Duplicação transacional de produtos multiempresa', () => {
  it('duplica somente produtos da loja autenticada', async () => {
    f = fixture();
    expect((await duplicate('pb')).status).toBe(404);
    expect((f.db.prepare("SELECT COUNT(*) AS n FROM products").get() as any).n).toBe(2);
    const created = await duplicate('pa');
    expect(created.status).toBe(201);
    const response = await created.json() as any;
    expect(response.product.store_id).toBe('a');
    expect(response.product.status).toBe('draft');
  });

  it('preserva campos administrativos e cria SKU e slug únicos', async () => {
    f = fixture();
    f.db.prepare("UPDATE products SET sku = 'SKU-A', cost_price = 18.5, seo_title = 'SEO', weight = 1.25 WHERE id = 'pa'").run();
    const r1 = await (await duplicate()).json() as any;
    const r2 = await (await duplicate()).json() as any;
    expect(r1.product.id).not.toBe(r2.product.id);
    expect(r1.product.slug).not.toBe(r2.product.slug);
    expect(r1.product.sku).not.toBe(r2.product.sku);
    expect(r1.product.sku).not.toBe('SKU-A');
    expect(r1.product.cost_price).toBe(18.5);
    expect(r1.product.seo_title).toBe('SEO');
    expect(r1.product.weight).toBe(1.25);
  });

  it('copia imagens e metadados sem herdar vínculo com imagem antiga', async () => {
    f = fixture();
    f.db.prepare(`INSERT INTO product_images
      (id, product_id, store_id, url, is_primary, alt_text, file_size_kb, width, height)
      VALUES ('img-orig', 'pa', 'a', '/api/storage/foto.jpg', 1, 'Capa', 50, 800, 600)`).run();
    const response = await (await duplicate()).json() as any;
    const images = f.db.prepare('SELECT * FROM product_images WHERE product_id = ?').all(response.product.id) as any[];
    expect(images).toHaveLength(1);
    expect(images[0]).toMatchObject({
      store_id: 'a', url: '/api/storage/foto.jpg', is_primary: 1,
      alt_text: 'Capa', file_size_kb: 50, width: 800, height: 600,
      original_image_id: null
    });
    expect(images[0].id).not.toBe('img-orig');
  });

  it('falha nas imagens reverte o novo produto e mantém o original', async () => {
    f = fixture();
    f.db.prepare("INSERT INTO product_images (id, product_id, store_id, url) VALUES ('orig', 'pa', 'a', 'foto.jpg')").run();
    f.db.exec(`CREATE TRIGGER fail_copied_image BEFORE INSERT ON product_images
      WHEN NEW.product_id != 'pa' BEGIN SELECT RAISE(ABORT, 'falha simulada'); END`);
    const res = await duplicate();
    expect(res.status).toBe(500);
    expect((f.db.prepare("SELECT COUNT(*) AS n FROM products WHERE store_id = 'a'").get() as any).n).toBe(1);
    expect((f.db.prepare('SELECT COUNT(*) AS n FROM product_images').get() as any).n).toBe(1);
  });

  it('produto sem SKU permanece sem SKU na cópia', async () => {
    f = fixture();
    const r = await duplicate();
    expect(r.status).toBe(201);
    expect(((await r.json()) as any).product.sku).toBeNull();
  });
});
