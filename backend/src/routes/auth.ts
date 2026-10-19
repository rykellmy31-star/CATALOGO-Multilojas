import { Hono } from 'hono';
import { zValidator } from '../middleware/validation.js';
import { loginSchema, setupSuperAdminSchema } from '../utils/validation.js';
import { hashPassword, verifyPassword } from '../utils/hash.js';
import { signToken } from '../utils/jwt.js';
import { authMiddleware } from '../middleware/auth.js';

type Env = { Bindings: { DB: D1Database; JWT_SECRET: string; SUPER_ADMIN_SETUP_TOKEN: string } };
const auth = new Hono<Env>();

function configuredSecret(value: string | undefined): value is string {
  return typeof value === 'string' && value.length >= 32;
}

auth.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json' as any) as { email: string; password: string };
  if (!configuredSecret(c.env.JWT_SECRET)) return c.json({ error: 'Autenticação indisponível.' }, 503);

  const user = await c.env.DB.prepare(
    'SELECT id, name, email, password_hash, role, store_id, is_active FROM users WHERE email = ?'
  ).bind(email).first() as any;
  if (!user || !user.is_active || !(await verifyPassword(password, user.password_hash))) {
    return c.json({ error: 'Email ou senha inválidos.' }, 401);
  }
  if (user.role === 'store_admin') {
    const store = user.store_id
      ? await c.env.DB.prepare('SELECT status FROM stores WHERE id = ?').bind(user.store_id).first() as any
      : null;
    if (!store || store.status !== 'active') return c.json({ error: 'Acesso à loja indisponível.' }, 403);
  }
  const token = signToken({
    userId: user.id, email: user.email, role: user.role, storeId: user.store_id
  }, c.env.JWT_SECRET, '7d');
  await c.env.DB.prepare('UPDATE users SET last_login_at = datetime("now") WHERE id = ?').bind(user.id).run();
  await c.env.DB.prepare(
    'INSERT INTO audit_logs (user_id, store_id, action, entity_type, details) VALUES (?, ?, ?, ?, ?)'
  ).bind(user.id, user.store_id || null, 'login', 'user', JSON.stringify({ email })).run().catch(() => {});
  return c.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, storeId: user.store_id } });
});

auth.post('/setup-super-admin', zValidator('json', setupSuperAdminSchema), async (c) => {
  const { setupToken, name, email, password } = c.req.valid('json' as any) as {
    setupToken: string; name: string; email: string; password: string
  };
  // Validate both secrets BEFORE creating any database records.
  if (!configuredSecret(c.env.JWT_SECRET) || !configuredSecret(c.env.SUPER_ADMIN_SETUP_TOKEN)) {
    return c.json({ error: 'Configuração inicial indisponível.' }, 503);
  }
  if (setupToken !== c.env.SUPER_ADMIN_SETUP_TOKEN) return c.json({ error: 'Token inválido.' }, 403);

  const existing = await c.env.DB.prepare("SELECT id FROM users WHERE role = 'super_admin' LIMIT 1").first();
  if (existing) return c.json({ error: 'Super Administrador já configurado.' }, 409);
  const existingEmail = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (existingEmail) return c.json({ error: 'Email já cadastrado.' }, 409);

  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(password);
  // A unique DB constraint on the bootstrap role is also required to prevent concurrent setup.
  try {
    await c.env.DB.prepare(
      'INSERT INTO users (id, name, email, password_hash, role, store_id, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(userId, name, email, passwordHash, 'super_admin', null, 1).run();
  } catch (error) {
    // The unique partial index prevents concurrent bootstrap requests from creating two admins.
    const created = await c.env.DB.prepare("SELECT id FROM users WHERE role = 'super_admin' LIMIT 1").first();
    if (created) return c.json({ error: 'Super Administrador já configurado.' }, 409);
    throw error;
  }

  await c.env.DB.prepare(
    'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)'
  ).bind(userId, 'create_super_admin', 'user', userId, JSON.stringify({ email, name })).run().catch(() => {});
  const token = signToken({ userId, email, role: 'super_admin', storeId: null }, c.env.JWT_SECRET);
  return c.json({
    message: 'Super Administrador criado com sucesso!',
    token,
    user: { id: userId, name, email, role: 'super_admin', storeId: null }
  }, 201);
});

auth.get('/check-setup', async (c) => {
  const existing = await c.env.DB.prepare("SELECT id FROM users WHERE role = 'super_admin' LIMIT 1").first();
  return c.json({ needsSetup: !existing });
});

auth.get('/me', authMiddleware as any, async (c) => {
  const session = (c as any).get('user');
  const user = await c.env.DB.prepare(
    'SELECT id, name, email, role, store_id, avatar_url, is_active FROM users WHERE id = ?'
  ).bind(session.userId).first() as any;
  if (!user || !user.is_active) return c.json({ error: 'Acesso não autorizado.' }, 401);
  const store = user.store_id
    ? await c.env.DB.prepare('SELECT id, name, slug, logo_url, status FROM stores WHERE id = ?').bind(user.store_id).first()
    : null;
  return c.json({ user, store });
});

auth.post('/logout', authMiddleware as any, async (c) => {
  const user = (c as any).get('user');
  await c.env.DB.prepare(
    'INSERT INTO audit_logs (user_id, store_id, action, entity_type, details) VALUES (?, ?, ?, ?, ?)'
  ).bind(user.userId, user.storeId || null, 'logout', 'user', '{}').run().catch(() => {});
  return c.json({ message: 'Logout realizado com sucesso' });
});
export default auth;
