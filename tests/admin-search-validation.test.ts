import { afterEach, describe, expect, it } from 'vitest';
import { fixture } from './helpers';

let f: ReturnType<typeof fixture> | undefined;
afterEach(() => { f?.db.close(); f = undefined; });

const listing = (query: string) =>
  f!.request('/api/store/products' + query, 'GET');

describe('Listagem administrativa: busca literal e paginação segura', () => {
  it('busca símbolo % como caractere literal sem mostrar todos os produtos', async () => {
    f = fixture();
    f.db.prepare(
      "INSERT INTO products (id,store_id,name,slug,price) VALUES ('percent','a','Sofá 10%','sofa-percent',110)"
    ).run();
    const response = await listing('?q=%25');
    expect(response.status).toBe(200);
    const result = await response.json() as any;
    expect(result.products.map((p: any) => p.id)).toEqual(['percent']);
    expect(result.pagination.total).toBe(1);
  });

  it('busca _ como caractere literal, não curinga SQL', async () => {
    f = fixture();
    f.db.prepare(
      "INSERT INTO products (id,store_id,name,slug,price) VALUES ('underscore','a','Mesa_Azul','mesa-azul',90)"
    ).run();
    const result = await (await listing('?q=_')).json() as any;
    expect(result.products.map((p: any) => p.id)).toEqual(['underscore']);
    expect(result.pagination.total).toBe(1);
  });

  it('não permite termo de busca de outra loja escapar para o resultado', async () => {
    f = fixture();
    const result = await (await listing('?q=Produto%20B')).json() as any;
    expect(result.products).toEqual([]);
    expect(result.pagination.total).toBe(0);
  });

  it('busca texto normal mantendo produtos existentes', async () => {
    f = fixture();
    const result = await (await listing('?q=%20Produto%20A%20')).json() as any;
    expect(result.products.map((p: any) => p.id)).toEqual(['pa']);
    expect(result.pagination.total).toBe(1);
  });

  it.each(['0', '-1', '1abc', '1e4', '01', '10001', '999999999999999999'])
  ('rejeita página inválida: %s', async page => {
    f = fixture();
    expect((await listing('?page=' + encodeURIComponent(page))).status).toBe(400);
  });

  it.each(['0', '-1', '1e2', '101', '999999999999999999', '20.1'])
  ('rejeita tamanho de página inválido: %s', async limit => {
    f = fixture();
    expect((await listing('?limit=' + encodeURIComponent(limit))).status).toBe(400);
  });

  it('aceita o limite máximo da API administrativa de 100 produtos', async () => {
    f = fixture();
    const response = await listing('?page=10000&limit=100');
    expect(response.status).toBe(200);
    const result = await response.json() as any;
    expect(result.pagination).toMatchObject({ page: 10000, limit: 100 });
  });

  it('rejeita busca muito longa e caracteres de controle', async () => {
    f = fixture();
    expect((await listing('?q=' + 'A'.repeat(121))).status).toBe(400);
    expect((await listing('?q=nome%0Ainvalido')).status).toBe(400);
  });

  it('mantém paginação e total coerentes quando aplica filtro de status', async () => {
    f = fixture();
    f.db.prepare(
      "INSERT INTO products (id,store_id,name,slug,price,status) VALUES ('draft','a','Produto A novo','produto-a-novo',12,'draft')"
    ).run();
    const result = await (await listing('?q=Produto%20A&status=published')).json() as any;
    expect(result.pagination.total).toBe(1);
    expect(result.products.map((p: any) => p.id)).toEqual(['pa']);
  });
});
