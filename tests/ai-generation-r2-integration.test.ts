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
function run() {
  const key = 'stores/a/products/pa/input.png';
  return f!.request('/api/store/ai/generate', 'POST', {
    image_url: '/api/storage/' + encodeURIComponent(key),
    product_id: 'pa',
    generate_description: false,
    generate_image: true,
    style: 'modern_room'
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
    expect(mocks.edit).toHaveBeenCalledTimes(1);
    expect(String(mocks.edit.mock.calls[0][1])).toMatch(/^data:image\/png;base64,/);
    const history = f!.db.prepare('SELECT generated_image_url, status FROM ai_generations LIMIT 1').get() as any;
    expect(history).toMatchObject({ generated_image_url: response.generation.imageUrl, status: 'completed' });
  });
  it('retira imagem recém-enviada ao R2 se salvar histórico falhar', async () => {
    const calls = setup({ failSave: true });
    f!.db.exec(`CREATE TRIGGER fail_completed_ai BEFORE UPDATE ON ai_generations
      WHEN NEW.status = 'completed' BEGIN SELECT RAISE(ABORT, 'simulated failure'); END`);
    const result = await run();
    expect(result.status).toBe(500);
    expect(calls.put).toHaveLength(1);
    expect(calls.deleted).toEqual([calls.put[0][0]]);
    expect((f!.db.prepare('SELECT status FROM ai_generations LIMIT 1').get() as any).status).toBe('failed');
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
