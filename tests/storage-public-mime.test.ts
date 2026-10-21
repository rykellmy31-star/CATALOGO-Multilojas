import { afterEach, describe, expect, it } from 'vitest';
import { fixture } from './helpers';

let f: ReturnType<typeof fixture> | undefined;
afterEach(() => { f?.db.close(); f = undefined; });

const key = 'stores/a/products/general/legacy.jpg';
const url = `/api/storage/${encodeURIComponent(key)}`;

function initImage(contentType?: string | null) {
  f = fixture();
  f.db.prepare('INSERT INTO product_images (id, product_id, store_id, url, is_primary) VALUES (?, ?, ?, ?, ?)')
    .run('image-for-mime-test', 'pa', 'a', url, 1);
  (f.env as any).STORAGE = {
    async get() {
      return {
        body: new Blob(['sample']).stream(),
        httpMetadata: contentType === undefined ? {} : { contentType },
        etag: 'mime-test'
      };
    }
  };
  return f;
}

describe('Segurança das imagens públicas do R2', () => {
  it.each([
    ['JPEG', 'image/jpeg', 'image/jpeg'],
    ['PNG', 'image/png', 'image/png'],
    ['WEBP', 'image/webp', 'image/webp'],
    ['GIF', 'image/gif', 'image/gif'],
    ['JPG legado', 'image/jpg', 'image/jpeg'],
    ['MIME maiúsculo', 'IMAGE/JPEG', 'image/jpeg'],
    ['MIME com espaços externos', ' image/png ', 'image/png']
  ])('serve %s com MIME normalizado e sem cache público', async (_label, raw, expected) => {
    const t = initImage(raw);
    const response = await t.request(url, 'GET', undefined, null);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe(expected);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it.each([
    ['HTML', 'text/html'],
    ['SVG', 'image/svg+xml'],
    ['JavaScript', 'application/javascript'],
    ['Binário', 'application/octet-stream'],
    ['Texto', 'text/plain'],
    ['Vazio', ''],
    ['Sem valor', null],
    ['Parâmetros inesperados', 'image/jpeg; charset=utf-8'],
    ['MIME incorreto', 'image/ jpeg']
  ])('não serve %s mesmo com produto publicado', async (_label, raw) => {
    const t = initImage(raw);
    const response = await t.request(url, 'GET', undefined, null);
    expect(response.status).toBe(404);
  });

  it('recusa conteúdo sem metadata MIME', async () => {
    const t = initImage();
    expect((await t.request(url, 'GET', undefined, null)).status).toBe(404);
  });

  it('recusa imagem de produto que deixou de estar publicado', async () => {
    const t = initImage('image/jpeg');
    t.db.prepare("UPDATE products SET status = 'draft' WHERE id = 'pa'").run();
    expect((await t.request(url, 'GET', undefined, null)).status).toBe(404);
  });
});
