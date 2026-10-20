import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixture } from './helpers';

const PNG = Uint8Array.from([137,80,78,71,13,10,26,10,...Array(32).fill(0)]);
const output = Buffer.from(PNG).toString('base64');
const mocks = vi.hoisted(() => ({
  edit: vi.fn(async (_config: unknown, _source: string, _style?: string, _name?: string) =>
    ({ imageBase64: '', model: 'gpt-image-2.5-flare', cost: 0 }))
}));
vi.mock('../backend/src/services/ai.js', async importOriginal => ({
  ...await importOriginal<typeof import('../backend/src/services/ai')>(),
  generateProductImage: mocks.edit
}));

let f: ReturnType<typeof fixture> | undefined;
afterEach(() => { f?.db.close(); f = undefined; mocks.edit.mockClear(); });
function setup(override?: { failSave?: boolean; missingInput?: boolean }) {
  f = fixture();
  f.db.prepare("UPDATE stores SET ai_enabled = 1, ai_daily_limit = 10, ai_monthly_limit = 10 WHERE id = 'a'").run();
  (f.env as any).AI_ENABLED = 'true';
  (f.env as any).OPENAI_API_KEY = 'mock-api-key-not-used';
  const calls = { put: [] as any[], deleted: [] as string[] };
  (f.env as any).STORAGE = {
    async get() {
      return override?.missingInput ? null : {
        size: PNG.length, httpMetadata: { contentType: 'image/png' },
        arrayBuffer: async () => Uint8Array.from(PNG).buffer
      };
    },
    async put(...args: any[]) {
      calls.put.push(args);
      return { key: args[0] };
    },
    async delete(key: string) { calls.deleted.push(key); }
  };
  mocks.edit.mockResolvedValue({ imageBase64: output, model: 'gpt-image-2.5-flare', cost: 0 });
  return calls;
}
function run(request_id?: string) {
  const key = 'stores/a/products/pa/input.png';
  return f!.request('/api/store/ai/generate', 'POST', {
    image_url: '/api/storage/' + encodeURIComponent(key),
    product_id: 'pa',
    generate_description: false,
    generate_image: true,
    style: 'modern_room',
    ...(request_id ? { request_id } : {})
  });
}
describe('Integração local IA -> R2 -> histórico sem chamadas pagas', () => {
  it('persiste PNG privado, salva histórico e devolve só URL controlada', async () => {
    const calls = setup();
    const result = await run();
    expect(result.status).toBe(200);
    const response = await result.json() as any;
    expect(response.generation.imageUrl).toMatch(/^\/api\/storage\//);
    expect(response.generation.imageUrl).not.toContain('base64');
    expect(calls.put).toHaveLength(1);
    expect((f!.db.prepare("SELECT storage_used_mb FROM stores WHERE id = 'a'").get() as any).storage_used_mb)
      .toBeCloseTo(PNG.byteLength / (1024 * 1024), 8);
    expect(mocks.edit).toHaveBeenCalledTimes(1);
    expect(String(mocks.edit.mock.calls[0][1])).toMatch(/^data:image\/png;base64,/);
    const history = f!.db.prepare('SELECT generated_image_url, status FROM ai_generations LIMIT 1').get() as any;
    expect(history).toMatchObject({ generated_image_url: response.generation.imageUrl, status: 'completed' });
  });
  it('reenvio com mesmo UUID não aciona provedor, R2 ou nova geração', async () => {
    const calls = setup();
    const requestId = crypto.randomUUID();
    expect((await run(requestId)).status).toBe(200);
    const duplicate = await run(requestId);
    expect(duplicate.status).toBe(409);
    expect(mocks.edit).toHaveBeenCalledTimes(1);
    expect(calls.put).toHaveLength(1);
    expect((f!.db.prepare('SELECT COUNT(*) AS n FROM ai_generations').get() as any).n).toBe(1);
  });

  it('reenvio simultâneo não duplica edição nem reserva cota', async () => {
    const calls = setup();
    const requestId = crypto.randomUUID();
    let entered!: () => void;
    let release!: () => void;
    const started = new Promise<void>(resolve => { entered = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    mocks.edit.mockImplementationOnce(async () => {
      entered();
      await gate;
      return { imageBase64: output, model: 'gpt-image-2.5-flare', cost: 0 };
    });
    const first = run(requestId);
    await started;
    const duplicate = await run(requestId);
    expect(duplicate.status).toBe(409);
    expect(mocks.edit).toHaveBeenCalledTimes(1);
    release();
    expect((await first).status).toBe(200);
    expect(calls.put).toHaveLength(1);
  });

  it('outro UUID pode gerar novamente somente dentro da cota', async () => {
    setup();
    f!.db.prepare('UPDATE stores SET ai_daily_limit = 2, ai_monthly_limit = 2 WHERE id = ?').run('a');
    expect((await run(crypto.randomUUID())).status).toBe(200);
    expect((await run(crypto.randomUUID())).status).toBe(200);
    expect((await run(crypto.randomUUID())).status).toBe(429);
    expect(mocks.edit).toHaveBeenCalledTimes(2);
  });

  it.each(['invalido', '', '00000000-0000-0000-0000-00000000000Z'])
    ('recusa chave não-UUID sem chamar provedor: %s', async (invalid) => {
      setup();
      const key = 'stores/a/products/pa/input.png';
      const result = await f!.request('/api/store/ai/generate', 'POST', {
        image_url: '/api/storage/' + encodeURIComponent(key),
        product_id: 'pa', generate_description: false, generate_image: true,
        request_id: invalid
      });
      expect(result.status).toBe(400);
      expect(mocks.edit).not.toHaveBeenCalled();
    });

  it('retira imagem recém-enviada ao R2 se salvar histórico falhar', async () => {
    const calls = setup({ failSave: true });
    f!.db.exec(`CREATE TRIGGER fail_completed_ai BEFORE UPDATE ON ai_generations
      WHEN NEW.status = 'completed' BEGIN SELECT RAISE(ABORT, 'simulated failure'); END`);
    const result = await run();
    expect(result.status).toBe(500);
    expect(calls.put).toHaveLength(1);
    expect(calls.deleted).toEqual([calls.put[0][0]]);
    expect((f!.db.prepare("SELECT storage_used_mb FROM stores WHERE id = 'a'").get() as any).storage_used_mb)
      .toBeCloseTo(0, 8);
    expect((f!.db.prepare('SELECT status FROM ai_generations LIMIT 1').get() as any).status).toBe('failed');
  });
  it('armazenamento esgotado rejeita antes de chamar a API paga', async () => {
    const calls = setup();
    f!.db.prepare("UPDATE stores SET storage_limit_mb = 0 WHERE id = 'a'").run();
    const response = await run();
    expect(response.status).toBe(413);
    expect(mocks.edit).not.toHaveBeenCalled();
    expect(calls.put).toHaveLength(0);
    expect((f!.db.prepare('SELECT COUNT(*) AS n FROM ai_generations').get() as any).n).toBe(0);
  });

  it('imagem gerada maior que o espaço livre não vai ao R2', async () => {
    const calls = setup();
    // A cota quase cheia é positiva, mas menor que o PNG gerado.
    f!.db.prepare("UPDATE stores SET storage_limit_mb = 1, storage_used_mb = ? WHERE id = 'a'")
      .run(1 - (PNG.byteLength - 1) / (1024 * 1024));
    const response = await run();
    expect(response.status).toBe(413);
    expect(mocks.edit).toHaveBeenCalledTimes(1);
    expect(calls.put).toHaveLength(0);
  });

  it('não reserva cota ou chama provedor se imagem privada não existe', async () => {
    const calls = setup({ missingInput: true });
    const result = await run();
    expect(result.status).toBe(404);
    expect(calls.put).toHaveLength(0);
    expect(mocks.edit).not.toHaveBeenCalled();
    expect((f!.db.prepare('SELECT COUNT(*) AS n FROM ai_generations').get() as any).n).toBe(0);
  });
  it('não acessa edição paga quando imagem pertence a outra loja', async () => {
    setup();
    const foreign = '/api/storage/' + encodeURIComponent('stores/b/products/pb/input.png');
    const result = await f!.request('/api/store/ai/generate', 'POST', {
      image_url: foreign, generate_description: false, generate_image: true
    });
    expect(result.status).toBe(404);
    expect(mocks.edit).not.toHaveBeenCalled();
  });
});
