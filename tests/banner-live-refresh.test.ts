import { afterEach, describe, expect, it } from 'vitest';
import { fixture } from './helpers';

let f: ReturnType<typeof fixture> | undefined;
afterEach(() => { f?.db.close(); f = undefined; });

const image = 'https://cdn.example.com/banner-refresh.jpg';
const old = new Date(Date.now() - 60 * 60 * 1000).toISOString();
const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();

function setup() {
  f = fixture();
  f.db.prepare(`
    INSERT INTO banners (id, store_id, image_url, title, starts_at, ends_at, is_active)
    VALUES ('banner-a', 'a', ?, 'Campanha', ?, ?, 1)
  `).run(image, future, null);
  return {
    refresh: () => f!.request('/api/public/stores/loja-a/banners', 'GET', undefined, null),
    getCount: () => (f!.db.prepare(
      "SELECT COUNT(*) AS n FROM analytics_events WHERE store_id='a'"
    ).get() as any).n as number
  };
}

describe('Atualização dos banners sem recarregar a vitrine', () => {
  it('campanha futura não é publicada no endpoint de atualização', async () => {
    const { refresh } = setup();
    const response = await refresh();
    expect(response.status).toBe(200);
    expect((await response.json() as any).banners).toEqual([]);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('início de campanha é refletido sem uma nova visita à home', async () => {
    const { refresh, getCount } = setup();
    expect((await (await refresh()).json() as any).banners).toHaveLength(0);
    f!.db.prepare("UPDATE banners SET starts_at = ? WHERE id='banner-a'").run(old);
    const response = await refresh();
    const result = (await response.json() as any).banners;
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('banner-a');
    expect(result[0].image_url).toBe(image);
    expect(getCount()).toBe(0);
  });

  it('fim do horário remove campanha na próxima consulta', async () => {
    const { refresh } = setup();
    f!.db.prepare("UPDATE banners SET starts_at = ?, ends_at = ? WHERE id='banner-a'")
      .run(old, future);
    expect((await (await refresh()).json() as any).banners).toHaveLength(1);
    f!.db.prepare("UPDATE banners SET ends_at = ? WHERE id='banner-a'").run(old);
    expect((await (await refresh()).json() as any).banners).toHaveLength(0);
  });

  it('desativação manual do banner tem efeito sem novo acesso ao catálogo', async () => {
    const { refresh } = setup();
    f!.db.prepare("UPDATE banners SET starts_at = ? WHERE id='banner-a'").run(old);
    expect((await (await refresh()).json() as any).banners).toHaveLength(1);
    f!.db.prepare("UPDATE banners SET is_active = 0 WHERE id='banner-a'").run();
    expect((await (await refresh()).json() as any).banners).toEqual([]);
  });

  it('não entrega campanhas de outra loja', async () => {
    const { refresh } = setup();
    f!.db.prepare("INSERT INTO banners (id,store_id,image_url) VALUES ('foreign','b',?)")
      .run('https://cdn.example.com/other-store.jpg');
    expect((await (await refresh()).json() as any).banners).toEqual([]);
    const resultB = await f!.request('/api/public/stores/loja-b/banners', 'GET', undefined, null);
    expect(resultB.status).toBe(200);
    expect((await resultB.json() as any).banners.map((b: any) => b.id)).toContain('foreign');
  });

  it('loja suspensa ou inexistente não fornece banners', async () => {
    const { refresh } = setup();
    f!.db.prepare("UPDATE stores SET status='suspended' WHERE id='a'").run();
    expect((await refresh()).status).toBe(404);
    expect((await f!.request('/api/public/stores/nao-existe/banners', 'GET', undefined, null)).status)
      .toBe(404);
  });

  it('listagem de banners e home mantêm a mesma lógica de visibilidade', async () => {
    const { refresh } = setup();
    f!.db.prepare("UPDATE banners SET starts_at = ?, ends_at = ? WHERE id='banner-a'")
      .run(old, future);
    const light = (await (await refresh()).json() as any).banners;
    const full = await f!.request('/api/public/stores/loja-a', 'GET', undefined, null);
    expect(full.status).toBe(200);
    expect((await full.json() as any).banners).toEqual(light);
  });
});
