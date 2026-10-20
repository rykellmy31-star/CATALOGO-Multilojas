import { describe, expect, it, vi } from 'vitest';
import { decodeGeneratedPng, saveGeneratedImage } from '../backend/src/services/aiGeneratedStorage';

const bytes = Uint8Array.from([137,80,78,71,13,10,26,10,...Array(32).fill(0)]);
const base64 = Buffer.from(bytes).toString('base64');
function storage() {
  const put = vi.fn(async (key: string) => ({ key }));
  return { put, r2: { put } as unknown as Pick<R2Bucket, 'put'> };
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
    const saved = await saveGeneratedImage(r2, 'loja_a', 'produto_a', base64);
    expect(saved.key).toMatch(/^stores\/loja_a\/products\/produto_a\/[a-f0-9-]+\.png$/);
    expect(saved.url).toBe('/api/storage/' + encodeURIComponent(saved.key));
    expect(put).toHaveBeenCalledTimes(1);
    expect(put.mock.calls[0][0]).toBe(saved.key);
    expect(put.mock.calls[0][1]).toEqual(bytes);
    expect(put.mock.calls[0][2]).toEqual({
      httpMetadata: { contentType: 'image/png', cacheControl: 'no-store' }
    });
  });
  it('permite geração sem produto para o catálogo em edição', async () => {
    const { r2 } = storage();
    const saved = await saveGeneratedImage(r2, 'loja_a', null, base64);
    expect(saved.key).toContain('/products/general/');
  });
  it('rejeita manipulação do caminho de loja ou produto antes de acessar R2', async () => {
    const { put, r2 } = storage();
    await expect(saveGeneratedImage(r2, '../outra', null, base64)).rejects.toThrow();
    await expect(saveGeneratedImage(r2, 'loja_a', '../../outra', base64)).rejects.toThrow();
    expect(put).not.toHaveBeenCalled();
  });
  it('não devolve link quando R2 falha', async () => {
    const put = vi.fn(async () => { throw new Error('R2 offline'); });
    await expect(saveGeneratedImage({ put } as unknown as Pick<R2Bucket, 'put'>, 'loja_a', null, base64))
      .rejects.toThrow('R2 offline');
  });
  it('rejeita imagem muito grande antes do put', async () => {
    const { put, r2 } = storage();
    const oversized = 'A'.repeat(Math.ceil(11 * 1024 * 1024 / 3) * 4);
    await expect(saveGeneratedImage(r2, 'loja_a', null, oversized)).rejects.toThrow();
    expect(put).not.toHaveBeenCalled();
  });
});
