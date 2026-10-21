import { afterEach, describe, expect, it } from 'vitest';
import { fixture } from './helpers';

let f: ReturnType<typeof fixture> | undefined;
afterEach(() => { f?.db.close(); f = undefined; });

function setup() {
  f = fixture();
  const admin = f.token('root', null, 'super_admin');
  const logs = (query = '') => f!.request('/api/superadmin/audit-logs' + query,
    'GET', undefined, admin);
  const support = (id = 'b', token: string | null = admin) =>
    f!.request('/api/superadmin/stores/' + id + '/support-view', 'GET', undefined, token);
  const count = () => (f!.db.prepare(
    "SELECT COUNT(*) AS n FROM audit_logs WHERE action='support_view'"
  ).get() as { n: number }).n;
  return { admin, logs, support, count };
}

describe('Segurança e auditoria do superadministrador', () => {
  it('registra acesso antes de revelar dados de suporte', async () => {
    const { support, count } = setup();
    const response = await support();
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(count()).toBe(1);
    const data = await response.json() as any;
    expect(data.store.id).toBe('b');
    expect(data.admins).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'ub' })
    ]));
    expect(data.message).toContain('auditoria');
  });

  it('falha fechado se o D1 recusar a auditoria, sem devolver dados da loja', async () => {
    const { support, count } = setup();
    f!.db.exec(`
      CREATE TRIGGER reject_support_log
      BEFORE INSERT ON audit_logs
      WHEN NEW.action = 'support_view'
      BEGIN SELECT RAISE(ABORT, 'audit unavailable'); END;
    `);
    const response = await support();
    expect(response.status).toBe(503);
    const body = await response.json() as any;
    expect(body.error).toMatch(/Auditoria indisponível/);
    expect(body).not.toHaveProperty('store');
    expect(body).not.toHaveProperty('admins');
    expect(body).not.toHaveProperty('recentProducts');
    expect(count()).toBe(0);
  });

  it('não exibe dados nem grava auditoria para lojas excluídas', async () => {
    const { support, count } = setup();
    f!.db.exec("UPDATE stores SET status='deleted' WHERE id='b'");
    expect((await support()).status).toBe(404);
    expect(count()).toBe(0);
  });

  it('não registra acesso fictício a loja inexistente', async () => {
    const { support, count } = setup();
    expect((await support('missing')).status).toBe(404);
    expect(count()).toBe(0);
  });

  it('impede administrador de loja de acessar suporte e auditoria global', async () => {
    const { support, logs, count } = setup();
    expect((await support('b', f!.token())).status).toBe(403);
    const result = await f!.request('/api/superadmin/audit-logs', 'GET');
    expect(result.status).toBe(403);
    expect(count()).toBe(0);
  });

  it('retorna logs paginados com cache desativado', async () => {
    const { support, logs } = setup();
    expect((await support()).status).toBe(200);
    const response = await logs('?page=1&limit=1');
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const data = await response.json() as any;
    expect(data.pagination).toMatchObject({ page: 1, limit: 1, total: 1 });
    expect(data.logs).toHaveLength(1);
    expect(data.logs[0].action).toBe('support_view');
    expect(data.logs[0].store_id).toBe('b');
  });

  it.each([
    ['page', '0'], ['page', '-1'], ['page', '1abc'],
    ['page', '1e3'], ['page', '01'], ['page', '10001'],
    ['page', '999999999999999'], ['page', ''],
    ['limit', '0'], ['limit', '-1'], ['limit', '1abc'],
    ['limit', '101'], ['limit', '001'], ['limit', '1e2'],
    ['limit', '999999999999999'], ['limit', '']
  ])('rejeita %s=%s como paginação inválida', async (key, value) => {
    const { logs } = setup();
    const response = await logs('?' + key + '=' + encodeURIComponent(value));
    expect(response.status).toBe(400);
  });

  it('aceita limite e página máximos sem extrapolar inteiros SQLite', async () => {
    const { logs } = setup();
    const response = await logs('?page=10000&limit=100');
    expect(response.status).toBe(200);
    const data = await response.json() as any;
    expect(data.pagination).toMatchObject({ page: 10000, limit: 100, total: 0 });
    expect(data.logs).toEqual([]);
  });

  it('paginação sem parâmetros usa valores padrão', async () => {
    const { logs } = setup();
    const response = await logs();
    expect(response.status).toBe(200);
    const data = await response.json() as any;
    expect(data.pagination).toMatchObject({ page: 1, limit: 20, total: 0 });
  });
});
