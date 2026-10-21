import { Hono } from 'hono';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { tenantMiddleware } from '../middleware/tenant.js';
import { zValidator } from '../middleware/validation.js';
import { createStoreSchema, storeAdminSchema, updatePlatformConfigSchema } from '../utils/validation.js';
import { hashPassword } from '../utils/hash.js';
import { slugify } from '../utils/slug.js';
import { parsePublicSearch, escapePublicLike } from '../utils/publicSearch.js';
import { auditStoreStorage, validateStorageAuditOptions } from '../utils/storageAudit.js';

type Env = {
  Bindings: { DB: D1Database; STORAGE: R2Bucket; JWT_SECRET: string; };
  Variables: { user: any; };
};

const superadmin = new Hono<Env>();

superadmin.use('*', authMiddleware as any);
superadmin.use('*', requireRole('super_admin') as any);

// GET /api/superadmin/dashboard
superadmin.get('/dashboard', async (c) => {
  const db = c.env.DB;

  const totalStores = await db.prepare(`SELECT COUNT(*) as count FROM stores WHERE status != 'deleted'`).first() as any;
  const activeStores = await db.prepare(`SELECT COUNT(*) as count FROM stores WHERE status = 'active'`).first() as any;
  const suspendedStores = await db.prepare(`SELECT COUNT(*) as count FROM stores WHERE status = 'suspended'`).first() as any;
  const totalProducts = await db.prepare('SELECT COUNT(*) as count FROM products').first() as any;
  const totalImages = await db.prepare('SELECT COUNT(*) as count FROM product_images').first() as any;
  const totalVisits = await db.prepare("SELECT COUNT(*) as count FROM analytics_events WHERE event_type = 'catalog_view'").first() as any;
  const totalAIGenerations = await db.prepare('SELECT COUNT(*) as count FROM ai_generations').first() as any;
  const totalAICost = await db.prepare('SELECT COALESCE(SUM(cost_usd), 0) as total FROM ai_generations').first() as any;

  const recentStores = await db.prepare('SELECT id, name, slug, status, created_at FROM stores ORDER BY created_at DESC LIMIT 5').all();
  const recentActivity = await db.prepare('SELECT a.*, u.name as user_name FROM audit_logs a LEFT JOIN users u ON a.user_id = u.id ORDER BY a.created_at DESC LIMIT 10').all();

  return c.json({
    stats: {
      totalStores: (totalStores as any).results?.[0]?.count ?? totalStores.count ?? 0,
      activeStores: (activeStores as any).results?.[0]?.count ?? activeStores.count ?? 0,
      suspendedStores: (suspendedStores as any).results?.[0]?.count ?? suspendedStores.count ?? 0,
      totalProducts: (totalProducts as any).results?.[0]?.count ?? totalProducts.count ?? 0,
      totalImages: (totalImages as any).results?.[0]?.count ?? totalImages.count ?? 0,
      totalVisits: (totalVisits as any).results?.[0]?.count ?? totalVisits.count ?? 0,
      totalAIGenerations: (totalAIGenerations as any).results?.[0]?.count ?? totalAIGenerations.count ?? 0,
      totalAICost: (totalAICost as any).results?.[0]?.total ?? totalAICost.total ?? 0,
    },
    recentStores: (recentStores as any).results || recentStores,
    recentActivity: (recentActivity as any).results || recentActivity
  });
});

// GET /api/superadmin/stores
superadmin.get('/stores', async (c) => {
  const search = parsePublicSearch(c.req.query('q'));
  if (!search.valid) return c.json({ error: 'Busca inválida' }, 400);
  const qLike = search.term ? escapePublicLike(search.term) : undefined;
  const status = c.req.query('status');
  
  let query = `
    SELECT s.*, 
      (SELECT COUNT(*) FROM products WHERE store_id = s.id) as products_count,
      (SELECT COUNT(*) FROM users WHERE store_id = s.id) as admins_count,
      (SELECT COUNT(*) FROM analytics_events WHERE store_id = s.id AND event_type='catalog_view') as visits_count
    FROM stores s WHERE s.status != 'deleted'
  `;
  const params: any[] = [];

  if (qLike) {
    query += " AND (s.name LIKE ? ESCAPE '\\' OR s.slug LIKE ? ESCAPE '\\' OR s.email LIKE ? ESCAPE '\\')";
    params.push(qLike, qLike, qLike);
  }
  if (status && status !== 'all') {
    query += ' AND s.status = ?';
    params.push(status);
  }
  query += ' ORDER BY s.created_at DESC';

  const result = await c.env.DB.prepare(query).bind(...params).all();
  return c.json({ stores: (result as any).results || result });
});

// POST /api/superadmin/stores
superadmin.post('/stores', zValidator('json', createStoreSchema), async (c) => {
  const data = c.req.valid('json');
  const user = c.get('user');
  const explicitSlug = Boolean(data.slug?.trim());
  const baseSlug = slugify(data.slug || data.name);
  if (!baseSlug) return c.json({ error: 'Informe um endereço válido para a loja' }, 400);

  const storeId = crypto.randomUUID();
  const insert = (slug: string) => c.env.DB.prepare(`
    INSERT INTO stores (
      id, name, slug, description, whatsapp, email, phone, address, city,
      state, primary_color, secondary_color, accent_color, plan, status,
      storage_limit_mb, ai_enabled, ai_daily_limit, ai_monthly_limit
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(slug) DO NOTHING
  `).bind(
    storeId, data.name, slug, data.description || null, data.whatsapp || null,
    data.email || null, data.phone || null, data.address || null, data.city || null,
    data.state || null, data.primary_color || '#0ea5e9',
    data.secondary_color || '#0f172a', data.accent_color || '#f59e0b',
    data.plan || 'free', data.status || 'active',
    data.storage_limit_mb ?? 1024, data.ai_enabled === false ? 0 : 1,
    data.ai_daily_limit ?? 10, data.ai_monthly_limit ?? 100
  ).run();

  // D1 e diferentes adapters de SQLite podem expor metadados de
  // alteração distintos. A prova de criação é a existência do ID gerado.
  await insert(baseSlug);
  let slug = baseSlug;
  let created = await c.env.DB.prepare(
    'SELECT id FROM stores WHERE id = ?'
  ).bind(storeId).first();
  if (!created) {
    if (explicitSlug) {
      return c.json({ error: 'Endereço da loja já utilizado' }, 409);
    }
    // O UUID elimina colisões por timestamp e suporta cadastro simultâneo.
    slug = `${baseSlug}-${storeId}`;
    await insert(slug);
    created = await c.env.DB.prepare(
      'SELECT id FROM stores WHERE id = ?'
    ).bind(storeId).first();
    if (!created) {
      return c.json({ error: 'Não foi possível gerar endereço exclusivo' }, 409);
    }
  }

  await c.env.DB.prepare(
    'INSERT INTO audit_logs (user_id, store_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(user.userId, storeId, 'create_store', 'store', storeId,
    JSON.stringify({ name: data.name, slug })).run().catch(() => {});

  const store = await c.env.DB.prepare('SELECT * FROM stores WHERE id = ?')
    .bind(storeId).first();
  return c.json({ store, message: 'Loja criada com sucesso!' }, 201);
});

// GET /api/superadmin/stores/:id/storage-audit - consulta sem exclusão.
superadmin.get('/stores/:id/storage-audit', async (c) => {
  const storeId = c.req.param('id');
  const cursor = c.req.query('cursor');
  const rawLimit = c.req.query('limit');
  const limit = rawLimit === undefined ? undefined : Number(rawLimit);
  if (!validateStorageAuditOptions({ cursor, limit }) ||
      (rawLimit !== undefined && !/^[1-9][0-9]{0,2}$/.test(rawLimit))) {
    return c.json({ error: 'Paginação de auditoria inválida' }, 400);
  }
  try {
    const result = await auditStoreStorage(c.env.DB, c.env.STORAGE, storeId, { cursor, limit });
    if (!result) return c.json({ error: 'Loja não encontrada' }, 404);
    c.header('Cache-Control', 'no-store');
    return c.json(result);
  } catch {
    return c.json({ error: 'Não foi possível auditar o armazenamento' }, 503);
  }
});

// GET /api/superadmin/stores/:id
superadmin.get('/stores/:id', async (c) => {
  const id = c.req.param('id');
  const store = await c.env.DB.prepare('SELECT * FROM stores WHERE id = ?').bind(id).first();
  if (!store) return c.json({ error: 'Loja não encontrada' }, 404);
  
  const products = await c.env.DB.prepare('SELECT COUNT(*) as count FROM products WHERE store_id = ?').bind(id).first() as any;
  const admins = await c.env.DB.prepare('SELECT id, name, email, is_active, last_login_at FROM users WHERE store_id = ?').bind(id).all();
  
  return c.json({ store, stats: { products: (products as any)?.count || 0 }, admins: (admins as any).results || admins });
});

// PUT /api/superadmin/stores/:id
superadmin.put('/stores/:id', zValidator('json', createStoreSchema.partial()), async (c) => {
  const id = c.req.param('id');
  const data = c.req.valid('json') as any;
  const user = c.get('user');

  const store = await c.env.DB.prepare('SELECT * FROM stores WHERE id = ?').bind(id).first() as any;
  if (!store) return c.json({ error: 'Loja não encontrada' }, 404);

  const updates: string[] = [];
  const params: any[] = [];
  
  const allowed = ['name','description','whatsapp','email','phone','address','city','state','primary_color','secondary_color','accent_color','plan','status','storage_limit_mb','ai_enabled','ai_daily_limit','ai_monthly_limit'];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      updates.push(`${key} = ?`);
      params.push(typeof data[key] === 'boolean' ? Number(data[key]) : data[key]);
    }
  }
  if (data.slug !== undefined) {
    const newSlug = slugify(data.slug);
    if (!newSlug) return c.json({ error: 'Endereço inválido para a loja' }, 400);
    const taken = await c.env.DB.prepare(
      'SELECT id FROM stores WHERE slug = ? AND id != ?'
    ).bind(newSlug, id).first();
    if (taken) return c.json({ error: 'Endereço da loja já utilizado' }, 409);
    updates.push('slug = ?');
    params.push(newSlug);
  }
  
  if (updates.length === 0) return c.json({ error: 'Nenhum campo para atualizar' }, 400);
  
  updates.push("updated_at = datetime('now')");
  params.push(id);

  try {
    await c.env.DB.prepare(`UPDATE stores SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...params).run();
  } catch (error) {
    // Protege também a corrida entre a consulta de slug e o UPDATE.
    if (String(error).toLowerCase().includes('unique constraint failed: stores.slug')) {
      return c.json({ error: 'Endereço da loja já utilizado' }, 409);
    }
    throw error;
  }

  await c.env.DB.prepare(
    'INSERT INTO audit_logs (user_id, store_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(user.userId, id, 'update_store', 'store', id, JSON.stringify(data)).run().catch(()=>{});

  const updated = await c.env.DB.prepare('SELECT * FROM stores WHERE id = ?').bind(id).first();
  return c.json({ store: updated, message: 'Loja atualizada com sucesso!' });
});

// DELETE /api/superadmin/stores/:id
superadmin.delete('/stores/:id', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');

  const result = await c.env.DB.prepare(
    "UPDATE stores SET status = 'deleted', updated_at = datetime('now') WHERE id = ? AND status != 'deleted'"
  ).bind(id).run();
  if (result.meta?.changes !== 1) return c.json({ error: 'Loja não encontrada' }, 404);

  await c.env.DB.prepare(
    'INSERT INTO audit_logs (user_id, store_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(user.userId, id, 'delete_store', 'store', id, JSON.stringify({})).run().catch(()=>{});

  return c.json({ message: 'Loja removida com sucesso' });
});

// POST /api/superadmin/stores/:id/admins - criar admin da loja
superadmin.post('/stores/:id/admins', zValidator('json', storeAdminSchema), async (c) => {
  const storeId = c.req.param('id');
  const { name, email, password } = c.req.valid('json');
  
  if (!name || !email || !password) return c.json({ error: 'Nome, email e senha são obrigatórios' }, 400);
  if (password.length < 6) return c.json({ error: 'Senha deve ter no mínimo 6 caracteres' }, 400);

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (existing) return c.json({ error: 'Email já cadastrado' }, 409);

  const store = await c.env.DB.prepare("SELECT id FROM stores WHERE id = ? AND status != 'deleted'").bind(storeId).first();
  if (!store) return c.json({ error: 'Loja não encontrada' }, 404);

  const hash = await hashPassword(password);
  const userId = crypto.randomUUID();

  // Verificar o status da loja NO INSERT evita cadastrar usuário após uma
  // exclusão concorrente. UNIQUE(email) mantém a idempotência da colisão.
  const inserted = await c.env.DB.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, store_id)
    SELECT ?, ?, ?, ?, 'store_admin', s.id
    FROM stores s WHERE s.id = ? AND s.status != 'deleted'
    ON CONFLICT(email) DO NOTHING
  `).bind(userId, name, email, hash, storeId).run();
  if (inserted.meta?.changes !== 1) {
    const stillAvailable = await c.env.DB.prepare(
      "SELECT id FROM stores WHERE id = ? AND status != 'deleted'"
    ).bind(storeId).first();
    if (!stillAvailable) return c.json({ error: 'Loja não encontrada' }, 404);
    return c.json({ error: 'Email já cadastrado' }, 409);
  }

  const user = c.get('user');
  await c.env.DB.prepare(
    'INSERT INTO audit_logs (user_id, store_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(user.userId, storeId, 'create_store_admin', 'user', userId, JSON.stringify({ email, name })).run().catch(()=>{});

  return c.json({ message: 'Administrador criado com sucesso', user: { id: userId, name, email } }, 201);
});

// PUT /api/superadmin/stores/:id/admins/:adminId/reset-password
superadmin.put('/stores/:id/admins/:adminId/reset-password', zValidator('json', storeAdminSchema.pick({ password: true })), async (c) => {
  const adminId = c.req.param('adminId');
  const { password } = c.req.valid('json');
  if (!password || password.length < 6) return c.json({ error: 'Senha inválida' }, 400);

  const storeId = c.req.param('id');
  const admin = await c.env.DB.prepare("SELECT id FROM users WHERE id = ? AND store_id = ? AND role = 'store_admin'").bind(adminId, storeId).first();
  if (!admin) return c.json({ error: 'Administrador não encontrado' }, 404);
  const hash = await hashPassword(password);
  await c.env.DB.prepare(`UPDATE users SET password_hash = ?, auth_version = auth_version + 1, updated_at = datetime('now') WHERE id = ? AND store_id = ?`).bind(hash, adminId, storeId).run();
  
  const user = c.get('user');
  await c.env.DB.prepare(
    'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)'
  ).bind(user.userId, 'reset_password', 'user', adminId, JSON.stringify({})).run().catch(()=>{});

  return c.json({ message: 'Senha redefinida com sucesso' });
});

// GET /api/superadmin/platform-config
superadmin.get('/platform-config', async (c) => {
  const config = await c.env.DB.prepare('SELECT * FROM platform_config LIMIT 1').first();
  return c.json({ config });
});

// PUT /api/superadmin/platform-config
superadmin.put('/platform-config', zValidator('json', updatePlatformConfigSchema), async (c) => {
  const data = c.req.valid('json') as Record<string, unknown>;
  const user = c.get('user');
  const allowed = ['platform_name','logo_url','primary_color','secondary_color','accent_color','footer_text','support_email','ai_provider','ai_enabled','ai_daily_limit_default','ai_monthly_limit_default','storage_limit_per_store_mb'];
  const updates: string[] = [];
  const params: any[] = [];

  for (const key of allowed) {
    if (data[key] !== undefined) {
      updates.push(`${key} = ?`);
      params.push(typeof data[key] === 'boolean' ? Number(data[key]) : data[key]);
    }
  }
  if (updates.length === 0) return c.json({ error: 'Nenhum campo para atualizar' }, 400);
  updates.push("updated_at = datetime('now')");

  const result = await c.env.DB.prepare(
    `UPDATE platform_config SET ${updates.join(', ')} WHERE id = 'platform-default'`
  ).bind(...params).run();
  if (result.meta?.changes !== 1) return c.json({ error: 'Configuração da plataforma não encontrada' }, 404);
  
  await c.env.DB.prepare('INSERT INTO audit_logs (user_id, action, entity_type, details) VALUES (?, ?, ?, ?)').bind(user.userId, 'update_platform_config', 'platform_config', JSON.stringify(data)).run().catch(()=>{});

  const config = await c.env.DB.prepare('SELECT * FROM platform_config LIMIT 1').first();
  return c.json({ config, message: 'Configurações atualizadas!' });
});

// GET /api/superadmin/audit-logs
superadmin.get('/audit-logs', async (c) => {
  // Não permitir coerções como "1abc", negativos, expoentes ou inteiros
  // gigantes que causariam erro de binding e retornos 500 do SQLite/D1.
  const parsePositiveInt = (raw: string | undefined, fallback: number, max: number) => {
    if (raw === undefined) return fallback;
    if (!/^[1-9][0-9]{0,4}$/.test(raw)) return null;
    const parsed = Number(raw);
    return Number.isSafeInteger(parsed) && parsed <= max ? parsed : null;
  };
  const page = parsePositiveInt(c.req.query('page'), 1, 10000);
  const limit = parsePositiveInt(c.req.query('limit'), 20, 100);
  if (page === null || limit === null) return c.json({ error: 'Paginação inválida' }, 400);
  const offset = (page - 1) * limit;

  const logs = await c.env.DB.prepare(`
    SELECT a.*, u.name as user_name, u.email as user_email, s.name as store_name 
    FROM audit_logs a 
    LEFT JOIN users u ON a.user_id = u.id 
    LEFT JOIN stores s ON a.store_id = s.id 
    ORDER BY a.created_at DESC LIMIT ? OFFSET ?
  `).bind(limit, offset).all();

  const total = await c.env.DB.prepare('SELECT COUNT(*) as count FROM audit_logs').first() as any;
  // Log de suporte pode conter dados pessoais; não armazenar em cache.
  c.header('Cache-Control', 'no-store');

  return c.json({ 
    logs: (logs as any).results || logs,
    pagination: { page, limit, total: (total as any)?.count || 0 }
  });
});

// POST /api/superadmin/stores/:id/impersonate-view - visualização de suporte com auditoria
superadmin.get('/stores/:id/support-view', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');

  const store = await c.env.DB.prepare(
    "SELECT * FROM stores WHERE id = ? AND status != 'deleted'"
  ).bind(id).first();
  if (!store) return c.json({ error: 'Loja não encontrada' }, 404);

  // Falhar fechado: nenhuma informação de suporte é enviada se a operação
  // de auditoria não pôde ser confirmada pelo banco.
  try {
    const audit = await c.env.DB.prepare(
      'INSERT INTO audit_logs (user_id, store_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(user.userId, id, 'support_view', 'store', id,
      JSON.stringify({ accessed_at: new Date().toISOString() })).run();
    if (audit.meta?.changes !== 1) {
      return c.json({ error: 'Auditoria indisponível. Acesso de suporte não realizado.' }, 503);
    }
  } catch {
    return c.json({ error: 'Auditoria indisponível. Acesso de suporte não realizado.' }, 503);
  }
  c.header('Cache-Control', 'no-store');

  const products = await c.env.DB.prepare('SELECT COUNT(*) as count FROM products WHERE store_id = ?').bind(id).first() as any;
  const admins = await c.env.DB.prepare('SELECT id, name, email, last_login_at FROM users WHERE store_id = ?').bind(id).all();
  const recentProducts = await c.env.DB.prepare('SELECT id, name, status, created_at FROM products WHERE store_id = ? ORDER BY created_at DESC LIMIT 5').bind(id).all();

  return c.json({ 
    store, 
    stats: { products: (products as any)?.count || 0 },
    admins: (admins as any).results || admins,
    recentProducts: (recentProducts as any).results || recentProducts,
    message: 'Acesso de suporte registrado em auditoria'
  });
});

export default superadmin;
