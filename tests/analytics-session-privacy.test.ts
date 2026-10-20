import { afterEach, describe, expect, it } from 'vitest';
import { fixture } from './helpers';
import { app } from '../backend/src/index';
import { hashAnalyticsSessionId } from '../backend/src/utils/analytics';

let f: ReturnType<typeof fixture> | undefined;
afterEach(() => { f?.db.close(); f = undefined; });
const secret = 'test-secret-with-at-least-thirty-two-characters';
function request(path: string, method = 'GET', body?: unknown, session = 'sessao_privada_123') {
  return app.request(path, { method,
    headers: { 'X-Session-Id': session, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body)
  }, f!.env as any);
}
function sessions(type: string): string[] {
  return (f!.db.prepare('SELECT session_id FROM analytics_events WHERE event_type = ?').all(type) as any[])
    .map(r => r.session_id);
}
describe('Integridade e privacidade de analytics', () => {
  it('rejeita visualizações forjadas via POST', async () => {
    f = fixture();
    for (const event_type of ['catalog_view', 'product_view']) {
      expect((await request('/api/public/stores/loja-a/analytics', 'POST', { event_type, product_id: 'pa' })).status).toBe(400);
    }
    expect((f.db.prepare('SELECT COUNT(*) AS n FROM analytics_events').get() as any).n).toBe(0);
  });
  it('GET registra só sessão protegida por HMAC', async () => {
    f = fixture();
    expect((await request('/api/public/stores/loja-a')).status).toBe(200);
    expect((await request('/api/public/stores/loja-a/products/produto-a')).status).toBe(200);
    const expected = await hashAnalyticsSessionId(secret, 'sessao_privada_123', 'a');
    expect(expected).toMatch(/^s:[a-f0-9]{64}$/);
    expect(sessions('catalog_view')).toEqual([expected]);
    expect(sessions('product_view')).toEqual([expected]);
  });
  it('deduplica visualizações da mesma sessão', async () => {
    f = fixture();
    await request('/api/public/stores/loja-a/products/produto-a');
    await request('/api/public/stores/loja-a/products/produto-a');
    expect(sessions('product_view')).toHaveLength(1);
    expect((f.db.prepare("SELECT views FROM products WHERE id = 'pa'").get() as any).views).toBe(1);
  });
  it('contabiliza clique válido e registra sessão HMAC', async () => {
    f = fixture();
    const response = await request('/api/public/stores/loja-a/analytics', 'POST', { event_type: 'whatsapp_click', product_id: 'pa' });
    expect(response.status).toBe(200);
    expect(sessions('whatsapp_click')).toEqual([await hashAnalyticsSessionId(secret, 'sessao_privada_123', 'a')]);
    expect((f.db.prepare("SELECT clicks FROM products WHERE id = 'pa'").get() as any).clicks).toBe(1);
  });
  it('eventos anônimos não gravam identificadores falsos', async () => {
    f = fixture();
    const response = await f.request('/api/public/stores/loja-a/analytics', 'POST', { event_type: 'search' }, null);
    expect(response.status).toBe(200);
    expect(sessions('search')).toEqual(['anon']);
  });
  it('rejeita evento com metadados excessivos', async () => {
    f = fixture();
    const response = await request('/api/public/stores/loja-a/analytics', 'POST', { event_type: 'search', metadata: { q: 'x'.repeat(1500) } });
    expect(response.status).toBe(400);
  });
  it('rejeita evento com sessão inválida', async () => {
    f = fixture();
    expect((await request('/api/public/stores/loja-a/analytics', 'POST', { event_type: 'search' }, 'sessão inválida')).status).toBe(400);
  });
});
