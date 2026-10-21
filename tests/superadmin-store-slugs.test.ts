import { afterEach, describe, expect, it } from 'vitest';
import { fixture } from './helpers';

let f: ReturnType<typeof fixture> | undefined;
afterEach(() => { f?.db.close(); f = undefined; });

const setup = () => {
  f = fixture();
  const token = f.token('root', null, 'super_admin');
  const create = (data: Record<string, unknown>) =>
    f!.request('/api/superadmin/stores', 'POST', data, token);
  const update = (id: string, data: Record<string, unknown>) =>
    f!.request(`/api/superadmin/stores/${id}`, 'PUT', data, token);
  return { create, update };
};

describe('Super Admin: endereço único e limites iniciais das lojas', () => {
  it('cria loja com slug vazio, gerado pelo nome, como sugere o formulário', async () => {
    const { create } = setup();
    const response = await create({ name: 'Móveis Premium', slug: '' });
    expect(response.status).toBe(201);
    const { store } = await response.json() as any;
    expect(store.slug).toBe('moveis-premium');
    expect(store.storage_limit_mb).toBe(1024);
    expect(store.ai_daily_limit).toBe(10);
    expect(store.ai_monthly_limit).toBe(100);
  });

  it('executa realmente o INSERT e mantém a loja registrada no banco', async () => {
    const { create } = setup();
    const response = await create({ name: 'Loja Persistente', slug: 'loja-persistente' });
    expect(response.status).toBe(201);
    const { store } = await response.json() as any;
    expect(store.slug).toBe('loja-persistente');
    expect(f!.db.prepare('SELECT name,slug FROM stores WHERE id = ?').get(store.id))
      .toMatchObject({ name: 'Loja Persistente', slug: 'loja-persistente' });
  });

  it('respeita os limites informados na criação, inclusive IA desabilitada', async () => {
    const { create } = setup();
    const response = await create({
      name: 'Catálogo sem IA', storage_limit_mb: 256,
      ai_enabled: false, ai_daily_limit: 0, ai_monthly_limit: 0
    });
    expect(response.status).toBe(201);
    const { store } = await response.json() as any;
    expect(store).toMatchObject({
      storage_limit_mb: 256, ai_enabled: 0, ai_daily_limit: 0,
      ai_monthly_limit: 0
    });
  });

  it('slug explícito de outra loja retorna conflito 409, sem inserir nada', async () => {
    const { create } = setup();
    const before = (f!.db.prepare('SELECT COUNT(*) AS n FROM stores').get() as any).n;
    const response = await create({ name: 'Loja de teste', slug: 'loja-a' });
    expect(response.status).toBe(409);
    expect((f!.db.prepare('SELECT COUNT(*) AS n FROM stores').get() as any).n).toBe(before);
  });

  it('slug automático já usado recebe sufixo UUID, sem sobrescrever loja', async () => {
    const { create } = setup();
    const response = await create({ name: 'Loja A', slug: '' });
    expect(response.status).toBe(201);
    const { store } = await response.json() as any;
    expect(store.slug).toMatch(/^loja-a-[0-9a-f-]{36}$/);
    expect((f!.db.prepare("SELECT slug FROM stores WHERE id = 'a'").get() as any).slug).toBe('loja-a');
  });

  it('dois cadastros concorrentes com mesmo nome criam endereços diferentes', async () => {
    const { create } = setup();
    const [first, second] = await Promise.all([
      create({ name: 'Nome Repetido' }), create({ name: 'Nome Repetido' })
    ]);
    expect([first.status, second.status]).toEqual([201, 201]);
    const a = (await first.json() as any).store;
    const b = (await second.json() as any).store;
    expect(a.id).not.toBe(b.id);
    expect(a.slug).not.toBe(b.slug);
  });

  it('edição recusa slug de outra loja sem alterar nome ou status', async () => {
    const { update } = setup();
    const response = await update('a', { name: 'Nome Novo', slug: 'loja-b', status: 'suspended' });
    expect(response.status).toBe(409);
    expect(f!.db.prepare("SELECT name,slug,status FROM stores WHERE id='a'").get()).toMatchObject({
      name: 'Loja A', slug: 'loja-a', status: 'active'
    });
  });

  it('edição permite slug novo e normalizado quando disponível', async () => {
    const { update } = setup();
    const response = await update('a', { slug: 'Móveis-Nova-Loja' });
    expect(response.status).toBe(200);
    const { store } = await response.json() as any;
    expect(store.slug).toBe('moveis-nova-loja');
  });

  it('rejeita endereço que não produz slug válido', async () => {
    const { create, update } = setup();
    expect((await create({ name: 'Loja Teste', slug: '🚀🚀' })).status).toBe(400);
    expect((await update('a', { slug: '🚀🚀' })).status).toBe(400);
  });

  it('administrador de uma loja não pode criar nem modificar lojas', async () => {
    setup();
    expect((await f!.request('/api/superadmin/stores', 'POST', {
      name: 'Loja Indevida'
    })).status).toBe(403);
    expect((await f!.request('/api/superadmin/stores/b', 'PUT', {
      status: 'suspended'
    })).status).toBe(403);
  });
});
