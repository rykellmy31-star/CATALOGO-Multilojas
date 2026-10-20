import { afterEach, describe, expect, it } from 'vitest';
import { fixture } from './helpers';

let state: ReturnType<typeof fixture> | undefined;
afterEach(() => { state?.db.close(); state = undefined; });

const imageKey = 'stores/a/products/general/preview-test.jpg';
const previewUrl = `/api/upload/preview/${encodeURIComponent(imageKey)}`;

function setup(contentType: string | undefined = 'image/jpeg') {
  state = fixture();
  const reads: string[] = [];
  (state.env as any).STORAGE = {
    async get(key: string) {
      reads.push(key);
      return {
        body: new Blob(['image']).stream(),
        httpMetadata: contentType === undefined ? {} : { contentType },
        etag: 'private-preview-test'
      };
    }
  };
  return { ...state, reads };
}

describe('Prévia privada de imagens R2', () => {
  it('permite prévia da própria loja antes de publicação', async () => {
    const t = setup();
    const response = await t.request(previewUrl);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/jpeg');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(t.reads).toEqual([imageKey]);
  });

  it('nega visitantes anônimos', async () => {
    const t = setup();
    const response = await t.request(previewUrl, 'GET', undefined, null);
    expect(response.status).toBe(401);
    expect(t.reads).toEqual([]);
  });

  it('nega prévia de outra loja antes de ler o R2', async () => {
    const t = setup();
    const key = 'stores/b/products/general/preview-test.jpg';
    const response = await t.request(`/api/upload/preview/${encodeURIComponent(key)}`);
    expect(response.status).toBe(404);
    expect(t.reads).toEqual([]);
  });

  it.each(['text/html', 'image/svg+xml', 'application/javascript', 'image/jpeg; charset=utf-8'])
    ('recusa MIME perigoso %s', async (type) => {
      const t = setup(type);
      expect((await t.request(previewUrl)).status).toBe(404);
    });

  it('recusa objetos legados sem MIME', async () => {
    const t = setup(undefined);
    expect((await t.request(previewUrl)).status).toBe(404);
  });

  it('recusa caminho com traversal antes de ler o R2', async () => {
    const t = setup();
    const key = 'stores/a/products/../preview-test.jpg';
    const response = await t.request(`/api/upload/preview/${encodeURIComponent(key)}`);
    expect(response.status).toBe(404);
    expect(t.reads).toEqual([]);
  });
});
