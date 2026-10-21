import { afterEach, describe, expect, it } from 'vitest';
import { fixture } from './helpers';

let f: ReturnType<typeof fixture> | undefined;
afterEach(() => { f?.db.close(); f = undefined; });

function setup() {
  f = fixture();
  f.db.exec(`
    INSERT INTO stores (id,name,slug,email) VALUES
    ('percentage','Loja 10%','loja-10-percent','pct@example.com'),
    ('underscore','Loja_Móveis','loja-moveis-underline','underscore@example.com');
  `);
  const root = f.token('root', null, 'super_admin');
  const search = (query: string) =>
    f!.request('/api/superadmin/stores' + query, 'GET', undefined, root);
  return { search };
}

describe('Busca do superadministrador não interpreta filtros como SQL LIKE', () => {
  it('pesquisa símbolo % literalmente sem retornar todas as lojas', async () => {
    const { search } = setup();
    const response = await search('?q=%25');
    expect(response.status).toBe(200);
    const { stores } = await response.json() as any;
    expect(stores.map((s: any) => s.id)).toEqual(['percentage']);
  });

  it('pesquisa sublinhado como caractere, não como curinga', async () => {
    const { search } = setup();
    const response = await search('?q=_');
    expect(response.status).toBe(200);
    const { stores } = await response.json() as any;
    expect(stores.map((s: any) => s.id)).toEqual(['underscore']);
  });

  it('normaliza espaços sem perder busca normal de uma loja', async () => {
    const { search } = setup();
    const response = await search('?q=%20Loja%20A%20');
    expect(response.status).toBe(200);
    const { stores } = await response.json() as any;
    expect(stores.map((s: any) => s.id)).toEqual(['a']);
  });

  it('preserva filtro de status junto da busca literal', async () => {
    const { search } = setup();
    f!.db.prepare("UPDATE stores SET status = 'suspended' WHERE id = 'percentage'").run();
    const response = await search('?q=%25&status=active');
    expect(response.status).toBe(200);
    expect((await response.json() as any).stores).toEqual([]);
  });

  it('não exibe lojas com exclusão lógica na busca', async () => {
    const { search } = setup();
    f!.db.prepare("UPDATE stores SET status = 'deleted' WHERE id = 'percentage'").run();
    const { stores } = await (await search('?q=%25')).json() as any;
    expect(stores).toEqual([]);
  });

  it('rejeita busca excessivamente longa ou caracteres de controle', async () => {
    const { search } = setup();
    expect((await search('?q=' + 'a'.repeat(121))).status).toBe(400);
    expect((await search('?q=abc%0Adef')).status).toBe(400);
  });

  it('admin de loja não pode pesquisar dados administrativos globais', async () => {
    setup();
    expect((await f!.request('/api/superadmin/stores?q=a', 'GET')).status).toBe(403);
  });
});
