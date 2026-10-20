import { afterEach, describe, expect, it } from 'vitest';
import { fixture } from './helpers';
import { escapePublicLike, parseCatalogPagination, parsePublicSearch } from '../backend/src/utils/publicSearch';

let f: ReturnType<typeof fixture> | undefined;
afterEach(() => { f?.db.close(); f = undefined; });
const listing = (query = '') => f!.request('/api/public/stores/loja-a/products' + query, 'GET', undefined, null);
const globalSearch = (query = '') => f!.request('/api/public/search' + query, 'GET', undefined, null);

describe('Busca pública: validação e isolamento de tenant', () => {
  it.each(['0', '-1', '1abc', '1e4', '01', '10001', '999999999999999999999', '1.2'])
  ('rejeita página inválida %s', async (page) => {
    f = fixture();
    expect((await listing('?page=' + encodeURIComponent(page))).status).toBe(400);
  });
  it.each(['0', '-1', '12abc', '1e2', '51', '999999999999999999999', 'NaN'])
  ('rejeita limite inválido %s', async (limit) => {
    f = fixture();
    expect((await listing('?limit=' + encodeURIComponent(limit))).status).toBe(400);
  });
  it('aceita limites máximos sem sobrecarregar o banco', async () => {
    f = fixture();
    const response = await listing('?page=10000&limit=50');
    expect(response.status).toBe(200);
    expect((await response.json() as any).pagination).toMatchObject({ page: 10000, limit: 50 });
  });
  it('busca caracteres coringa como texto literal e preserva contagem', async () => {
    f = fixture();
    f.db.exec("INSERT INTO products(id,store_id,name,slug,price,status) VALUES ('pct','a','Oferta 10%','oferta-pct',10,'published'),('und','a','Produto A_B','a-b',10,'published'),('other','b','Oferta 10%','oferta-outro',10,'published')");
    const percent = await (await listing('?q=%25')).json() as any;
    expect(percent.products.map((p: any) => p.id)).toEqual(['pct']);
    expect(percent.pagination.total).toBe(1);
    const underscore = await (await listing('?q=_')).json() as any;
    expect(underscore.products.map((p: any) => p.id)).toEqual(['und']);
    expect(underscore.pagination.total).toBe(1);
    expect((await (await globalSearch('?q=10%25')).json() as any).products).toHaveLength(2);
  });
  it('rejeita termos excessivos e controles', async () => {
    f = fixture();
    expect((await listing('?q=' + 'x'.repeat(121))).status).toBe(400);
    expect((await globalSearch('?q=' + 'x'.repeat(121))).status).toBe(400);
    expect((await listing('?q=a%0Ab')).status).toBe(400);
  });
  it('normaliza espaços e não quebra termos legítimos', async () => {
    f = fixture();
    const response = await listing('?q=%20Produto%20A%20');
    expect(response.status).toBe(200);
    expect((await response.json() as any).products.map((p: any) => p.id)).toEqual(['pa']);
  });
  it('utilitários mantêm os filtros seguros', () => {
    expect(parseCatalogPagination(undefined, undefined)).toEqual({ page: 1, limit: 12, offset: 0 });
    expect(parsePublicSearch('  teste  ')).toEqual({ valid: true, term: 'teste' });
    expect(escapePublicLike('10%_\\')).toBe('%10\\%\\_\\\\%');
  });
});
