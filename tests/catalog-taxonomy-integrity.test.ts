import { afterEach, describe, expect, it } from 'vitest';
import { fixture } from './helpers';

let f: ReturnType<typeof fixture> | undefined;
afterEach(() => { f?.db.close(); f = undefined; });

function setup() {
  f = fixture();
  const req = (path: string, method: string, data?: unknown) =>
    f!.request('/api/store' + path, method, data);
  const category = (id: string) =>
    f!.db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as any;
  const brand = (id: string) =>
    f!.db.prepare('SELECT * FROM brands WHERE id = ?').get(id) as any;
  return { req, category, brand };
}

describe('Categorias e marcas: consistência e isolamento entre lojas', () => {
  it('categoria duplicada na própria loja retorna 409, não 500', async () => {
    const { req } = setup();
    const before = (f!.db.prepare("SELECT COUNT(*) AS n FROM categories WHERE store_id='a'").get() as any).n;
    const response = await req('/categories', 'POST', { name: 'Outra categoria', slug: 'cat-a' });
    expect(response.status).toBe(409);
    expect((f!.db.prepare("SELECT COUNT(*) AS n FROM categories WHERE store_id='a'").get() as any).n).toBe(before);
  });

  it('duas categorias simultâneas com o mesmo slug criam apenas uma linha', async () => {
    const { req } = setup();
    const responses = await Promise.all([
      req('/categories', 'POST', { name: 'Sofás' }),
      req('/categories', 'POST', { name: 'Sofás' })
    ]);
    expect(responses.map(r => r.status).sort()).toEqual([201, 409]);
    expect((f!.db.prepare("SELECT COUNT(*) AS n FROM categories WHERE slug='sofas' AND store_id='a'").get() as any).n).toBe(1);
  });

  it('categoria nova respeita posição e flag inativa', async () => {
    const { req } = setup();
    const response = await req('/categories', 'POST', {
      name: 'Móveis', parent_id: 'ca', sort_order: 5, is_active: false
    });
    expect(response.status).toBe(201);
    const { category } = await response.json() as any;
    expect(category).toMatchObject({
      store_id: 'a', slug: 'moveis', parent_id: 'ca', sort_order: 5, is_active: 0
    });
  });

  it('não permite categoria filha de outra loja', async () => {
    const { req } = setup();
    const response = await req('/categories', 'POST', { name: 'Invasora', parent_id: 'cb' });
    expect(response.status).toBe(400);
    expect(f!.db.prepare("SELECT id FROM categories WHERE slug='invasora'").get()).toBeUndefined();
  });

  it('rejeita slug sem caracteres utilizáveis', async () => {
    const { req } = setup();
    expect((await req('/categories', 'POST', { name: '🚀🚀' })).status).toBe(400);
    expect((await req('/brands', 'POST', { name: '🚀🚀' })).status).toBe(400);
  });

  it('categoria não pode apontar para si mesma', async () => {
    const { req, category } = setup();
    const response = await req('/categories/ca', 'PUT', { parent_id: 'ca', name: 'Não atualizar' });
    expect(response.status).toBe(400);
    expect(category('ca').name).toBe('Cat A');
    expect(category('ca').parent_id).toBeNull();
  });

  it('categoria não pode ser movida para uma descendente em três níveis', async () => {
    const { req, category } = setup();
    f!.db.exec(`
      INSERT INTO categories(id,store_id,name,slug,parent_id) VALUES
      ('c2','a','Nível 2','nivel-2','ca'),
      ('c3','a','Nível 3','nivel-3','c2'),
      ('c4','a','Nível 4','nivel-4','c3');
    `);
    const response = await req('/categories/ca', 'PUT', { parent_id: 'c4' });
    expect(response.status).toBe(400);
    expect(category('ca').parent_id).toBeNull();
  });

  it('recusa ciclo de 2 níveis mesmo se a outra categoria tiver filhos', async () => {
    const { req } = setup();
    f!.db.exec("INSERT INTO categories(id,store_id,name,slug,parent_id) VALUES ('c2','a','Filha','filha','ca')");
    expect((await req('/categories/ca', 'PUT', { parent_id: 'c2' })).status).toBe(400);
  });

  it('permite reorganizar filhos válidos e remover categoria pai', async () => {
    const { req, category } = setup();
    f!.db.exec("INSERT INTO categories(id,store_id,name,slug) VALUES ('c2','a','Nova categoria','nova-categoria')");
    expect((await req('/categories/c2', 'PUT', {
      parent_id: 'ca', sort_order: 3, is_active: false
    })).status).toBe(200);
    expect(category('c2')).toMatchObject({ parent_id: 'ca', sort_order: 3, is_active: 0 });
    expect((await req('/categories/c2', 'PUT', { parent_id: null })).status).toBe(200);
    expect(category('c2').parent_id).toBeNull();
  });

  it('categoria não pode usar slug de outra categoria da mesma loja', async () => {
    const { req, category } = setup();
    f!.db.exec("INSERT INTO categories(id,store_id,name,slug) VALUES ('c2','a','Segunda','segunda')");
    expect((await req('/categories/c2', 'PUT', {
      slug: 'cat-a', name: 'Não modificar'
    })).status).toBe(409);
    expect(category('c2')).toMatchObject({ name: 'Segunda', slug: 'segunda' });
  });

  it('categoria estrangeira não pode ser editada nem removida', async () => {
    const { req, category } = setup();
    expect((await req('/categories/cb', 'PUT', { name: 'Ataque' })).status).toBe(404);
    expect((await req('/categories/cb', 'DELETE')).status).toBe(404);
    expect(category('cb').name).toBe('Cat B');
  });

  it('slug de categoria pode coincidir entre lojas', async () => {
    const { req } = setup();
    const response = await req('/categories', 'POST', {
      name: 'Categoria com slug da loja B', slug: 'cat-b'
    });
    expect(response.status).toBe(201);
    expect((await response.json() as any).category.store_id).toBe('a');
  });

  it('marca duplicada na própria loja retorna conflito 409', async () => {
    const { req, brand } = setup();
    const created = await req('/brands', 'POST', { name: 'Brastemp' });
    expect(created.status).toBe(201);
    const id = (await created.json() as any).brand.id;
    expect((await req('/brands', 'POST', { name: 'Brastemp' })).status).toBe(409);
    expect(brand(id).slug).toBe('brastemp');
  });

  it('marca pode repetir slug de outra loja, mas não da própria', async () => {
    const { req } = setup();
    const response = await req('/brands', 'POST', { name: 'Marca B' });
    expect(response.status).toBe(201);
    expect((await response.json() as any).brand.store_id).toBe('a');
  });

  it('alteração de slug da marca funciona sem alterar seu nome', async () => {
    const { req, brand } = setup();
    const response = await req('/brands/brand-b', 'PUT', { slug: 'novo-slug' });
    expect(response.status).toBe(404);
    expect(brand('brand-b').slug).toBe('marca-b');
    const created = await req('/brands', 'POST', { name: 'Consul' });
    const id = (await created.json() as any).brand.id;
    expect((await req('/brands/' + id, 'PUT', { slug: 'consul-premium' })).status).toBe(200);
    expect(brand(id)).toMatchObject({ name: 'Consul', slug: 'consul-premium' });
  });

  it('edição não permite usar slug de marca já existente', async () => {
    const { req, brand } = setup();
    const a = await req('/brands', 'POST', { name: 'Marca A' });
    const b = await req('/brands', 'POST', { name: 'Marca Especial' });
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    const id = (await b.json() as any).brand.id;
    expect((await req('/brands/' + id, 'PUT', { name: 'Outra', slug: 'marca-a' })).status).toBe(409);
    expect(brand(id)).toMatchObject({ name: 'Marca Especial', slug: 'marca-especial' });
  });

  it('marca de outra loja não pode ser excluída e exclusão inexistente retorna 404', async () => {
    const { req, brand } = setup();
    expect((await req('/brands/brand-b', 'DELETE')).status).toBe(404);
    expect((await req('/brands/missing', 'DELETE')).status).toBe(404);
    expect(brand('brand-b').name).toBe('Marca B');
  });

  it('remoção de categoria usada pelo produto preserva o produto', async () => {
    const { req } = setup();
    expect((await req('/categories/ca', 'DELETE')).status).toBe(200);
    const product = f!.db.prepare("SELECT category_id, store_id FROM products WHERE id='pa'").get() as any;
    expect(product).toMatchObject({ category_id: null, store_id: 'a' });
  });

  it('remoção de marca não apaga produtos vinculados a ela', async () => {
    const { req } = setup();
    f!.db.exec("UPDATE products SET brand_id='brand-b' WHERE id='pb'");
    expect((await req('/brands/brand-b', 'DELETE')).status).toBe(404);
    expect((f!.db.prepare("SELECT id FROM products WHERE id='pb'").get() as any).id).toBe('pb');
  });
});
