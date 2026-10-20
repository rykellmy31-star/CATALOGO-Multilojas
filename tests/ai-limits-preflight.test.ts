import { describe, it, expect, afterEach } from 'vitest';
import { fixture } from './helpers';

// Estes testes não chamam OpenAI, Cloudflare remoto ou serviços pagos.
let f: ReturnType<typeof fixture> | undefined;
afterEach(() => { f?.db.close(); f = undefined; });
const input = { image_url: 'https://example.com/produto.png', style: 'modern_room',
  generate_description: true, generate_image: false };
function setup(daily: number, monthly: number) {
  f = fixture();
  (f.env as any).AI_ENABLED = 'true';
  (f.env as any).OPENAI_API_KEY = 'test-key-not-used-in-these-cases';
  f.db.prepare('UPDATE stores SET ai_enabled = 1, ai_daily_limit = ?, ai_monthly_limit = ? WHERE id = ?')
    .run(daily, monthly, 'a');
}
function generate(payload: unknown = input) {
  return f!.request('/api/store/ai/generate', 'POST', payload);
}
function attempts() {
  return (f!.db.prepare('SELECT COUNT(*) AS count FROM ai_generations').get() as { count: number }).count;
}
function addGeneration() {
  f!.db.prepare(`INSERT INTO ai_generations (id,store_id,user_id,type,status)
    VALUES ('previous','a','ua','description','completed')`).run();
}
describe('IA: validações e cotas sem requisições pagas', () => {
  it('zero na cota diária bloqueia em vez de virar valor padrão', async () => {
    setup(0, 100);
    expect((await generate()).status).toBe(429);
    expect(attempts()).toBe(0);
  });
  it('zero na cota mensal bloqueia sem reservar geração', async () => {
    setup(10, 0);
    expect((await generate()).status).toBe(429);
    expect(attempts()).toBe(0);
  });
  it('cota diária atingida rejeita antes de chamar qualquer provedor', async () => {
    setup(1, 100);
    addGeneration();
    expect((await generate()).status).toBe(429);
    expect(attempts()).toBe(1);
  });
  it('cota mensal atingida rejeita mesmo abaixo da cota diária', async () => {
    setup(100, 1);
    addGeneration();
    expect((await generate()).status).toBe(429);
    expect(attempts()).toBe(1);
  });
  it('rejeita geração que não pede nem descrição nem imagem', async () => {
    setup(10, 100);
    expect((await generate({ ...input, generate_description: false, generate_image: false })).status).toBe(400);
    expect(attempts()).toBe(0);
  });
  it('rejeita estilo inexistente', async () => {
    setup(10, 100);
    expect((await generate({ ...input, style: 'qualquer' })).status).toBe(400);
    expect(attempts()).toBe(0);
  });
  it('não aceita imagem sem origem pública segura', async () => {
    setup(10, 100);
    expect((await generate({ ...input, image_url: 'http://127.0.0.1/foto.jpg' })).status).toBe(400);
    expect(attempts()).toBe(0);
  });
});
