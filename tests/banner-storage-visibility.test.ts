import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixture } from './helpers';

let f: ReturnType<typeof fixture> | undefined;
afterEach(() => { f?.db.close(); f = undefined; });

const key = 'stores/a/products/general/banner-test.png';
const imageUrl = '/api/storage/' + encodeURIComponent(key);
const old = new Date(Date.now() - 86_400_000).toISOString();
const future = new Date(Date.now() + 86_400_000).toISOString();

function setup() {
  f = fixture();
  const get = vi.fn(async (_key: string) => ({
    body: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    httpMetadata: { contentType: 'image/png' },
    etag: '"fake"'
  }));
  (f.env.STORAGE as any).get = get;
  const read = () => f!.request(imageUrl, 'GET', undefined, null);
  const add = (start: string | null, end: string | null, active = 1) =>
    f!.db.prepare(`
      INSERT INTO banners (id,store_id,image_url,starts_at,ends_at,is_active)
      VALUES ('banner-a','a',?,?,?,?)
    `).run(imageUrl, start, end, active);
  return { get, read, add };
}

describe('R2 público respeita os mesmos horários dos banners da vitrine', () => {
  it('permite buscar a imagem de campanha em período de exibição', async () => {
    const { get, read, add } = setup();
    add(old, future);
    const result = await read();
    expect(result.status).toBe(200);
    expect(result.headers.get('Content-Type')).toBe('image/png');
    expect(result.headers.get('Cache-Control')).toBe('no-store');
    expect(get).toHaveBeenCalledWith(key);
  });

  it('nega acesso direto a imagem de campanha que ainda não começou', async () => {
    const { get, read, add } = setup();
    add(future, null);
    expect((await read()).status).toBe(404);
    expect(get).not.toHaveBeenCalled();
  });

  it('nega imagem de campanha expirada, mesmo quando continua habilitada', async () => {
    const { get, read, add } = setup();
    add(null, old);
    expect((await read()).status).toBe(404);
    expect(get).not.toHaveBeenCalled();
  });

  it('nega imagem de campanha desativada', async () => {
    const { get, read, add } = setup();
    add(null, null, 0);
    expect((await read()).status).toBe(404);
    expect(get).not.toHaveBeenCalled();
  });

  it('não publica imagem de campanha pertencente a outra loja', async () => {
    const { get, read } = setup();
    f!.db.prepare(`
      INSERT INTO banners (id,store_id,image_url,is_active)
      VALUES ('banner-b-foreign','b',?,1)
    `).run(imageUrl);
    expect((await read()).status).toBe(404);
    expect(get).not.toHaveBeenCalled();
  });

  it('imagem usada também pela logomarca da loja segue pública', async () => {
    const { get, read, add } = setup();
    add(future, null);
    f!.db.prepare('UPDATE stores SET logo_url=? WHERE id=?').run(imageUrl, 'a');
    expect((await read()).status).toBe(200);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('prévia autenticada continua acessível ao administrador antes do início', async () => {
    const { get, add } = setup();
    add(future, null);
    const response = await f!.request(
      '/api/upload/preview/' + encodeURIComponent(key), 'GET'
    );
    expect(response.status).toBe(200);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('prévia de imagem de outra loja continua inacessível ao administrador A', async () => {
    const { get } = setup();
    const foreignKey = 'stores/b/products/general/banner-test.png';
    const response = await f!.request(
      '/api/upload/preview/' + encodeURIComponent(foreignKey), 'GET'
    );
    expect(response.status).toBe(404);
    expect(get).not.toHaveBeenCalled();
  });
});
