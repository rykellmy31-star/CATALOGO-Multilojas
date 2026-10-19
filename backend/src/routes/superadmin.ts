import { Hono } from 'hono';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { tenantMiddleware } from '../middleware/tenant.js';
import { zValidator } from '../middleware/validation.js';
import { createStoreSchema, storeAdminSchema } from '../utils/validation.js';
import { hashPassword } from '../utils/hash.js';
import { slugify } from '../utils/slug.js';

type Env = {
  Bindings: { DB: D1Database; JWT_SECRET: string; };
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
  const q = c.req.query('q');
  const status = c.req.query('status');
  
  let query = `
    SELECT s.*, 
      (SELECT COUNT(*) FROM products WHERE store_id = s.id) as products_count,
      (SELECT COUNT(*) FROM users WHERE store_id = s.id) as admins_count,
      (SELECT COUNT(*) FROM analytics_events WHERE store_id = s.id AND event_type='catalog_view') as visits_count
    FROM stores s WHERE s.status != 'deleted'
  `;
  const params: any[] = [];

  if (q) {
    query += ' AND (s.name LIKE ? OR s.slug LIKE ? OR s.email LIKE ?)';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
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
  const data = c.req.valid('json') as any;
  const user = c.get('user');

  let slug = data.slug ? slugify(data.slug) : slugify(data.name);
  
  // Verifica slug único
  const existing = await c.env.DB.prepare('SELECT id FROM stores WHERE slug = ?').bind(slug).first();
  if (existing) {
    slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  }

  const storeId = crypto.randomUUID();
  
  await c.env.DB.prepare(`
    INSERT INTO stores (id, name, slug, description, whatsapp, email, phone, address, city, state, primary_color, secondary_color, accent_color, plan, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    storeId, data.name, slug, data.description || null, data.whatsapp || null,
    data.email || null, data.phone || null, data.address || null, data.city || null,
    data.state || null, data.primary_color || '#0ea5e9', data.secondary_color || '#0f172a',
    data.accent_color || '#f59e0b', data.plan || 'free', data.status || 'active'
  ).run();

  await c.env.DB.prepare(
    'INSERT INTO audit_logs (user_id, store_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(user.userId, storeId, 'create_store', 'store', storeId, JSON.stringify({ name: data.name, slug })).run().catch(()=>{});

  const store = await c.env.DB.prepare('SELECT * FROM stores WHERE id = ?').bind(storeId).first();
  return c.json({ store, message: 'Loja criada com sucesso!' }, 201);
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
  if (data.slug) {
    updates.push('slug = ?');
    params.push(slugify(data.slug));
  }
  
  if (updates.length === 0) return c.json({ error: 'Nenhum campo para atualizar' }, 400);
  
  updates.push("updated_at = datetime('now')");
  params.push(id);

  await c.env.DB.prepare(`UPDATE stores SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();

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

  await c.env.DB.prepare("UPDATE stores SET status = 'deleted', updated_at = datetime('now') WHERE id = ?").bind(id).run();
  
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

  const store = await c.env.DB.prepare('SELECT id FROM stores WHERE id = ?').bind(storeId).first();
  if (!store) return c.json({ error: 'Loja não encontrada' }, 404);

  const hash = await hashPassword(password);
  const userId = crypto.randomUUID();

  await c.env.DB.prepare(
    'INSERT INTO users (id, name, email, password_hash, role, store_id) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(userId, name, email, hash, 'store_admin', storeId).run();

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
superadmin.put('/platform-config', async (c) => {
  const data = await c.req.json() as any;
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

  await c.env.DB.prepare(`UPDATE platform_config SET ${updates.join(', ')} WHERE id = 'platform-default'`).bind(...params).run();
  
  await c.env.DB.prepare('INSERT INTO audit_logs (user_id, action, entity_type, details) VALUES (?, ?, ?, ?)').bind(user.userId, 'update_platform_config', 'platform_config', JSON.stringify(data)).run().catch(()=>{});

  const config = await c.env.DB.prepare('SELECT * FROM platform_config LIMIT 1').first();
  return c.json({ config, message: 'Configurações atualizadas!' });
});

// GET /api/superadmin/audit-logs
superadmin.get('/audit-logs', async (c) => {
  const page = Math.max(1, Number.parseInt(c.req.query('page') || '1') || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(c.req.query('limit') || '20') || 20));
  const offset = (page - 1) * limit;

  const logs = await c.env.DB.prepare(`
    SELECT a.*, u.name as user_name, u.email as user_email, s.name as store_name 
    FROM audit_logs a 
    LEFT JOIN users u ON a.user_id = u.id 
    LEFT JOIN stores s ON a.store_id = s.id 
    ORDER BY a.created_at DESC LIMIT ? OFFSET ?
  `).bind(limit, offset).all();

  const total = await c.env.DB.prepare('SELECT COUNT(*) as count FROM audit_logs').first() as any;

  return c.json({ 
    logs: (logs as any).results || logs,
    pagination: { page, limit, total: (total as any)?.count || 0 }
  });
});

// POST /api/superadmin/stores/:id/impersonate-view - visualização de suporte com auditoria
superadmin.get('/stores/:id/support-view', async (c) => {
  const id = c.req.param('id');
  const user = c.get('user');

  const store = await c.env.DB.prepare('SELECT * FROM stores WHERE id = ?').bind(id).first();
  if (!store) return c.json({ error: 'Loja não encontrada' }, 404);

  await c.env.DB.prepare(
    'INSERT INTO audit_logs (user_id, store_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(user.userId, id, 'support_view', 'store', id, JSON.stringify({ accessed_at: new Date().toISOString() })).run().catch(()=>{});

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
