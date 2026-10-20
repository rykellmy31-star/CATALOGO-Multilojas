import { afterEach, describe, expect, it } from 'vitest';
import { fixture } from './helpers';
import { isValidBannerSchedule } from '../backend/src/utils/bannerSchedule';

let f: ReturnType<typeof fixture> | undefined;
afterEach(() => { f?.db.close(); f = undefined; });

const imageA = 'https://cdn.example.com/banner-a.jpg';
const imageB = '/api/storage/' + encodeURIComponent('stores/b/products/general/foreign.jpg');
const future = () => new Date(Date.now() + 86_400_000).toISOString();
const past = () => new Date(Date.now() - 86_400_000).toISOString();
const farPast = () => new Date(Date.now() - 172_800_000).toISOString();
const farFuture = () => new Date(Date.now() + 172_800_000).toISOString();

function setup() {
  f = fixture();
  const create = (body: Record<string, unknown>) =>
    f!.request('/api/store/banners', 'POST', { image_url: imageA, ...body });
  const update = (id: string, body: Record<string, unknown>) =>
    f!.request('/api/store/banners/' + id, 'PUT', body);
  const remove = (id: string) => f!.request('/api/store/banners/' + id, 'DELETE');
  const publicHome = async () => {
    const res = await f!.request('/api/public/stores/loja-a', 'GET', undefined, null);
    expect(res.status).toBe(200);
    return (await res.json() as any).banners as any[];
  };
  const find = (id: string) =>
    f!.db.prepare('SELECT * FROM banners WHERE id = ?').get(id) as any;
  return { create, update, remove, publicHome, find };
}

describe('Programação de campanhas publicitárias sem serviços externos', () => {
  it('banner imediato, sem datas, aparece no catálogo público', async () => {
    const { create, publicHome } = setup();
    const res = await create({ title: 'Oferta permanente' });
    expect(res.status).toBe(201);
    const banner = (await res.json() as any).banner;
    expect(banner.starts_at).toBeNull();
    expect(banner.ends_at).toBeNull();
    expect((await publicHome()).map(b => b.id)).toContain(banner.id);
  });

  it('banner programado para o futuro ainda não aparece', async () => {
    const { create, publicHome } = setup();
    const res = await create({ title: 'Próxima semana', starts_at: future() });
    expect(res.status).toBe(201);
    const id = (await res.json() as any).banner.id;
    expect((await publicHome()).map(b => b.id)).not.toContain(id);
  });

  it('banner expirado não aparece na vitrine', async () => {
    const { create, publicHome } = setup();
    const res = await create({
      title: 'Promoção terminada', starts_at: farPast(), ends_at: past()
    });
    expect(res.status).toBe(201);
    const id = (await res.json() as any).banner.id;
    expect((await publicHome()).map(b => b.id)).not.toContain(id);
  });

  it('campanha com período atual aparece', async () => {
    const { create, publicHome } = setup();
    const res = await create({ starts_at: past(), ends_at: future() });
    expect(res.status).toBe(201);
    const id = (await res.json() as any).banner.id;
    expect((await publicHome()).map(b => b.id)).toContain(id);
  });

  it('campanha desabilitada não aparece mesmo dentro do período', async () => {
    const { create, publicHome } = setup();
    const res = await create({ starts_at: past(), ends_at: future(), is_active: false });
    expect(res.status).toBe(201);
    const id = (await res.json() as any).banner.id;
    expect((await publicHome()).map(b => b.id)).not.toContain(id);
  });

  it('impede cadastro com início maior que fim sem alterar o banco', async () => {
    const { create } = setup();
    const before = (f!.db.prepare("SELECT COUNT(*) AS n FROM banners WHERE store_id='a'").get() as any).n;
    const res = await create({ starts_at: future(), ends_at: past() });
    expect(res.status).toBe(400);
    expect((f!.db.prepare("SELECT COUNT(*) AS n FROM banners WHERE store_id='a'").get() as any).n).toBe(before);
  });

  it('impede horários iguais, inclusive com fusos diferentes', async () => {
    const { create } = setup();
    const res = await create({
      starts_at: '2026-12-01T11:00:00-03:00',
      ends_at: '2026-12-01T14:00:00Z'
    });
    expect(res.status).toBe(400);
  });

  it('recusa horário sem fuso para evitar comportamento divergente entre navegadores', async () => {
    const { create } = setup();
    const res = await create({
      starts_at: '2026-12-01T11:00:00',
      ends_at: farFuture()
    });
    expect(res.status).toBe(400);
  });

  it('a edição valida datas combinando campos existentes e enviados', async () => {
    const { create, update, find } = setup();
    const res = await create({ starts_at: past(), ends_at: future() });
    const id = (await res.json() as any).banner.id;
    expect((await update(id, { starts_at: farFuture() })).status).toBe(400);
    expect(find(id).starts_at).not.toBe(farFuture());
    expect((await update(id, { ends_at: farFuture() })).status).toBe(200);
    expect((await update(id, { starts_at: future() })).status).toBe(200);
  });

  it('permite limpar agendamento com null e voltar à exibição contínua', async () => {
    const { create, update, publicHome } = setup();
    const res = await create({ starts_at: future(), ends_at: farFuture() });
    const id = (await res.json() as any).banner.id;
    expect((await publicHome()).map(b => b.id)).not.toContain(id);
    const edit = await update(id, { starts_at: null, ends_at: null });
    expect(edit.status).toBe(200);
    expect((await publicHome()).map(b => b.id)).toContain(id);
  });

  it('painel pode ativar/desativar sem apagar banner', async () => {
    const { create, update, find, publicHome } = setup();
    const res = await create({});
    const id = (await res.json() as any).banner.id;
    expect((await update(id, { is_active: false })).status).toBe(200);
    expect(find(id).is_active).toBe(0);
    expect((await publicHome()).map(b => b.id)).not.toContain(id);
    expect((await update(id, { is_active: true })).status).toBe(200);
    expect((await publicHome()).map(b => b.id)).toContain(id);
  });

  it('não permite edição e exclusão de banner de outra loja', async () => {
    const { update, remove, find } = setup();
    expect((await update('bb', { is_active: false })).status).toBe(404);
    expect((await remove('bb')).status).toBe(404);
    expect(find('bb').is_active).toBe(1);
  });

  it('banner inexistente retorna 404 na edição e exclusão', async () => {
    const { update, remove } = setup();
    expect((await update('nunca-existiu', { title: 'Novo título' })).status).toBe(404);
    expect((await remove('nunca-existiu')).status).toBe(404);
  });

  it('imagem R2 de outra loja continua sendo proibida no cadastro e na edição', async () => {
    const { create, update } = setup();
    expect((await create({ image_url: imageB })).status).toBe(400);
    expect((await update('bb', { image_url: imageB })).status).toBe(404);
    const current = await create({});
    const id = (await current.json() as any).banner.id;
    expect((await update(id, { image_url: imageB })).status).toBe(400);
  });

  it('intervalo inválido não é aceito pelo utilitário compartilhado', () => {
    expect(isValidBannerSchedule('2026-01-01T12:00:00Z', '2026-01-01T12:00:00Z')).toBe(false);
    expect(isValidBannerSchedule('2026-01-01T12:00:00-03:00', '2026-01-01T14:00:00Z')).toBe(false);
    expect(isValidBannerSchedule(null, '2026-01-01T00:00:00Z')).toBe(true);
    expect(isValidBannerSchedule('2026-01-01T00:00:00Z', null)).toBe(true);
    expect(isValidBannerSchedule('invalido', null)).toBe(false);
  });
});
