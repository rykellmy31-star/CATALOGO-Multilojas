import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateProductImage } from '../backend/src/services/ai';

const png = Uint8Array.from([137,80,78,71,13,10,26,10,...Array(32).fill(0)]);
const original = 'data:image/png;base64,' + Buffer.from(png).toString('base64');
const config = {
  enabled: true,
  provider: 'openai',
  apiKey: 'test-key-never-sent-to-real-provider',
  model: 'gpt-4o',
  imageModel: 'gpt-image-2.5-flare'
};
afterEach(() => vi.unstubAllGlobals());

describe('Edição de foto original com modelo vigente, sem chamadas pagas', () => {
  it('envia a foto original por multipart para o endpoint de edição e recebe base64', async () => {
    const returned = Buffer.from(png).toString('base64');
    const fetchMock = vi.fn(async () => Response.json({ data: [{ b64_json: returned }] }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await generateProductImage(config, original, 'modern_room', 'Sofá');
    expect(result.imageBase64).toBe(returned);
    expect(result.model).toBe('gpt-image-2.5-flare');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [endpoint, opts] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(endpoint).toBe('https://api.openai.com/v1/images/edits');
    expect(opts.method).toBe('POST');
    expect(opts.body).toBeInstanceOf(FormData);
    const form = opts.body as FormData;
    expect(form.get('model')).toBe('gpt-image-2.5-flare');
    expect(form.get('output_format')).toBe('png');
    expect(form.get('quality')).toBe('low');
    expect((form.get('image') as File).size).toBe(png.byteLength);
    expect(String(form.get('prompt'))).toContain('Preserve a identidade');
  });
  it('não chama o provedor se a entrada for URL externa', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(generateProductImage(config, 'https://example.com/image.png')).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('recusa base64 malformado sem chamada externa', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(generateProductImage(config, 'data:image/png;base64,@@@@')).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('não expõe corpo de erro do provedor nem chave de API', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('chave-secreta-do-provedor', { status: 429 })));
    await expect(generateProductImage(config, original)).rejects.toThrow('Falha do provedor');
  });
  it('rejeita resultado sem PNG em base64', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ data: [{ url: 'https://expires.example.com/image.png' }] })));
    await expect(generateProductImage(config, original)).rejects.toThrow('não devolveu um PNG');
  });
});
