import { afterEach, describe, expect, it } from 'vitest';
import { fixture } from './helpers';

/**
 * SQLite legada permite uma linha product_images com store_id diferente
 * do proprietário do produto. A API nunca deve confiar só em product_id.
 */
let f: ReturnType<typeof fixture> | undefined;
afterEach(() => { f?.db.close(); f = undefined; });

const ownImage = 'https://cdn.example.com/a-public.png';
const foreignImage = 'https://cdn.example.com/b-private.png';

function contaminatedFixture() {
  f = fixture();
  // Simula um banco legado anterior à migração 004: as triggers abaixo
  // existem em produção e BLOQUEIAM relações cruzadas. Apenas esta cópia
  // em memória remove as proteções para testar leitura defensiva de legado.
  f.db.exec(`
    DROP TRIGGER tenant_products_category_id_update;
    DROP TRIGGER tenant_products_brand_id_update;
    DROP TRIGGER tenant_product_images_product_id_insert;
    DROP TRIGGER tenant_analytics_events_product_id_insert;
  `);
  f.db.prepare(
    "UPDATE products SET category_id='cb', brand_id='brand-b', is_featured=1, is_on_sale=1 WHERE id='pa'"
  ).run();
  f.db.prepare(
    'INSERT INTO product_images(id, product_id, store_id, url, is_primary) VALUES (?, ?, ?, ?, 1)'
  ).run('img-a', 'pa', 'a', ownImage);
  // Dados antigos/corrompidos: o produto é da loja A; esta foto diz ser de B.
  f.db.prepare(
    'INSERT INTO product_images(id, product_id, store_id, url, is_primary) VALUES (?, ?, ?, ?, 1)'
  ).run('img-wrong-store', 'pa', 'b', foreignImage);
  return f;
}
async function get(path: string, authenticated = false) {
  const response = await f!.request(path, 'GET', undefined,
    authenticated ? f!.token() : null);
  expect(response.status).toBe(200);
  return response.json() as Promise<any>;
}

describe('Consultas da vitrine e do painel não cruzam lojas', () => {
  it('migração 004 impede relações cruzadas em gravações reais', () => {
    f = fixture();
    expect(() => f!.db.prepare(
      "UPDATE products SET category_id='cb' WHERE id='pa'"
    ).run()).toThrow(/tenant relation mismatch/);
    expect(() => f!.db.prepare(
      "INSERT INTO product_images (id,product_id,store_id,url) VALUES ('foreign','pa','b','https://example.com/foreign.jpg')"
    ).run()).toThrow(/tenant relation mismatch/);
    expect(() => f!.db.prepare(
      "INSERT INTO analytics_events (id,store_id,product_id,event_type) VALUES ('foreign-event','a','pb','product_view')"
    ).run()).toThrow(/tenant relation mismatch/);
  });

  it('home só mostra foto da própria loja em destaques e promoções', async () => {
    contaminatedFixture();
    const home = await get('/api/public/stores/loja-a');
    expect(home.featured).toHaveLength(1);
    expect(home.onSale).toHaveLength(1);
    expect(home.featured[0].primary_image).toBe(ownImage);
    expect(home.onSale[0].primary_image).toBe(ownImage);
    expect(home.featured[0].category_name).toBeNull();
    expect(home.onSale[0].category_name).toBeNull();
    expect(JSON.stringify(home)).not.toContain(foreignImage);
  });

  it('listagem pública exclui imagem e categoria de loja diferente', async () => {
    contaminatedFixture();
    const listing = await get('/api/public/stores/loja-a/products');
    expect(listing.pagination.total).toBe(1);
    expect(listing.products).toHaveLength(1);
    expect(listing.products[0].primary_image).toBe(ownImage);
    expect(listing.products[0].category_name).toBeNull();
    expect(listing.products[0].category_slug).toBeNull();

    const filtered = await get('/api/public/stores/loja-a/products?category=cat-b');
    expect(filtered.products).toEqual([]);
    expect(filtered.pagination.total).toBe(0);
  });

  it('página de produto nunca devolve foto nem marca estrangeira', async () => {
    contaminatedFixture();
    const detail = await get('/api/public/stores/loja-a/products/produto-a');
    expect(detail.images).toHaveLength(1);
    expect(detail.images[0].url).toBe(ownImage);
    expect(detail.product.category_name).toBeNull();
    expect(detail.product.brand_name).toBeNull();
    expect(JSON.stringify(detail)).not.toContain(foreignImage);
    expect(JSON.stringify(detail)).not.toContain('Marca B');
  });

  it('busca global escolhe imagem da loja correspondente ao produto', async () => {
    contaminatedFixture();
    const search = await get('/api/public/search?q=Produto%20A');
    const productA = search.products.find((product: any) => product.id === 'pa');
    expect(productA).toBeDefined();
    expect(productA.primary_image).toBe(ownImage);
    expect(JSON.stringify(productA)).not.toContain(foreignImage);
  });

  it('dashboard autenticado não duplica produtos nem usa foto estrangeira', async () => {
    contaminatedFixture();
    const dashboard = await get('/api/store/dashboard', true);
    expect(dashboard.stats.totalProducts).toBe(1);
    expect(dashboard.topProducts).toHaveLength(1);
    expect(dashboard.topProducts[0].image).toBe(ownImage);
  });

  it('lista de produtos no painel só conta fotos pertencentes à loja', async () => {
    contaminatedFixture();
    const listing = await get('/api/store/products', true);
    expect(listing.products).toHaveLength(1);
    expect(listing.products[0].primary_image).toBe(ownImage);
    expect(listing.products[0].images_count).toBe(1);
    expect(listing.products[0].category_name).toBeNull();
    expect(listing.products[0].brand_name).toBeNull();
  });

  it('analytics não relaciona eventos da loja A a produtos da loja B', async () => {
    contaminatedFixture();
    f!.db.prepare(
      "INSERT INTO analytics_events (id,store_id,product_id,event_type) VALUES ('ok-view','a','pa','product_view')"
    ).run();
    f!.db.prepare(
      "INSERT INTO analytics_events (id,store_id,product_id,event_type) VALUES ('bad-view','a','pb','product_view')"
    ).run();
    const response = await get('/api/store/analytics', true);
    expect(response.topProducts).toHaveLength(1);
    expect(response.topProducts[0].name).toBe('Produto A');
    expect(response.topProducts[0].views).toBe(1);
    expect(JSON.stringify(response)).not.toContain('Produto B');
  });

  it('categorias e marcas válidas da loja continuam aparecendo normalmente', async () => {
    contaminatedFixture();
    f!.db.prepare(
      "INSERT INTO brands (id,store_id,name,slug) VALUES ('brand-a','a','Marca A','marca-a')"
    ).run();
    f!.db.prepare(
      "UPDATE products SET category_id='ca', brand_id='brand-a' WHERE id='pa'"
    ).run();
    const listing = await get('/api/public/stores/loja-a/products');
    expect(listing.products[0].category_name).toBe('Cat A');
    expect(listing.products[0].primary_image).toBe(ownImage);
    const detail = await get('/api/public/stores/loja-a/products/produto-a');
    expect(detail.product.category_name).toBe('Cat A');
    expect(detail.product.brand_name).toBe('Marca A');
    const admin = await get('/api/store/products', true);
    expect(admin.products[0].brand_name).toBe('Marca A');
  });

  it('fotos principais duplicadas não duplicam produtos ou resultados públicos', async () => {
    contaminatedFixture();
    // Dois uploads concorrentes podem manter is_primary=1 na mesma loja.
    f!.db.prepare(
      'INSERT INTO product_images (id,product_id,store_id,url,is_primary,sort_order) VALUES (?,?,?,?,1,10)'
    ).run('img-second-primary', 'pa', 'a', 'https://cdn.example.com/secondary.png');

    const home = await get('/api/public/stores/loja-a');
    expect(home.featured).toHaveLength(1);
    expect(home.onSale).toHaveLength(1);
    expect(home.featured[0].primary_image).toBe(ownImage);

    const listing = await get('/api/public/stores/loja-a/products');
    expect(listing.products).toHaveLength(1);
    expect(listing.pagination.total).toBe(1);
    expect(listing.products[0].primary_image).toBe(ownImage);

    const search = await get('/api/public/search?q=Produto%20A');
    expect(search.products.filter((p: any) => p.id === 'pa')).toHaveLength(1);

    const dashboard = await get('/api/store/dashboard', true);
    expect(dashboard.topProducts).toHaveLength(1);
    expect(dashboard.topProducts[0].image).toBe(ownImage);
  });

  it('a loja B continua acessível sem receber a imagem indevidamente vinculada a A', async () => {
    contaminatedFixture();
    const b = await get('/api/public/stores/loja-b/products');
    expect(b.products).toHaveLength(1);
    expect(b.products[0].id).toBe('pb');
    expect(b.products[0].primary_image).toBeNull();
  });
});
