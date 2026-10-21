import { afterEach, describe, expect, it } from 'vitest';
import { fixture } from './helpers';

let f: ReturnType<typeof fixture> | undefined;
afterEach(() => { f?.db.close(); f = undefined; });

function setup() {
  f = fixture();
  const root = f.token('root', null, 'super_admin');
  const update = (body: Record<string, unknown>) =>
    f!.request('/api/superadmin/platform-config', 'PUT', body, root);
  const stored = () => f!.db.prepare(
    "SELECT * FROM platform_config WHERE id = 'platform-default'"
  ).get() as any;
  const auditCount = () => (f!.db.prepare(
    "SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'update_platform_config'"
  ).get() as { n: number }).n;
  return { update, stored, auditCount };
}

describe('Configuração global: validação de dados comerciais e permissões', () => {
  it('permite desativar IA e configurar corretamente o limite zero', async () => {
    const { update, stored } = setup();
    const response = await update({
      ai_enabled: 0, ai_daily_limit_default: 0, ai_monthly_limit_default: 0
    });
    expect(response.status).toBe(200);
    expect(stored()).toMatchObject({
      ai_enabled: 0, ai_daily_limit_default: 0, ai_monthly_limit_default: 0
    });
  });

  it('aceita valores booleanos e converte para os inteiros esperados', async () => {
    const { update, stored } = setup();
    expect((await update({ ai_enabled: false })).status).toBe(200);
    expect(stored().ai_enabled).toBe(0);
    expect((await update({ ai_enabled: true })).status).toBe(200);
    expect(stored().ai_enabled).toBe(1);
  });

  it.each([
    { ai_daily_limit_default: -1 },
    { ai_monthly_limit_default: -1 },
    { storage_limit_per_store_mb: 0 },
    { ai_daily_limit_default: 10001 },
    { ai_monthly_limit_default: 100001 },
    { storage_limit_per_store_mb: 102401 },
    { ai_daily_limit_default: 1.2 },
    { ai_monthly_limit_default: '10' },
    { ai_enabled: 'false' },
    { ai_daily_limit_default: null }
  ])('rejeita limites inválidos sem gravar parcialmente: %j', async body => {
    const { update, stored, auditCount } = setup();
    const before = stored();
    const res = await update({ platform_name: 'Não deve gravar', ...body });
    expect(res.status).toBe(400);
    expect(stored().platform_name).toBe(before.platform_name);
    expect(auditCount()).toBe(0);
  });

  it('proíbe URL de script e credenciais incorporadas na logomarca', async () => {
    const { update } = setup();
    expect((await update({ logo_url: 'javascript:alert(1)' })).status).toBe(400);
    expect((await update({ logo_url: 'https://user:pass@example.com/logo.png' })).status).toBe(400);
  });

  it('permite limpar logomarca e e-mail de suporte', async () => {
    const { update, stored } = setup();
    expect((await update({ logo_url: 'https://example.com/logo.png' })).status).toBe(200);
    expect((await update({ logo_url: null, support_email: '' })).status).toBe(200);
    expect(stored().logo_url).toBeNull();
    expect(stored().support_email).toBe('');
  });

  it('rejeita e-mail e cor hexadecimal inválidos', async () => {
    const { update, stored } = setup();
    expect((await update({ support_email: 'invalido' })).status).toBe(400);
    expect((await update({ primary_color: 'red' })).status).toBe(400);
    expect((await update({ primary_color: '#zzzzzz' })).status).toBe(400);
    expect(stored().primary_color).toBe('#0ea5e9');
  });

  it('ignora id, created_at, updated_at e campos internos não editáveis', async () => {
    const { update, stored } = setup();
    const response = await update({
      platform_name: 'Novo Catálogo',
      id: 'hacker',
      created_at: '2000-01-01',
      updated_at: '1999-01-01',
      ai_credits_used: -10000
    });
    expect(response.status).toBe(200);
    expect(stored().id).toBe('platform-default');
    expect(stored().platform_name).toBe('Novo Catálogo');
    expect(stored().created_at).not.toBe('2000-01-01');
  });

  it('recusa requisições sem campo editável, sem criar auditoria', async () => {
    const { update, auditCount } = setup();
    expect((await update({ id: 'hack', ai_credits_used: -1 })).status).toBe(400);
    expect(auditCount()).toBe(0);
  });

  it('recusa provedor desconhecido sem ativar nenhum serviço', async () => {
    const { update, stored } = setup();
    expect((await update({ ai_provider: 'unknown-provider' })).status).toBe(400);
    expect(stored().ai_provider).toBe('openai');
  });

  it('aceita configuração visual válida e conserva outros campos', async () => {
    const { update, stored, auditCount } = setup();
    const response = await update({
      platform_name: 'Catálogo Empresarial',
      primary_color: '#abcdef',
      secondary_color: '#123456',
      accent_color: '#112233',
      storage_limit_per_store_mb: 2048,
      support_email: 'suporte@example.com'
    });
    expect(response.status).toBe(200);
    expect(stored()).toMatchObject({
      platform_name: 'Catálogo Empresarial',
      primary_color: '#abcdef',
      secondary_color: '#123456',
      accent_color: '#112233',
      storage_limit_per_store_mb: 2048
    });
    expect(auditCount()).toBe(1);
  });

  it('administrador de loja não pode alterar configuração global', async () => {
    setup();
    const res = await f!.request('/api/superadmin/platform-config', 'PUT', {
      platform_name: 'Tentativa'
    }, f!.token());
    expect(res.status).toBe(403);
  });
});
