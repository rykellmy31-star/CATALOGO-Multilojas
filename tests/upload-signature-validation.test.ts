import { afterEach, describe, expect, it } from 'vitest';
import { fixture } from './helpers';

let current: ReturnType<typeof fixture> | undefined;
afterEach(() => { current?.db.close(); current = undefined; });

function setup() {
  current = fixture();
  const writes: { key: string; metadata: any }[] = [];
  (current.env as any).STORAGE = {
    async put(key: string, _contents: ArrayBuffer, metadata: any) {
      writes.push({ key, metadata });
      return { key };
    }
  };
  return { ...current, writes };
}

function imageForm(type: string, data: number[]) {
  const form = new FormData();
  form.append('file', new Blob([Uint8Array.from(data)], { type }), 'produto');
  return form;
}

const PNG = [137, 80, 78, 71, 13, 10, 26, 10, 0];
const GIF = Array.from('GIF89a').map(ch => ch.charCodeAt(0));
const WEBP = Array.from('RIFF0000WEBP').map(ch => ch.charCodeAt(0));

describe('Upload: assinaturas reais de imagens', () => {
  it.each([
    ['PNG parcial', 'image/png', PNG.slice(0, 4)],
    ['GIF parcial', 'image/gif', GIF.slice(0, 3)],
    ['WEBP parcial', 'image/webp', WEBP.slice(0, 4)],
    ['JPEG parcial', 'image/jpeg', [255, 216, 0]],
    ['GIF inválido', 'image/gif', Array.from('GIF90a').map(ch => ch.charCodeAt(0))]
  ])('não persiste %s', async (_label, type, bytes) => {
    const t = setup();
    const response = await t.request('/api/upload', 'POST', imageForm(type, bytes));
    expect(response.status).toBe(400);
    expect(t.writes).toHaveLength(0);
  });

  it.each([
    ['image/png', PNG, 'png', 'image/png'],
    ['image/gif', GIF, 'gif', 'image/gif'],
    ['image/webp', WEBP, 'webp', 'image/webp'],
    ['image/jpg', [255, 216, 255], 'jpg', 'image/jpeg']
  ])('aceita %s válido e preserva MIME seguro', async (type, bytes, extension, normalized) => {
    const t = setup();
    const response = await t.request('/api/upload', 'POST', imageForm(type, bytes));
    expect(response.status).toBe(200);
    const json = await response.json() as any;
    expect(json.url).toBe(`/api/storage/${encodeURIComponent(json.key)}`);
    expect(json.key).toMatch(new RegExp(`\\.${extension}$`));
    expect(t.writes).toHaveLength(1);
    expect(t.writes[0].metadata.httpMetadata.contentType).toBe(normalized);
    expect(t.writes[0].metadata.httpMetadata.cacheControl).toBe('no-store');
  });
});
