import { afterEach, describe, expect, it } from 'vitest';
import { fixture } from './helpers';
import { app } from '../backend/src/index';

let f: ReturnType<typeof fixture> | undefined;
afterEach(() => { f?.db.close(); f = undefined; });
function event(body: unknown, headers: Record<string,string> = {}) {
  return app.request('/api/public/stores/loja-a/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Session-Id': 'sessao_eventos_01', ...headers },
    body: JSON.stringify(body)
  }, f!.env as any);
}

describe('Proteções de abuso de analytics pública', () => {
  it('não permite falsificar visualizações por POST', async () => {
    f = fixture();
    for (const event_type of ['catalog_view', 'product_view']) {
      expect((await event({ event_type, product_id: 'pa' })).status).toBe(400);
    }
    expect((f.db.prepare('SELECT COUNT(*) AS n FROM analytics_events').get() as any).n).toBe(0);
  });
  it('rejeita referência de produto de outra loja', async () => {
    f = fixture();
    expect((await event({ event_type: 'whatsapp_click', product_id: 'pb' })).status).toBe(404);
    expect((f.db.prepare("SELECT clicks FROM products WHERE id = 'pb'").get() as any).clicks).toBe(0);
  });
  it('aplica limite por loja e visitante, sem contornar com sessão diferente', async () => {
    f = fixture();
    for (let i = 0; i < 120; i++) {
      const response = await event({ event_type: 'search' }, { 'X-Session-Id': 'sessao_' + i });
      expect(response.status).toBe(200);
    }
    const blocked = await event({ event_type: 'search' }, { 'X-Session-Id': 'outra_sessao' });
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect((f.db.prepare("SELECT COUNT(*) AS n FROM analytics_events WHERE event_type = 'search'").get() as any).n).toBe(120);
  });
  it('não processa corpo maior que 4 KiB', async () => {
    f = fixture();
    const response = await event({ event_type: 'search', metadata: { extra: 'x'.repeat(5000) } });
    expect(response.status).toBe(413);
  });
});
