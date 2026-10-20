import { afterEach, describe, expect, it } from 'vitest';
import { fixture } from './helpers';
import { nextBannerTransitionAt } from '../backend/src/utils/publicBanners';

let f: ReturnType<typeof fixture> | undefined;
afterEach(() => { f?.db.close(); f = undefined; });

const after = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();
function setup() {
  f = fixture();
  const transition = () => nextBannerTransitionAt(f!.env.DB as any, 'a');
  const add = (id: string, starts_at: string | null, ends_at: string | null,
               storeId = 'a', active = 1) =>
    f!.db.prepare(`
      INSERT INTO banners (id,store_id,image_url,is_active,starts_at,ends_at)
      VALUES (?,?,?, ?,?,?)
    `).run(id, storeId, 'https://example.com/' + id + '.png', active, starts_at, ends_at);
  return { transition, add };
}

describe('Próxima mudança dos banners: agendamento sem polling', () => {
  it('não inventa uma data quando não existem campanhas programadas', async () => {
    const { transition } = setup();
    expect(await transition()).toBeNull();
  });

  it('seleciona a campanha futura mais próxima', async () => {
    const { transition, add } = setup();
    const later = after(120);
    const sooner = after(30);
    add('later', later, null);
    add('sooner', sooner, null);
    expect(Math.abs(Date.parse((await transition())!) - Date.parse(sooner))).toBeLessThan(1000);
  });

  it('considera o término mais próximo de banner já ativo', async () => {
    const { transition, add } = setup();
    add('ending', after(-60), after(15));
    add('upcoming', after(90), null);
    expect(Math.abs(Date.parse((await transition())!) - Date.parse(after(15)))).toBeLessThan(1500);
  });

  it('não agenda transições de banners desabilitados ou outra loja', async () => {
    const { transition, add } = setup();
    add('other', after(5), null, 'b');
    add('disabled', after(10), null, 'a', 0);
    const visible = after(120);
    add('visible', visible, null, 'a', 1);
    expect(Math.abs(Date.parse((await transition())!) - Date.parse(visible))).toBeLessThan(1000);
  });

  it('ignora datas que já passaram', async () => {
    const { transition, add } = setup();
    add('past', after(-120), after(-30));
    expect(await transition()).toBeNull();
  });

  it('preserva a precisão do fuso explícito de datas programadas', async () => {
    const { transition, add } = setup();
    const timestamp = after(50);
    const instant = new Date(timestamp);
    const brazil = new Date(instant.getTime() - 3 * 60 * 60_000)
      .toISOString().replace('Z', '-03:00');
    add('offset', brazil, null);
    expect(Math.abs(Date.parse((await transition())!) - Date.parse(timestamp))).toBeLessThan(1000);
  });

  it('suporta datas legadas do SQLite em UTC sem sufixo Z', async () => {
    const { transition, add } = setup();
    const timestamp = new Date(Date.now() + 3 * 60 * 60_000);
    timestamp.setMilliseconds(0);
    const legacy = timestamp.toISOString().replace('T', ' ').replace('Z', '');
    add('legacy', legacy, null);
    expect(Math.abs(Date.parse((await transition())!) - timestamp.getTime())).toBeLessThan(1000);
  });

  it('agenda datas acima de 24 dias sem arredondar para o presente', async () => {
    const { transition, add } = setup();
    const distant = after(60 * 24 * 90);
    add('future-season', distant, null);
    expect(Math.abs(Date.parse((await transition())!) - Date.parse(distant))).toBeLessThan(1000);
  });
});
