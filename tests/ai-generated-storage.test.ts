import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fixture } from './helpers';
import { decodeGeneratedPng, saveGeneratedImage } from '../backend/src/services/aiGeneratedStorage';

const bytes = Uint8Array.from([137,80,78,71,13,10,26,10,...Array(32).fill(0)]);
const base64 = Buffer.from(bytes).toString('base64');
let current: ReturnType<typeof fixture>;
beforeEach(() => { current = fixture(); });
afterEach(() => { current.db.close(); });
const db = () => current.env.DB as unknown as D1Database;
const storedMb = () =>
  (current.db.prepare("SELECT storage_used_mb AS n FROM stores WHERE id = 'a'").get() as any).n as number;
function storage() {
  const put = vi.fn(async (key: string, _body: Uint8Array, _options: unknown) => ({ key }));
  const del = vi.fn(async (_key: string) => {});
  return { put, del, r2: { put, delete: del } as unknown as Pick<R2Bucket, 'put' | 'delete'> };
}
describe('Persistência segura da imagem gerada pela IA', () => {
  it('decodifica PNG válido', () => {
    expect(decodeGeneratedPng(base64)).toEqual(bytes);
  });
  it.each(['', '%%%%', 'a'.repeat(20), Buffer.from('texto arbitrário').toString('base64')])
    ('rejeita base64 ausente, inválido ou não PNG: %s', (value) => {
      expect(() => decodeGeneratedPng(value)).toThrow();
    });
  it('grava no R2 privado com MIME e sem cache', async () => {
    const { put, r2 } = storage();
    const saved = await saveGeneratedImage(r2, db(), 'a', 'pa', base64);
    expect(saved.key).toMatch(/^stores\/a\/products\/pa\/[a-f0-9-]+\.png$/);
    expect(saved.url).toBe('/api/storage/' + encodeURIComponent(saved.key));
    expect(saved.sizeBytes).toBe(bytes.length);
    expect(storedMb()).toBeCloseTo(bytes.length / (1024 * 1024), 8);
    expect(put).toHaveBeenCalledTimes(1);
    expect(put.mock.calls[0][0]).toBe(saved.key);
    expect(put.mock.calls[0][1]).toEqual(bytes);
    expect(put.mock.calls[0][2]).toEqual({
      httpMetadata: { contentType: 'image/png', cacheControl: 'no-store' }
    });
  });
  it('permite geração sem produto para o catálogo em edição', async () => {
    const { r2 } = storage();
    const saved = await saveGeneratedImage(r2, db(), 'a', null, base64);
    expect(saved.key).toContain('/products/general/');
  });
  it('bloqueia cota cheia antes de acionar o R2', async () => {
    const { put, r2 } = storage();
    current.db.prepare("UPDATE stores SET storage_limit_mb = 0 WHERE id = 'a'").run();
    await expect(saveGeneratedImage(r2, db(), 'a', null, base64)).rejects.toThrow('Limite de armazenamento');
    expect(put).not.toHaveBeenCalled();
    expect(storedMb()).toBe(0);
  });

  it('duas reservas próximas ao limite não usam o mesmo espaço livre', async () => {
    const { put, r2 } = storage();
    const mb = bytes.length / (1024 * 1024);
    current.db.prepare("UPDATE stores SET storage_limit_mb = ? WHERE id = 'a'").run(mb * 1.5);
    await saveGeneratedImage(r2, db(), 'a', null, base64);
    await expect(saveGeneratedImage(r2, db(), 'a', null, base64)).rejects.toThrow('Limite de armazenamento');
    expect(put).toHaveBeenCalledTimes(1);
  });

  it('devolve reserva quando o put falha', async () => {
    const put = vi.fn(async () => { throw new Error('falha simulada R2'); });
    await expect(saveGeneratedImage(
      { put, delete: async () => {} } as unknown as Pick<R2Bucket, 'put' | 'delete'>,
      db(), 'a', null, base64
    )).rejects.toThrow('falha simulada R2');
    expect(storedMb()).toBeCloseTo(0, 8);
  });

  it('rejeita manipulação do caminho de loja ou produto antes de acessar R2', async () => {
    const { put, r2 } = storage();
    await expect(saveGeneratedImage(r2, db(), '../outra', null, base64)).rejects.toThrow();
    await expect(saveGeneratedImage(r2, db(), 'a', '../../outra', base64)).rejects.toThrow();
    expect(put).not.toHaveBeenCalled();
  });
  it('não devolve link quando R2 falha', async () => {
    const put = vi.fn(async () => { throw new Error('R2 offline'); });
    await expect(saveGeneratedImage({ put, delete: async () => {} } as unknown as Pick<R2Bucket, 'put' | 'delete'>, db(), 'a', null, base64))
      .rejects.toThrow('R2 offline');
  });
  it('rejeita imagem muito grande antes do put', async () => {
    const { put, r2 } = storage();
    const oversized = 'A'.repeat(Math.ceil(11 * 1024 * 1024 / 3) * 4);
    await expect(saveGeneratedImage(r2, db(), 'a', null, oversized)).rejects.toThrow();
    expect(put).not.toHaveBeenCalled();
  });
});
