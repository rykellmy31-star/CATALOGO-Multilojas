import { describe, expect, it, afterEach } from 'vitest';
import { fixture } from './helpers';

let f: ReturnType<typeof fixture> | undefined;
afterEach(() => { f?.db.close(); f = undefined; });

const image = 'https://example.com/generated.jpg';
function setup(status = 'completed', storeId = 'a', linkedProduct: string | null = 'pa') {
  f = fixture();
  f.db.prepare(
    'INSERT INTO ai_generations (id, store_id, user_id, product_id, type, status, generated_image_url, ai_style) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run('gen1', storeId, storeId === 'a' ? 'ua' : 'ub', linkedProduct, 'image', status, image, 'premium_catalog');
  return f;
}
function approve(payload: unknown) {
  return f!.request('/api/store/ai/approve-image', 'POST', payload);
}
function countImages() {
  return (f!.db.prepare('SELECT COUNT(*) AS count FROM product_images').get() as { count: number }).count;
}

describe('Aprovação segura de imagens IA sem chamadas ao provedor', () => {
  it('permite somente geração completa da loja e do produto corretos', async () => {
    setup();
    const response = await approve({ generation_id: 'gen1', product_id: 'pa', image_url: image });
    expect(response.status).toBe(200);
    expect(countImages()).toBe(1);
    const row = f!.db.prepare('SELECT * FROM product_images LIMIT 1').get() as any;
    expect(row).toMatchObject({ product_id: 'pa', store_id: 'a', url: image, ai_style: 'premium_catalog', is_ai_generated: 1 });
  });
  it('impede repetir aprovação da mesma geração', async () => {
    setup();
    const body = { generation_id: 'gen1', product_id: 'pa', image_url: image };
    expect((await approve(body)).status).toBe(200);
    expect((await approve(body)).status).toBe(409);
    expect(countImages()).toBe(1);
  });
  it('recusa imagem que não corresponde ao registro da geração', async () => {
    setup();
    expect((await approve({ generation_id: 'gen1', product_id: 'pa', image_url: 'https://example.com/fake.png' })).status).toBe(409);
    expect(countImages()).toBe(0);
  });
  it('não permite aprovar geração em processamento', async () => {
    setup('processing');
    expect((await approve({ generation_id: 'gen1', product_id: 'pa', image_url: image })).status).toBe(409);
    expect(countImages()).toBe(0);
  });
  it('impede geração de outra loja e produto alheio', async () => {
    setup('completed', 'b', 'pb');
    expect((await approve({ generation_id: 'gen1', product_id: 'pa', image_url: image })).status).toBe(409);
    expect((await approve({ generation_id: 'gen1', product_id: 'pb', image_url: image })).status).toBe(404);
    expect(countImages()).toBe(0);
  });
  it('exige identificador da geração', async () => {
    setup();
    expect((await approve({ product_id: 'pa', image_url: image })).status).toBe(400);
  });
  it('não vincula geração de outro produto na mesma loja', async () => {
    setup('completed', 'a', 'pa');
    f!.db.prepare("INSERT INTO products (id, store_id, name, slug, price) VALUES ('p2','a','Outro','outro',25)").run();
    expect((await approve({ generation_id: 'gen1', product_id: 'p2', image_url: image })).status).toBe(409);
  });
});
