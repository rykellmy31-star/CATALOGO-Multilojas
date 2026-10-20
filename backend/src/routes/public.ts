import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { parseAnalyticsEvent, parseAnalyticsSessionId, analyticsRateLimitKey, recordUniquePublicView, hashAnalyticsSessionId } from '../utils/analytics.js';
import { parseCatalogPagination, parsePublicSearch, escapePublicLike } from '../utils/publicSearch.js';

type Env = {
  Bindings: {
    DB: D1Database;
    STORAGE: R2Bucket;
    R2_PUBLIC_URL?: string;
    JWT_SECRET: string;
  };
};

const publicRoutes = new Hono<Env>();
const effectivePrice = 'CASE WHEN p.promotional_price IS NOT NULL AND p.promotional_price < p.price THEN p.promotional_price ELSE p.price END';

// GET /api/public/stores/:slug - dados públicos da loja
publicRoutes.get('/stores/:slug', async (c) => {
  const slug = c.req.param('slug');
  
  const store = await c.env.DB.prepare(
    `SELECT id, name, slug, description, logo_url, banner_url, primary_color, secondary_color, accent_color, address, city, state, phone, whatsapp, email, instagram, facebook, website, opening_hours, seo_title, seo_description FROM stores WHERE slug = ? AND status = 'active'`
  ).bind(slug).first() as any;

  if (!store) return c.json({ error: 'Loja não encontrada' }, 404);

  // Banners ativos
  const banners = await c.env.DB.prepare('SELECT * FROM banners WHERE store_id = ? AND is_active = 1 ORDER BY sort_order').bind(store.id).all();
  
  // Categorias
  const categories = await c.env.DB.prepare('SELECT * FROM categories WHERE store_id = ? AND is_active = 1 ORDER BY sort_order, name').bind(store.id).all();

  // Produtos em destaque
  const featured = await c.env.DB.prepare(`
    SELECT p.id, p.store_id, p.sku, p.name, p.slug, p.short_description, p.description, p.price, p.original_price, p.promotional_price, p.category_id, p.brand_id, p.status, p.is_featured, p.is_on_sale, p.stock_quantity, p.dimensions, p.technical_specs, p.variations, pi.url as primary_image, c.name as category_name
    FROM products p
    LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.store_id = ? AND p.status = 'published' AND p.is_featured = 1
    ORDER BY p.sort_order, p.created_at DESC LIMIT 8
  `).bind(store.id).all();

  // Produtos em promoção
  const onSale = await c.env.DB.prepare(`
    SELECT p.id, p.store_id, p.sku, p.name, p.slug, p.short_description, p.description, p.price, p.original_price, p.promotional_price, p.category_id, p.brand_id, p.status, p.is_featured, p.is_on_sale, p.stock_quantity, p.dimensions, p.technical_specs, p.variations, pi.url as primary_image, c.name as category_name
    FROM products p
    LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.store_id = ? AND p.status = 'published' AND p.is_on_sale = 1
    ORDER BY p.created_at DESC LIMIT 8
  `).bind(store.id).all();

  // Apenas a rota GET registra visita; a sessão original nunca entra no banco.
  const sessionId = parseAnalyticsSessionId(c.req.header('X-Session-Id'));
  if (sessionId && sessionId !== 'anon') {
    await recordUniquePublicView(c.env.DB, 'catalog_view', store.id, null, sessionId, c.env.JWT_SECRET).catch(() => {});
  }

  return c.json({
    store,
    banners: (banners as any).results || banners,
    categories: (categories as any).results || categories,
    featured: (featured as any).results || featured,
    onSale: (onSale as any).results || onSale
  });
});

// GET /api/public/stores/:slug/products - lista produtos públicos com filtros
publicRoutes.get('/stores/:slug/products', async (c) => {
  const slug = c.req.param('slug');
  const search = parsePublicSearch(c.req.query('q'));
  if (!search.valid) return c.json({ error: 'Busca inválida' }, 400);
  const q = search.term;
  const qLike = q ? escapePublicLike(q) : undefined;
  const category = c.req.query('category');
  const brand = c.req.query('brand');
  const minPrice = c.req.query('minPrice');
  const maxPrice = c.req.query('maxPrice');
  const parsePrice = (value: string | undefined) => value === undefined ? undefined : value.trim() ? Number(value) : NaN;
  const min = parsePrice(minPrice);
  const max = parsePrice(maxPrice);
  if ([min, max].some(value => value !== undefined && (!Number.isFinite(value) || value < 0)) || (min !== undefined && max !== undefined && min > max)) return c.json({ error: 'Intervalo de preços inválido' }, 400);
  const sort = c.req.query('sort') || 'newest'; // newest, price_asc, price_desc, name
  const pagination = parseCatalogPagination(c.req.query('page'), c.req.query('limit'));
  if (!pagination) return c.json({ error: 'Paginação inválida' }, 400);
  const { page, limit, offset } = pagination;

  const store = await c.env.DB.prepare(`SELECT id FROM stores WHERE slug = ? AND status = 'active'`).bind(slug).first() as any;
  if (!store) return c.json({ error: 'Loja não encontrada' }, 404);

  let query = `
    SELECT p.id, p.store_id, p.sku, p.name, p.slug, p.short_description, p.description, p.price, p.original_price, p.promotional_price, p.category_id, p.brand_id, p.status, p.is_featured, p.is_on_sale, p.stock_quantity, p.dimensions, p.technical_specs, p.variations, pi.url as primary_image, c.name as category_name, c.slug as category_slug
    FROM products p
    LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.store_id = ? AND p.status = 'published'
  `;
  const params: any[] = [store.id];

  if (qLike) {
    query += " AND (p.name LIKE ? ESCAPE '\\' OR p.description LIKE ? ESCAPE '\\' OR p.sku LIKE ? ESCAPE '\\' OR p.short_description LIKE ? ESCAPE '\\')";
    params.push(qLike, qLike, qLike, qLike);
  }
  if (category) {
    query += ' AND c.slug = ?';
    params.push(category);
  }
  if (brand) {
    query += ' AND p.brand_id = (SELECT id FROM brands WHERE slug = ? AND store_id = ? LIMIT 1)';
    params.push(brand, store.id);
  }
  if (minPrice) {
    query += ` AND ${effectivePrice} >= ?`;
    params.push(min);
  }
  if (maxPrice) {
    query += ` AND ${effectivePrice} <= ?`;
    params.push(max);
  }

  // Ordenação
  switch (sort) {
    case 'price_asc': query += ` ORDER BY ${effectivePrice} ASC, p.id ASC`; break;
    case 'price_desc': query += ` ORDER BY ${effectivePrice} DESC, p.id ASC`; break;
    case 'name': query += ' ORDER BY p.name ASC'; break;
    default: query += ' ORDER BY p.created_at DESC';
  }

  query += ' LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const products = await c.env.DB.prepare(query).bind(...params).all();

  // Count
  let countQuery = `SELECT COUNT(*) as count FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.store_id = ? AND p.status = 'published'`;
  const countParams: any[] = [store.id];
  if (qLike) {
    countQuery += " AND (p.name LIKE ? ESCAPE '\\' OR p.description LIKE ? ESCAPE '\\' OR p.sku LIKE ? ESCAPE '\\' OR p.short_description LIKE ? ESCAPE '\\')";
    countParams.push(qLike, qLike, qLike, qLike);
  }
  if (category) { countQuery += ' AND c.slug = ?'; countParams.push(category); }
  if (minPrice) { countQuery += ` AND ${effectivePrice} >= ?`; countParams.push(min); }
  if (maxPrice) { countQuery += ` AND ${effectivePrice} <= ?`; countParams.push(max); }

  if (brand) { countQuery += ' AND p.brand_id = (SELECT id FROM brands WHERE slug = ? AND store_id = ? LIMIT 1)'; countParams.push(brand, store.id); }
  const total = await c.env.DB.prepare(countQuery).bind(...countParams).first() as any;

  return c.json({
    products: (products as any).results || products,
    pagination: { page, limit, total: total?.count || 0, pages: Math.ceil((total?.count || 0) / limit) }
  });
});

// GET /api/public/stores/:slug/products/:productSlug - produto individual
publicRoutes.get('/stores/:slug/products/:productSlug', async (c) => {
  const slug = c.req.param('slug');
  const productSlug = c.req.param('productSlug');

  const store = await c.env.DB.prepare(`SELECT id, name, slug, whatsapp, phone FROM stores WHERE slug = ? AND status = 'active'`).bind(slug).first() as any;
  if (!store) return c.json({ error: 'Loja não encontrada' }, 404);

  const product = await c.env.DB.prepare(`
    SELECT p.id, p.store_id, p.sku, p.name, p.slug, p.short_description, p.description, p.price, p.original_price, p.promotional_price, p.category_id, p.brand_id, p.status, p.is_featured, p.is_on_sale, p.stock_quantity, p.views, p.dimensions, p.technical_specs, p.variations, c.name as category_name, c.slug as category_slug, b.name as brand_name
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN brands b ON p.brand_id = b.id
    WHERE p.store_id = ? AND p.slug = ? AND p.status = 'published'
  `).bind(store.id, productSlug).first() as any;

  if (!product) return c.json({ error: 'Produto não encontrado' }, 404);

  const images = await c.env.DB.prepare('SELECT id, product_id, url, alt_text, is_primary, is_ai_generated, sort_order FROM product_images WHERE product_id = ? ORDER BY is_primary DESC, sort_order').bind(product.id).all();

  // Produtos relacionados (mesma categoria)
  const related = await c.env.DB.prepare(`
    SELECT p.id, p.store_id, p.sku, p.name, p.slug, p.short_description, p.description, p.price, p.original_price, p.promotional_price, p.category_id, p.brand_id, p.status, p.is_featured, p.is_on_sale, p.stock_quantity, p.dimensions, p.technical_specs, p.variations, pi.url as primary_image FROM products p
    LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
    WHERE p.store_id = ? AND p.category_id = ? AND p.id != ? AND p.status = 'published'
    ORDER BY RANDOM() LIMIT 4
  `).bind(store.id, product.category_id, product.id).all();

  // Deduplicação de produto em lote transacional: evento e contador juntos.
  const sessionId = parseAnalyticsSessionId(c.req.header('X-Session-Id'));
  if (sessionId && sessionId !== 'anon') {
    await recordUniquePublicView(c.env.DB, 'product_view', store.id, product.id, sessionId, c.env.JWT_SECRET).catch(() => {});
  }

  // O link compartilhado precisa conter a URL completa do catálogo e preço
  // atualizado deve ser consultado no site, não fixado em uma mensagem antiga.
  const whatsappNumber = typeof store.whatsapp === 'string' ? store.whatsapp.replace(/\D/g, '') : '';
  const validWhatsApp = /^[1-9]\d{9,14}$/.test(whatsappNumber);
  const productUrl = new URL(
    `/loja/${encodeURIComponent(store.slug)}/produto/${encodeURIComponent(product.slug)}`,
    new URL(c.req.url).origin
  ).toString();
  const whatsappMessage = `Olá! Tenho interesse no produto: ${product.name} (Código: ${product.sku || product.id.slice(0, 8)}). Link: ${productUrl}. Poderia confirmar o preço e a disponibilidade atualizados?`;

  return c.json({
    product,
    images: (images as any).results || images,
    related: (related as any).results || related,
    store: { name: store.name, slug: store.slug, whatsapp: store.whatsapp, phone: store.phone },
    whatsappLink: validWhatsApp ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}` : null
  });
});

// POST /api/public/stores/:slug/analytics - registrar eventos (não visualizações)
publicRoutes.post('/stores/:slug/analytics',
  bodyLimit({ maxSize: 4096, onError: c => c.json({ error: 'Evento muito grande' }, 413) }),
  async (c) => {
  const slug = c.req.param('slug');
  const event = parseAnalyticsEvent(await c.req.json().catch(() => null));
  if (!event) return c.json({ error: 'Evento inválido' }, 400);
  const { event_type, product_id, metadataJson } = event;
  const sessionId = parseAnalyticsSessionId(c.req.header('X-Session-Id'));
  if (sessionId === null) return c.json({ error: 'Sessão inválida' }, 400);

  const store = await c.env.DB.prepare("SELECT id FROM stores WHERE slug = ? AND status = 'active'").bind(slug).first() as any;
  if (!store) return c.json({ error: 'Loja não encontrada' }, 404);
  if (!c.env.JWT_SECRET || c.env.JWT_SECRET.length < 32) return c.json({ error: 'Serviço indisponível' }, 503);

  const key = await analyticsRateLimitKey(c.env.JWT_SECRET, c.req.header('CF-Connecting-IP') || 'local', store.id);
  const now = Math.floor(Date.now() / 1000);
  const limit = await c.env.DB.prepare(
    'INSERT INTO auth_rate_limits (id, hits, expires_at) VALUES (?, 1, ?) ' +
    'ON CONFLICT(id) DO UPDATE SET ' +
    'hits = CASE WHEN expires_at <= ? THEN 1 ELSE hits + 1 END, ' +
    'expires_at = CASE WHEN expires_at <= ? THEN excluded.expires_at ELSE expires_at END ' +
    'RETURNING hits, expires_at'
  ).bind(key, now + 60, now, now).first() as { hits: number; expires_at: number } | null;
  if (!limit) return c.json({ error: 'Serviço indisponível' }, 503);
  if (limit.hits > 120) {
    c.header('Retry-After', String(Math.max(1, limit.expires_at - now)));
    return c.json({ error: 'Muitos eventos. Tente novamente em instantes.' }, 429);
  }
  if (product_id && !await c.env.DB.prepare(
    "SELECT id FROM products WHERE id = ? AND store_id = ? AND status = 'published'"
  ).bind(product_id, store.id).first()) return c.json({ error: 'Produto não encontrado' }, 404);

  const storedSessionId = await hashAnalyticsSessionId(c.env.JWT_SECRET, sessionId, store.id);
  const insertEvent = c.env.DB.prepare(
    'INSERT INTO analytics_events (id, store_id, product_id, event_type, session_id, metadata) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(crypto.randomUUID(), store.id, product_id || null, event_type, storedSessionId, metadataJson);

  if (event_type === 'whatsapp_click' && product_id) {
    const increment = c.env.DB.prepare('UPDATE products SET clicks = clicks + 1 WHERE id = ? AND store_id = ?')
      .bind(product_id, store.id);
    await c.env.DB.batch([insertEvent, increment]);
  } else {
    await insertEvent.run();
  }
  return c.json({ success: true });
});

// GET /api/public/search - busca global (opcional)
publicRoutes.get('/search', async (c) => {
  const search = parsePublicSearch(c.req.query('q'));
  if (!search.valid) return c.json({ error: 'Busca inválida' }, 400);
  const q = search.term;
  if (!q || q.length < 2) return c.json({ products: [] });

  const products = await c.env.DB.prepare(`
    SELECT p.id, p.store_id, p.sku, p.name, p.slug, p.short_description, p.description, p.price, p.original_price, p.promotional_price, p.category_id, p.brand_id, p.status, p.is_featured, p.is_on_sale, p.stock_quantity, p.dimensions, p.technical_specs, p.variations, s.name as store_name, s.slug as store_slug, pi.url as primary_image
    FROM products p
    JOIN stores s ON p.store_id = s.id
    LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = 1
    WHERE p.status = 'published' AND s.status = 'active' AND (p.name LIKE ? ESCAPE '\\' OR p.description LIKE ? ESCAPE '\\')
    ORDER BY p.views DESC LIMIT 10
  `).bind(escapePublicLike(q), escapePublicLike(q)).all();

  return c.json({ products: (products as any).results || products });
});

// GET /api/public/platform - info pública da plataforma
publicRoutes.get('/platform', async (c) => {
  const config = await c.env.DB.prepare('SELECT platform_name, logo_url, primary_color, footer_text FROM platform_config LIMIT 1').first();
  return c.json({ platform: config });
});

export default publicRoutes;
