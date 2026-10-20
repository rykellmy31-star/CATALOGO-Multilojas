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
  it('reordena imagens existentes sem perder os IDs', async () => {
    seed();
    expect((await update({ images: [normal, ai] })).status).toBe(200);
    expect(ownImages().map(p => p.id)).toEqual(['normal-a', 'ai-a']);
    expect(ownImages().map(p => p.is_primary)).toEqual([1, 0]);
  });
});
