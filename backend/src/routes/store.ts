import { Hono } from 'hono';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { zValidator } from '../middleware/validation.js';
import { createProductSchema, createCategorySchema, createBrandSchema, createBannerSchema, publicLinkSchema, aiGenerateSchema } from '../utils/validation.js';
import { slugify } from '../utils/slug.js';
import { resolveAIInputImage } from '../utils/aiImage.js';
import { saveGeneratedImage } from '../services/aiGeneratedStorage.js';
import { generateProductImage, generateProductDescription, AI_STYLES } from '../services/ai.js';

type Env = {
  Bindings: {
    DB: D1Database;
    STORAGE: R2Bucket;
    STORAGE_PUBLIC: R2Bucket;
    JWT_SECRET: string;
    OPENAI_API_KEY?: string;
    AI_PROVIDER?: string;
    AI_ENABLED?: string;
    R2_PUBLIC_URL?: string;
  };
  Variables: { user: any; storeId: string };
};

const store = new Hono<Env>();

store.use('*', authMiddleware as any);
store.use('*', requireRole('store_admin', 'super_admin') as any);

// Helper: obtém storeId seguro (do token ou query para super_admin)
function getStoreId(c: any): string {
  const user = c.get('user');
  if (user.role === 'super_admin') {
    const queryStore = c.req.query('storeId');
    if (queryStore) return queryStore;
  }
  return c.get('storeId') || user.storeId;
}

// Resolve tenant once, before every handler. Query parameters never override a store administrator.
store.use('*', async (c, next) => {
  const storeId = getStoreId(c);
  if (!storeId) return c.json({ error: 'Selecione uma loja' }, 400);
  const tenant = await c.env.DB.prepare("SELECT id FROM stores WHERE id = ? AND status != 'deleted'").bind(storeId).first();
  if (!tenant) return c.json({ error: 'Loja não encontrada' }, 404);
  c.set('storeId', storeId);
  await next();
});

async function validRelations(c: any, data: any, storeId: string) {
  for (const [field, table] of [['category_id', 'categories'], ['brand_id', 'brands'], ['parent_id', 'categories']]) {
    if (data[field] && !await c.env.DB.prepare(`SELECT id FROM ${table} WHERE id = ? AND store_id = ?`).bind(data[field], storeId).first()) return false;
  }
  return true;
}

// =====================
// DASHBOARD
// =====================
store.get('/dashboard', async (c) => {
  const storeId = getStoreId(c);
  const db = c.env.DB;

  const totalProducts = await db.prepare('SELECT COUNT(*) as count FROM products WHERE store_id = ?').bind(storeId).first() as any;
  const published = await db.prepare("SELECT COUNT(*) as count FROM products WHERE store_id = ? AND status = 'published'").bind(storeId).first() as any;
  const draft = await db.prepare("SELECT COUNT(*) as count FROM products WHERE store_id = ? AND status = 'draft'").bind(storeId).first() as any;
  const outOfStock = await db.prepare("SELECT COUNT(*) as count FROM products WHERE store_id = ? AND status = 'out_of_stock'").bind(storeId).first() as any;
  const featured = await db.prepare('SELECT COUNT(*) as count FROM products WHERE store_id = ? AND is_featured = 1').bind(storeId).first() as any;
  const onSale = await db.prepare('SELECT COUNT(*) as count FROM products WHERE store_id = ? AND is_on_sale = 1').bind(storeId).first() as any;
  
  const visits = await db.prepare("SELECT COUNT(*) as count FROM analytics_events WHERE store_id = ? AND event_type = 'catalog_view'").bind(storeId).first() as any;
  const clicks = await db.prepare("SELECT COUNT(*) as count FROM analytics_events WHERE store_id = ? AND event_type = 'whatsapp_click'").bind(storeId).first() as any;

  const topProducts = await db.prepare(`
    SELECT p.id, p.name, p.slug, p.views, p.clicks, pi.url as image
    FROM products p
    LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
    WHERE p.store_id = ? ORDER BY p.views DESC LIMIT 5
  `).bind(storeId).all();

  const recentProducts = await db.prepare('SELECT id, name, status, created_at FROM products WHERE store_id = ? ORDER BY created_at DESC LIMIT 5').bind(storeId).all();

  return c.json({
    stats: {
      totalProducts: totalProducts?.count || 0,
      published: published?.count || 0,
      draft: draft?.count || 0,
      outOfStock: outOfStock?.count || 0,
      featured: featured?.count || 0,
      onSale: onSale?.count || 0,
      visits: visits?.count || 0,
      clicks: clicks?.count || 0,
    },
    topProducts: (topProducts as any).results || topProducts,
    recentProducts: (recentProducts as any).results || recentProducts
  });
});

// =====================
// PRODUCTS
// =====================
store.get('/products', async (c) => {
  const storeId = getStoreId(c);
  const q = c.req.query('q');
  const category = c.req.query('category');
  const status = c.req.query('status');
  const featured = c.req.query('featured');
  const page = Math.max(1, Number.parseInt(c.req.query('page') || '1') || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(c.req.query('limit') || '20') || 20));
  const offset = (page - 1) * limit;

  let query = `
    SELECT p.*, c.name as category_name, c.slug as category_slug, b.name as brand_name,
      (SELECT url FROM product_images WHERE product_id = p.id AND is_primary=1 LIMIT 1) as primary_image,
      (SELECT COUNT(*) FROM product_images WHERE product_id = p.id) as images_count
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN brands b ON p.brand_id = b.id
    WHERE p.store_id = ?
  `;
  const params: any[] = [storeId];

  if (q) {
    query += ' AND (p.name LIKE ? OR p.sku LIKE ? OR p.description LIKE ?)';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (category) {
    query += ' AND p.category_id = ?';
    params.push(category);
  }
  if (status && status !== 'all') {
    query += ' AND p.status = ?';
    params.push(status);
  }
  if (featured === 'true') {
    query += ' AND p.is_featured = 1';
  }

  query += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const products = await c.env.DB.prepare(query).bind(...params).all();
  
  // Total count
  let countQuery = 'SELECT COUNT(*) as count FROM products WHERE store_id = ?';
  const countParams: any[] = [storeId];
  if (q) {
    countQuery += ' AND (name LIKE ? OR sku LIKE ? OR description LIKE ?)';
    countParams.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (status && status !== 'all') {
    countQuery += ' AND status = ?';
    countParams.push(status);
  }
  if (category) { countQuery += ' AND category_id = ?'; countParams.push(category); }
  if (featured === 'true') countQuery += ' AND is_featured = 1';
  const total = await c.env.DB.prepare(countQuery).bind(...countParams).first() as any;

  return c.json({
    products: (products as any).results || products,
    pagination: { page, limit, total: total?.count || 0, pages: Math.ceil((total?.count || 0) / limit) }
  });
});

store.get('/products/:id', async (c) => {
  const storeId = getStoreId(c);
  const id = c.req.param('id');
  
  const product = await c.env.DB.prepare('SELECT * FROM products WHERE id = ? AND store_id = ?').bind(id, storeId).first() as any;
  if (!product) return c.json({ error: 'Produto não encontrado' }, 404);

  const images = await c.env.DB.prepare('SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order, created_at').bind(id).all();
  
  return c.json({ product, images: (images as any).results || images });
});

store.post('/products', zValidator('json', createProductSchema), async (c) => {
  const storeId = getStoreId(c);
  const data = c.req.valid('json');
  if (!await validRelations(c, data, storeId)) return c.json({ error: 'Referência não pertence à loja' }, 400);
  const user = c.get('user');

  const productId = crypto.randomUUID();
  const baseSlug = data.slug ? slugify(data.slug) : slugify(data.name);
  let slug = baseSlug;

  // O índice UNIQUE resolve conflitos de slug inclusive em gravações simultâneas.
  const insertSql = `
    INSERT INTO products (id, store_id, sku, name, slug, short_description, description, price, original_price, promotional_price, category_id, brand_id, status, is_featured, is_on_sale, stock_quantity, dimensions, technical_specs, variations, published_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(store_id, slug) DO NOTHING
  `;
  const insertProduct = (candidateSlug: string) => c.env.DB.prepare(insertSql).bind(
    productId, storeId, data.sku || null, data.name, candidateSlug, data.short_description || null,
    data.description || null, data.price, data.original_price ?? null, data.promotional_price ?? null,
    data.category_id || null, data.brand_id || null, data.status || 'draft',
    data.is_featured ? 1 : 0, data.is_on_sale ? 1 : 0, data.stock_quantity || 0,
    data.dimensions || null, data.technical_specs || null, data.variations || null,
    data.status === 'published' ? new Date().toISOString() : null
  );

  const createBatch = (candidateSlug: string) => {
    const statements: D1PreparedStatement[] = [insertProduct(candidateSlug)];
    for (const [index, url] of (data.images || []).entries()) {
      // Uma tentativa sem INSERT (slug repetido) não pode inserir fotos órfãs.
      statements.push(c.env.DB.prepare(`
        INSERT INTO product_images (id, product_id, store_id, url, is_primary, sort_order)
        SELECT ?, ?, ?, ?, ?, ?
        WHERE EXISTS (SELECT 1 FROM products WHERE id = ? AND store_id = ?)
      `).bind(crypto.randomUUID(), productId, storeId, url, index === 0 ? 1 : 0,
        index, productId, storeId));
    }
    return c.env.DB.batch(statements);
  };

  // Informar conflito de SKU antes de inserir, sem vazar produtos de outra loja.
  // A restrição UNIQUE continua protegendo também requisições simultâneas.
  if (data.sku) {
    const taken = await c.env.DB.prepare(
      'SELECT id FROM products WHERE store_id = ? AND sku = ?'
    ).bind(storeId, data.sku).first();
    if (taken) return c.json({ error: 'SKU já utilizado nesta loja' }, 409);
  }

  try {
    const initialResults = await createBatch(slug);
    if (initialResults[0]?.meta?.changes === 0) {
      slug = `${baseSlug}-${productId}`;
      const retryResults = await createBatch(slug);
      if (retryResults[0]?.meta?.changes === 0) {
        return c.json({ error: 'Não foi possível gerar endereço único' }, 409);
      }
    }
  } catch (error) {
    // Em uma corrida, o SKU pode ser ocupado após a verificação inicial.
    // D1.batch reverte produto e imagens, preservando a atomicidade.
    const reason = String(error);
    if (data.sku && /UNIQUE constraint failed:\\s*products\\.store_id,\\s*products\\.sku/i.test(reason)) {
      return c.json({ error: 'SKU já utilizado nesta loja' }, 409);
    }
    throw error;
  }

  await c.env.DB.prepare(
    'INSERT INTO audit_logs (user_id, store_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(user.userId, storeId, 'create_product', 'product', productId, JSON.stringify({ name: data.name })).run().catch(()=>{});

  const product = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(productId).first();
  return c.json({ product, message: 'Produto criado com sucesso!' }, 201);
});

store.put('/products/:id', zValidator('json', createProductSchema.partial()), async (c) => {
  const storeId = getStoreId(c);
  const id = c.req.param('id');
  const data = c.req.valid('json');
  if (!await validRelations(c, data, storeId)) return c.json({ error: 'Referência não pertence à loja' }, 400);
  const user = c.get('user');

  const existing = await c.env.DB.prepare('SELECT * FROM products WHERE id = ? AND store_id = ?').bind(id, storeId).first() as any;
  if (!existing) return c.json({ error: 'Produto não encontrado' }, 404);

  const updates: string[] = [];
  const params: any[] = [];
  const allowed = ['sku','name','short_description','description','price','original_price','promotional_price','category_id','brand_id','status','stock_quantity','dimensions','technical_specs','variations'];
  
  for (const key of allowed as Extract<keyof typeof data, string>[]) {
    if (data[key] !== undefined) {
      updates.push(`${key} = ?`);
      params.push(key === 'sku' && !data[key] ? null : data[key]);
    }
  }
  if (data.is_featured !== undefined) { updates.push('is_featured = ?'); params.push(data.is_featured ? 1 : 0); }
  if (data.is_on_sale !== undefined) { updates.push('is_on_sale = ?'); params.push(data.is_on_sale ? 1 : 0); }
  if (data.slug) { updates.push('slug = ?'); params.push(slugify(data.slug)); }
  else if (data.name && data.name !== existing.name) { updates.push('slug = ?'); params.push(slugify(data.name)); }
  
  if (data.status === 'published' && existing.status !== 'published') {
    updates.push("published_at = datetime('now')");
  }
  
  if (updates.length === 0 && data.images === undefined) {
    return c.json({ error: 'Nenhum campo para atualizar' }, 400);
  }

  // Toda a edição é transacional, inclusive a remoção e inclusão de imagens.
  const statements: D1PreparedStatement[] = [];
  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    params.push(id, storeId);
    statements.push(c.env.DB.prepare(`UPDATE products SET ${updates.join(', ')} WHERE id = ? AND store_id = ?`).bind(...params));
  }

  if (data.images !== undefined) {
    // A lista enviada é o estado final desejado. Preservamos metadados de IA
    // e os IDs das imagens mantidas, sem deixar cópias duplicadas.
    const desiredUrls = [...new Set(data.images)];
    const current = await c.env.DB.prepare(
      'SELECT id, url FROM product_images WHERE product_id = ? AND store_id = ? ORDER BY is_ai_generated DESC, sort_order, created_at, id'
    ).bind(id, storeId).all();
    const currentRows = (current.results || []) as { id: string; url: string }[];
    const existingByUrl = new Map<string, string>();
    const duplicateIds = new Set<string>();
    for (const image of currentRows) {
      if (existingByUrl.has(image.url)) duplicateIds.add(image.id);
      else existingByUrl.set(image.url, image.id);
    }
    const desiredSet = new Set(desiredUrls);
    for (const image of currentRows) {
      if (!desiredSet.has(image.url) || duplicateIds.has(image.id)) {
        statements.push(c.env.DB.prepare(
          'DELETE FROM product_images WHERE id = ? AND product_id = ? AND store_id = ?'
        ).bind(image.id, id, storeId));
      }
    }
    for (let i = 0; i < desiredUrls.length; i++) {
      const url = desiredUrls[i];
      const imageId = existingByUrl.get(url);
      if (imageId) {
        statements.push(c.env.DB.prepare(
          'UPDATE product_images SET sort_order = ?, is_primary = ? WHERE id = ? AND product_id = ? AND store_id = ?'
        ).bind(i, i === 0 ? 1 : 0, imageId, id, storeId));
      } else {
        statements.push(c.env.DB.prepare(
          'INSERT INTO product_images (id, product_id, store_id, url, is_primary, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(crypto.randomUUID(), id, storeId, url, i === 0 ? 1 : 0, i));
      }
    }
  }

  if (statements.length > 0) await c.env.DB.batch(statements);

  await c.env.DB.prepare(
    'INSERT INTO audit_logs (user_id, store_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(user.userId, storeId, 'update_product', 'product', id, JSON.stringify(data)).run().catch(()=>{});

  const product = await c.env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();
  return c.json({ product, message: 'Produto atualizado com sucesso!' });
});

store.delete('/products/:id', async (c) => {
  const storeId = getStoreId(c);
  const id = c.req.param('id');
  const user = c.get('user');

  const existing = await c.env.DB.prepare('SELECT id FROM products WHERE id = ? AND store_id = ?').bind(id, storeId).first();
  if (!existing) return c.json({ error: 'Produto não encontrado' }, 404);

  await c.env.DB.prepare('DELETE FROM products WHERE id = ? AND store_id = ?').bind(id, storeId).run();
  
  await c.env.DB.prepare(
    'INSERT INTO audit_logs (user_id, store_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(user.userId, storeId, 'delete_product', 'product', id, JSON.stringify({})).run().catch(()=>{});

  return c.json({ message: 'Produto removido com sucesso' });
});

// POST /api/store/products/:id/duplicate
store.post('/products/:id/duplicate', async (c) => {
  const storeId = getStoreId(c);
  const id = c.req.param('id');
  const product = await c.env.DB.prepare('SELECT * FROM products WHERE id = ? AND store_id = ?').bind(id, storeId).first() as any;
  if (!product) return c.json({ error: 'Produto não encontrado' }, 404);

  const newId = crypto.randomUUID();
  // Identificadores únicos impedem colisões após várias duplicações consecutivas.
  const newSlug = `${product.slug}-copia-${newId}`;
  const newSku = product.sku ? `${product.sku}-COPY-${newId}` : null;
  const newName = `${product.name} (Cópia)`;

  // O batch do D1 grava produto e fotos em uma transação atômica.
  const insertProduct = c.env.DB.prepare(`
    INSERT INTO products (
      id, store_id, sku, name, slug, short_description, description, price, original_price, promotional_price, cost_price, category_id,
      brand_id, status, is_featured, is_on_sale, stock_quantity, stock_unlimited, weight, dimensions, technical_specs, variations, sort_order, seo_title, seo_description
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
  `).bind(
    newId, storeId, newSku, newName, newSlug, product.short_description, product.description, product.price, product.original_price, product.promotional_price, product.cost_price, product.category_id,
    product.brand_id, product.is_featured, product.is_on_sale, product.stock_quantity, product.stock_unlimited, product.weight, product.dimensions, product.technical_specs, product.variations, product.sort_order, product.seo_title, product.seo_description
  );

  // Copia imagens dentro da transação, sempre da mesma loja.
  // original_image_id permanece NULL: não aponta para o produto antigo.
  const copyImages = c.env.DB.prepare(`
    INSERT INTO product_images (
      id, product_id, store_id, url, thumbnail_url, medium_url, alt_text,
      is_primary, is_ai_generated, ai_style, ai_prompt, sort_order,
      file_size_kb, width, height
    )
    SELECT lower(hex(randomblob(16))), ?, ?, url, thumbnail_url, medium_url, alt_text,
      is_primary, is_ai_generated, ai_style, ai_prompt, sort_order,
      file_size_kb, width, height
    FROM product_images WHERE product_id = ? AND store_id = ?
  `).bind(newId, storeId, id, storeId);

  await c.env.DB.batch([insertProduct, copyImages]);
  const newProduct = await c.env.DB.prepare('SELECT * FROM products WHERE id = ? AND store_id = ?').bind(newId, storeId).first();
  return c.json({ product: newProduct, message: 'Produto duplicado com sucesso!' }, 201);
});
// =====================
// CATEGORIES
// =====================
store.get('/categories', async (c) => {
  const storeId = getStoreId(c);
  const categories = await c.env.DB.prepare('SELECT * FROM categories WHERE store_id = ? ORDER BY sort_order, name').bind(storeId).all();
  return c.json({ categories: (categories as any).results || categories });
});

store.post('/categories', zValidator('json', createCategorySchema), async (c) => {
  const storeId = getStoreId(c);
  const data = c.req.valid('json');
  if (!await validRelations(c, data, storeId)) return c.json({ error: 'Referência não pertence à loja' }, 400);
  const slug = data.slug ? slugify(data.slug) : slugify(data.name);
  
  const id = crypto.randomUUID();
  await c.env.DB.prepare('INSERT INTO categories (id, store_id, name, slug, description, parent_id, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(id, storeId, data.name, slug, data.description || null, data.parent_id || null, data.sort_order || 0).run();
  
  const category = await c.env.DB.prepare('SELECT * FROM categories WHERE id = ? AND store_id = ?').bind(id, storeId).first();
  if (!category) return c.json({ error: 'Recurso não encontrado' }, 404);
  return c.json({ category, message: 'Categoria criada!' }, 201);
});

store.put('/categories/:id', zValidator('json', createCategorySchema.partial()), async (c) => {
  const storeId = getStoreId(c);
  const id = c.req.param('id');
  const data = c.req.valid('json');
  if (!await validRelations(c, data, storeId)) return c.json({ error: 'Referência não pertence à loja' }, 400);
  
  const updates: string[] = [];
  const params: any[] = [];
  if (data.name) { updates.push('name = ?'); params.push(data.name); }
  if (data.slug) { updates.push('slug = ?'); params.push(slugify(data.slug)); }
  else if (data.name) { updates.push('slug = ?'); params.push(slugify(data.name)); }
  if (data.description !== undefined) { updates.push('description = ?'); params.push(data.description); }
  if (data.sort_order !== undefined) { updates.push('sort_order = ?'); params.push(data.sort_order); }
  if (data.parent_id !== undefined) { updates.push('parent_id = ?'); params.push(data.parent_id); }
  if (data.is_active !== undefined) { updates.push('is_active = ?'); params.push(data.is_active ? 1 : 0); }
  
  if (updates.length === 0) return c.json({ error: 'Nenhum campo para atualizar' }, 400);
  updates.push("updated_at = datetime('now')");
  params.push(id, storeId);
  
  await c.env.DB.prepare(`UPDATE categories SET ${updates.join(', ')} WHERE id = ? AND store_id = ?`).bind(...params).run();
  const category = await c.env.DB.prepare('SELECT * FROM categories WHERE id = ? AND store_id = ?').bind(id, storeId).first();
  if (!category) return c.json({ error: 'Recurso não encontrado' }, 404);
  return c.json({ category, message: 'Categoria atualizada!' });
});

store.delete('/categories/:id', async (c) => {
  const storeId = getStoreId(c);
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM categories WHERE id = ? AND store_id = ?').bind(id, storeId).run();
  return c.json({ message: 'Categoria removida' });
});

// =====================
// BRANDS
// =====================
store.get('/brands', async (c) => {
  const storeId = getStoreId(c);
  const brands = await c.env.DB.prepare('SELECT * FROM brands WHERE store_id = ? ORDER BY name').bind(storeId).all();
  return c.json({ brands: (brands as any).results || brands });
});

store.post('/brands', zValidator('json', createBrandSchema), async (c) => {
  const storeId = getStoreId(c);
  const data = c.req.valid('json');
  if (!await validRelations(c, data, storeId)) return c.json({ error: 'Referência não pertence à loja' }, 400);
  const slug = data.slug ? slugify(data.slug) : slugify(data.name);
  const id = crypto.randomUUID();
  await c.env.DB.prepare('INSERT INTO brands (id, store_id, name, slug, description) VALUES (?, ?, ?, ?, ?)').bind(id, storeId, data.name, slug, data.description || null).run();
  const brand = await c.env.DB.prepare('SELECT * FROM brands WHERE id = ? AND store_id = ?').bind(id, storeId).first();
  if (!brand) return c.json({ error: 'Recurso não encontrado' }, 404);
  return c.json({ brand, message: 'Marca criada!' }, 201);
});

store.put('/brands/:id', zValidator('json', createBrandSchema.partial()), async (c) => {
  const storeId = getStoreId(c);
  const id = c.req.param('id');
  const data = c.req.valid('json');
  if (!await validRelations(c, data, storeId)) return c.json({ error: 'Referência não pertence à loja' }, 400);
  const updates: string[] = [];
  const params: any[] = [];
  if (data.name) { updates.push('name = ?'); params.push(data.name); updates.push('slug = ?'); params.push(slugify(data.slug || data.name)); }
  if (data.description !== undefined) { updates.push('description = ?'); params.push(data.description); }
  if (updates.length === 0) return c.json({ error: 'Nenhum campo' }, 400);
  updates.push("updated_at = datetime('now')");
  params.push(id, storeId);
  await c.env.DB.prepare(`UPDATE brands SET ${updates.join(', ')} WHERE id = ? AND store_id = ?`).bind(...params).run();
  const brand = await c.env.DB.prepare('SELECT * FROM brands WHERE id = ? AND store_id = ?').bind(id, storeId).first();
  if (!brand) return c.json({ error: 'Recurso não encontrado' }, 404);
  return c.json({ brand, message: 'Marca atualizada!' });
});

store.delete('/brands/:id', async (c) => {
  const storeId = getStoreId(c);
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM brands WHERE id = ? AND store_id = ?').bind(id, storeId).run();
  return c.json({ message: 'Marca removida' });
});

// =====================
// BANNERS
// =====================
store.get('/banners', async (c) => {
  const storeId = getStoreId(c);
  const banners = await c.env.DB.prepare('SELECT * FROM banners WHERE store_id = ? ORDER BY sort_order, created_at DESC').bind(storeId).all();
  return c.json({ banners: (banners as any).results || banners });
});

store.post('/banners', zValidator('json', createBannerSchema), async (c) => {
  const storeId = getStoreId(c);
  const data = c.req.valid('json');
  if (!await validRelations(c, data, storeId)) return c.json({ error: 'Referência não pertence à loja' }, 400);
  const id = crypto.randomUUID();
  await c.env.DB.prepare('INSERT INTO banners (id, store_id, title, subtitle, image_url, link_url, button_text, position, is_active, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(id, storeId, data.title || null, data.subtitle || null, data.image_url, data.link_url || null, data.button_text || null, data.position || 'hero', data.is_active ? 1 : 0, data.sort_order || 0).run();
  const banner = await c.env.DB.prepare('SELECT * FROM banners WHERE id = ? AND store_id = ?').bind(id, storeId).first();
  if (!banner) return c.json({ error: 'Recurso não encontrado' }, 404);
  return c.json({ banner, message: 'Banner criado!' }, 201);
});

store.put('/banners/:id', zValidator('json', createBannerSchema.partial()), async (c) => {
  const storeId = getStoreId(c);
  const id = c.req.param('id');
  const data = c.req.valid('json');
  if (!await validRelations(c, data, storeId)) return c.json({ error: 'Referência não pertence à loja' }, 400);
  const updates: string[] = [];
  const params: any[] = [];
  const fields = ['title','subtitle','image_url','link_url','button_text','position','sort_order'];
  for (const f of fields as Extract<keyof typeof data, string>[]) if (data[f] !== undefined) { updates.push(`${f} = ?`); params.push(data[f]); }
  if (data.is_active !== undefined) { updates.push('is_active = ?'); params.push(data.is_active ? 1 : 0); }
  if (updates.length === 0) return c.json({ error: 'Nenhum campo' }, 400);
  updates.push("updated_at = datetime('now')");
  params.push(id, storeId);
  await c.env.DB.prepare(`UPDATE banners SET ${updates.join(', ')} WHERE id = ? AND store_id = ?`).bind(...params).run();
  const banner = await c.env.DB.prepare('SELECT * FROM banners WHERE id = ? AND store_id = ?').bind(id, storeId).first();
  if (!banner) return c.json({ error: 'Recurso não encontrado' }, 404);
  return c.json({ banner, message: 'Banner atualizado!' });
});

store.delete('/banners/:id', async (c) => {
  const storeId = getStoreId(c);
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM banners WHERE id = ? AND store_id = ?').bind(id, storeId).run();
  return c.json({ message: 'Banner removido' });
});

// =====================
// STORE SETTINGS
// =====================
store.get('/settings', async (c) => {
  const storeId = getStoreId(c);
  const storeData = await c.env.DB.prepare('SELECT * FROM stores WHERE id = ?').bind(storeId).first();
  if (!storeData) return c.json({ error: 'Loja não encontrada' }, 404);
  return c.json({ store: storeData });
});

store.put('/settings', async (c) => {
  const storeId = getStoreId(c);
  const data = await c.req.json() as any;
  const user = c.get('user');

  for (const field of ['logo_url', 'banner_url', 'website', 'facebook']) {
    if (data[field] && !publicLinkSchema.safeParse(data[field]).success) return c.json({ error: `URL inválida: ${field}` }, 400);
  }
  const allowed = ['name','description','logo_url','banner_url','primary_color','secondary_color','accent_color','address','city','state','zip_code','phone','whatsapp','email','instagram','facebook','website','opening_hours','seo_title','seo_description','seo_keywords'];
  const updates: string[] = [];
  const params: any[] = [];
  for (const key of allowed as Extract<keyof typeof data, string>[]) {
    if (data[key] !== undefined) {
      updates.push(`${key} = ?`);
      params.push(data[key]);
    }
  }
  if (data.slug) {
    updates.push('slug = ?');
    params.push(slugify(data.slug));
  }
  if (updates.length === 0) return c.json({ error: 'Nenhum campo para atualizar' }, 400);
  updates.push("updated_at = datetime('now')");
  params.push(storeId);

  await c.env.DB.prepare(`UPDATE stores SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();

  await c.env.DB.prepare(
    'INSERT INTO audit_logs (user_id, store_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(user.userId, storeId, 'update_store_settings', 'store', storeId, JSON.stringify(data)).run().catch(()=>{});

  const storeData = await c.env.DB.prepare('SELECT * FROM stores WHERE id = ?').bind(storeId).first();
  return c.json({ store: storeData, message: 'Configurações salvas com sucesso!' });
});

// =====================
// AI GENERATION
// =====================
store.post('/ai/generate', zValidator('json', aiGenerateSchema), async (c) => {
  const storeId = getStoreId(c);
  const user = c.get('user');
  const { image_url, style, product_id, generate_description, generate_image } = c.req.valid('json');

  if (c.env.AI_ENABLED !== 'true') return c.json({ error: 'IA indisponível' }, 503);
  if (product_id && !await c.env.DB.prepare('SELECT id FROM products WHERE id = ? AND store_id = ?').bind(product_id, storeId).first()) return c.json({ error: 'Produto não encontrado' }, 404);

  // Verifica limites
  const storeData = await c.env.DB.prepare('SELECT ai_enabled, ai_daily_limit, ai_monthly_limit FROM stores WHERE id = ?').bind(storeId).first() as any;
  if (!storeData?.ai_enabled) return c.json({ error: 'IA desabilitada para esta loja. Contate o Super Admin.' }, 403);

  // Zero significa nenhuma geração autorizada, não o limite padrão.
  const dailyLimit = Math.max(0, Number(storeData.ai_daily_limit ?? 10));
  const monthlyLimit = Math.max(0, Number(storeData.ai_monthly_limit ?? 100));
  if (dailyLimit === 0 || monthlyLimit === 0) {
    return c.json({ error: 'A IA não está disponível para este plano.' }, 429);
  }
  const todayCount = await c.env.DB.prepare(
    "SELECT COUNT(*) AS count FROM ai_generations WHERE store_id = ? AND date(created_at) = date('now')"
  ).bind(storeId).first() as any;
  if (Number(todayCount?.count ?? 0) >= dailyLimit) {
    return c.json({ error: 'Limite diário de IA atingido.' }, 429);
  }
  const monthCount = await c.env.DB.prepare(
    "SELECT COUNT(*) AS count FROM ai_generations WHERE store_id = ? AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')"
  ).bind(storeId).first() as any;
  if (Number(monthCount?.count ?? 0) >= monthlyLimit) {
    return c.json({ error: 'Limite mensal de IA atingido.' }, 429);
  }

  // Verifica se IA está configurada
  const apiKey = c.env.OPENAI_API_KEY;
  if (!apiKey) {
    return c.json({ 
      error: 'IA não configurada',
      message: 'A funcionalidade de IA está indisponível. O Super Administrador precisa configurar a chave da OpenAI nas variáveis de ambiente (OPENAI_API_KEY).',
      configured: false
    }, 503);
  }

  // Imagens privadas só podem ser obtidas no armazenamento da loja autenticada.
  // Rejeitar entrada inválida antes de reservar cotas ou enviar dados a provedores.
  const resolvedImage = await resolveAIInputImage(image_url, storeId, c.env.STORAGE);
  if (!resolvedImage.ok) {
    return c.json({ error: resolvedImage.error }, resolvedImage.status);
  }
  const aiImageUrl = resolvedImage.url;
  if (generate_image && !/^data:image\/(?:png|jpeg|webp);base64,/.test(aiImageUrl)) {
    return c.json({ error: 'Para editar com IA, envie uma foto JPG, PNG ou WebP para esta loja' }, 400);
  }

  // A reserva é atômica: duas requisições não podem ultrapassar as cotas
  // após a verificação preliminar. O serviço pago só é chamado depois dela.
  const generationId = crypto.randomUUID();
  const reservation = await c.env.DB.prepare(`
    INSERT INTO ai_generations
      (id, store_id, user_id, product_id, type, status, input_image_url, input_prompt, ai_model, ai_style)
    SELECT ?, s.id, ?, ?, 'full_ad', 'processing', ?, ?, ?, ?
    FROM stores AS s
    WHERE s.id = ? AND s.ai_enabled = 1
      AND (SELECT COUNT(*) FROM ai_generations AS g
           WHERE g.store_id = s.id AND date(g.created_at) = date('now'))
          < COALESCE(s.ai_daily_limit, 10)
      AND (SELECT COUNT(*) FROM ai_generations AS g
           WHERE g.store_id = s.id AND strftime('%Y-%m', g.created_at) = strftime('%Y-%m', 'now'))
          < COALESCE(s.ai_monthly_limit, 100)
  `).bind(generationId, user.userId, product_id || null, image_url,
    `style:${style}`, c.env.AI_PROVIDER || 'openai/gpt-4o', style, storeId).run();
  if (reservation.meta?.changes !== 1) {
    return c.json({ error: 'Limite diário ou mensal de IA atingido.' }, 429);
  }

  let generatedObjectKey: string | null = null;
  try {
    const config = {
      enabled: true,
      provider: 'openai',
      apiKey,
      model: 'gpt-4o',
      imageModel: 'gpt-image-2.5-flare'
    };

    let result: any = {};

    if (generate_description) {
      const storeCtx = await c.env.DB.prepare('SELECT name, description FROM stores WHERE id = ?').bind(storeId).first() as any;
      const descResult = await generateProductDescription(config as any, aiImageUrl, storeCtx?.name);
      result = { ...result, ...descResult };
    }

    if (generate_image) {
      try {
        const imgResult = await generateProductImage(config as any, aiImageUrl, style, result.name);
        // Nunca devolver links temporários ou base64 ao navegador.
        const stored = await saveGeneratedImage(
          c.env.STORAGE, storeId, product_id || null, imgResult.imageBase64
        );
        generatedObjectKey = stored.key;
        result.imageUrl = stored.url;
        result.imageModel = imgResult.model;
        result.cost = (result.cost || 0) + imgResult.cost;
      } catch (imgErr: any) {
        console.error('Falha na etapa de imagem da IA');
        // Um pedido apenas de imagem não pode ser marcado como concluído sem ela.
        if (!generate_description) throw imgErr;
        result.imageError = 'A descrição foi gerada, mas a imagem não pôde ser concluída.';
      }
    }

    // O histórico referencia o objeto privado no R2, ainda sem publicação.
    const generatedImageUrl = result.imageUrl || null;
    const saved = await c.env.DB.prepare(`
      UPDATE ai_generations
      SET status = 'completed', generated_name = ?, generated_description = ?,
          generated_category = ?, generated_image_url = ?, cost_usd = ?,
          completed_at = datetime('now')
      WHERE id = ? AND store_id = ? AND status = 'processing'
    `).bind(result.name || null, result.description || null, result.category || null,
      generatedImageUrl, result.cost || 0, generationId, storeId).run();
    if (saved.meta?.changes !== 1) throw new Error('Histórico da geração indisponível');

    return c.json({
      generation: {
        id: generationId,
        name: result.name,
        shortDescription: result.shortDescription,
        description: result.description,
        category: result.category,
        characteristics: result.characteristics,
        imageUrl: generatedImageUrl,
        cost: result.cost,
        model: result.imageModel || result.model,
        style,
        imageError: result.imageError
      },
      message: 'Geração concluída! Revise e aprove as informações antes de publicar.'
    });

  } catch (error: any) {
    // Se falhar o histórico após salvar no R2, remover o objeto recém-criado.
    if (generatedObjectKey) {
      try { await c.env.STORAGE.delete(generatedObjectKey); }
      catch { console.error('Falha ao limpar imagem IA não registrada no histórico'); }
    }
    // Respostas de provedores podem conter informação interna: não retornar ao cliente.
    const reason = String(error?.message || 'Falha na IA').slice(0, 500);
    await c.env.DB.prepare("UPDATE ai_generations SET status = 'failed', error_message = ? WHERE id = ? AND store_id = ?")
      .bind(reason, generationId, storeId).run().catch(() => {});
    return c.json({ error: 'Não foi possível concluir a geração com IA' }, 500);
  }
});

store.get('/ai/history', async (c) => {
  const storeId = getStoreId(c);
  const history = await c.env.DB.prepare('SELECT * FROM ai_generations WHERE store_id = ? ORDER BY created_at DESC LIMIT 20').bind(storeId).all();
  const totalCost = await c.env.DB.prepare('SELECT COALESCE(SUM(cost_usd), 0) as total FROM ai_generations WHERE store_id = ?').bind(storeId).first() as any;
  const todayCount = await c.env.DB.prepare("SELECT COUNT(*) as count FROM ai_generations WHERE store_id = ? AND date(created_at) = date('now')").bind(storeId).first() as any;
  
  return c.json({ 
    history: (history as any).results || history,
    totalCost: totalCost?.total || 0,
    todayCount: todayCount?.count || 0
  });
});

// POST /api/store/ai/approve-image - aprovação vinculada a geração real
store.post('/ai/approve-image', async (c) => {
  const storeId = getStoreId(c);
  const input = await c.req.json().catch(() => null);
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return c.json({ error: 'Dados inválidos' }, 400);
  }
  const { product_id, image_url, generation_id } = input as Record<string, unknown>;
  if (typeof product_id !== 'string' || !product_id.trim() ||
      typeof image_url !== 'string' || !image_url ||
      typeof generation_id !== 'string' || !generation_id.trim() ||
      !publicLinkSchema.safeParse(image_url).success) {
    return c.json({ error: 'Produto, geração e imagem válidos são obrigatórios' }, 400);
  }
  const product = await c.env.DB.prepare(
    'SELECT id FROM products WHERE id = ? AND store_id = ?'
  ).bind(product_id, storeId).first();
  if (!product) return c.json({ error: 'Produto não encontrado' }, 404);

  // Uma única instrução impede aprovar imagens alheias, forjadas ou já aprovadas.
  const imageId = crypto.randomUUID();
  const result = await c.env.DB.prepare(`
    INSERT INTO product_images (id, product_id, store_id, url, is_ai_generated, ai_style, sort_order)
    SELECT ?, ?, ?, g.generated_image_url, 1,
      CASE WHEN g.ai_style IN ('modern_room', 'white_background', 'promotional', 'premium_catalog')
        THEN g.ai_style ELSE 'modern_room' END,
      COALESCE((SELECT MAX(pi.sort_order) + 1 FROM product_images AS pi
        WHERE pi.product_id = ? AND pi.store_id = ?), 0)
    FROM ai_generations AS g
    WHERE g.id = ? AND g.store_id = ? AND g.status = 'completed'
      AND g.generated_image_url = ?
      AND (g.product_id IS NULL OR g.product_id = ?)
      AND NOT EXISTS (
        SELECT 1 FROM product_images AS previous
        WHERE previous.product_id = ? AND previous.store_id = ?
          AND previous.url = g.generated_image_url AND previous.is_ai_generated = 1
      )
  `).bind(imageId, product_id, storeId, product_id, storeId, generation_id,
    storeId, image_url, product_id, product_id, storeId).run();
  if (result.meta?.changes !== 1) {
    return c.json({ error: 'Geração não encontrada, inválida ou já aprovada' }, 409);
  }
  return c.json({ message: 'Imagem aprovada e adicionada ao produto!', imageId });
});
// =====================
// ANALYTICS
// =====================
store.get('/analytics', async (c) => {
  const storeId = getStoreId(c);
  const days = Math.min(365, Math.max(1, Number.parseInt(c.req.query('days') || '30') || 30));
  
  const views = await c.env.DB.prepare(`
    SELECT date(created_at) as date, COUNT(*) as count 
    FROM analytics_events WHERE store_id = ? AND event_type = 'catalog_view' AND created_at >= datetime('now', '-${days} days')
    GROUP BY date(created_at) ORDER BY date
  `).bind(storeId).all();

  const topProductsAnalytics = await c.env.DB.prepare(`
    SELECT p.name, p.slug, COUNT(*) as views 
    FROM analytics_events ae 
    JOIN products p ON ae.product_id = p.id 
    WHERE ae.store_id = ? AND ae.event_type = 'product_view' 
    GROUP BY ae.product_id ORDER BY views DESC LIMIT 10
  `).bind(storeId).all();

  return c.json({
    chart: (views as any).results || views,
    topProducts: (topProductsAnalytics as any).results || topProductsAnalytics
  });
});

// =====================
// EXPORT/IMPORT CSV
// =====================
store.get('/export/csv', async (c) => {
  const storeId = getStoreId(c);
  const products = await c.env.DB.prepare('SELECT * FROM products WHERE store_id = ? ORDER BY created_at DESC').bind(storeId).all();
  
  const rows = (products as any).results || products;
  const headers = ['sku','name','slug','price','original_price','promotional_price','status','is_featured','stock_quantity','short_description','description'];
  let csv = headers.join(',') + '\n';
  
  for (const p of rows as any[]) {
    const row = headers.map(h => {
      const val = (p as any)[h] ?? '';
      const safe = /^[=+@\-\t\r]/.test(String(val)) ? `'${val}` : String(val);
      const escaped = safe.replace(/"/g, '""');
      return `"${escaped}"`;
    }).join(',');
    csv += row + '\n';
  }

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="produtos-${storeId}.csv"`
    }
  });
});

export default store;
