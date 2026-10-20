import { describe, expect, it, vi } from 'vitest';
import { matchesImageSignature, resolveAIInputImage } from '../backend/src/utils/aiImage';

const PNG = new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0]);
const key = 'stores/a/products/general/image.png';
const url = '/api/storage/' + encodeURIComponent(key);
function fakeStorage(mime = 'image/png', bytes = PNG, opts: { size?: number, failed?: boolean, missing?: boolean } = {}) {
  const get = vi.fn(async (_key: string) => {
    if (opts.failed) throw new Error('R2 falhou');
    if (opts.missing) return null;
    return {
      size: opts.size ?? bytes.length,
      httpMetadata: { contentType: mime },
      arrayBuffer: async () => Uint8Array.from(bytes).buffer
    };
  });
  return { storage: { get } as unknown as Pick<R2Bucket,'get'>, get };
}

describe('Imagem privada de IA por loja (sem chamadas externas)', () => {
  it('converte imagem R2 da própria loja em data URI', async () => {
    const { storage, get } = fakeStorage();
    const result = await resolveAIInputImage(url, 'a', storage);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.url).toMatch(/^data:image\/png;base64,/);
    expect(get).toHaveBeenCalledWith(key);
  });
  it('não lê objeto de outra loja', async () => {
    const { storage, get } = fakeStorage();
    expect(await resolveAIInputImage(url, 'b', storage)).toMatchObject({ ok: false, status: 404 });
    expect(get).not.toHaveBeenCalled();
  });
  it('rejeita caminho com traversal antes de consultar R2', async () => {
    const { storage, get } = fakeStorage();
    const malicious = '/api/storage/' + encodeURIComponent('stores/a/products/../image.png');
    expect((await resolveAIInputImage(malicious, 'a', storage)).ok).toBe(false);
    expect(get).not.toHaveBeenCalled();
  });
  it('rejeita codificação não canônica', async () => {
    const { storage, get } = fakeStorage();
    expect((await resolveAIInputImage(url.replace('%2F','%2f'), 'a', storage)).ok).toBe(false);
    expect(get).not.toHaveBeenCalled();
  });
  it('rejeita percentual inválido', async () => {
    const { storage, get } = fakeStorage();
    expect(await resolveAIInputImage('/api/storage/%ZZ', 'a', storage)).toMatchObject({ ok: false, status: 400 });
    expect(get).not.toHaveBeenCalled();
  });
  it('rejeita MIME ativo ou não suportado', async () => {
    const { storage } = fakeStorage('image/svg+xml');
    expect(await resolveAIInputImage(url, 'a', storage)).toMatchObject({ ok: false, status: 400 });
  });
  it('não encaminha PNG com assinatura falsificada', async () => {
    const { storage } = fakeStorage('image/png', new Uint8Array([137,80,78,71]));
    expect(await resolveAIInputImage(url, 'a', storage)).toMatchObject({ ok: false, status: 400 });
  });
  it('rejeita objeto acima de 10 MB antes da leitura', async () => {
    const { storage } = fakeStorage('image/png', PNG, { size: 11 * 1024 * 1024 });
    expect(await resolveAIInputImage(url, 'a', storage)).toMatchObject({ ok: false, status: 413 });
  });
  it('trata falha de armazenamento sem revelar detalhes', async () => {
    const { storage } = fakeStorage('image/png', PNG, { failed: true });
    expect(await resolveAIInputImage(url, 'a', storage)).toMatchObject({ ok: false, status: 503 });
  });
  it('trata objetos ausentes', async () => {
    const { storage } = fakeStorage('image/png', PNG, { missing: true });
    expect(await resolveAIInputImage(url, 'a', storage)).toMatchObject({ ok: false, status: 404 });
  });
  it.each(['http://example.com/a.png','https://127.0.0.1/a.png','https://localhost/a.png','https://user:pass@example.com/a.png','data:text/html,hello','javascript:alert(1)'])
    ('rejeita URL externa insegura %s', async (invalid) => {
      const { storage, get } = fakeStorage();
      expect((await resolveAIInputImage(invalid, 'a', storage)).ok).toBe(false);
      expect(get).not.toHaveBeenCalled();
    });
  it('aceita imagem externa HTTPS com domínio válido sem buscar no Worker', async () => {
    const { storage, get } = fakeStorage();
    expect(await resolveAIInputImage('https://images.example.com/a.png','a',storage))
      .toEqual({ ok: true, url: 'https://images.example.com/a.png' });
    expect(get).not.toHaveBeenCalled();
  });
  it('verifica assinatura PNG completa', () => {
    expect(matchesImageSignature(PNG, 'image/png')).toBe(true);
    expect(matchesImageSignature(PNG.slice(0, 4), 'image/png')).toBe(false);
  });
});
