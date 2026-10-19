import { Context, Next } from 'hono';
import { verifyToken, extractToken, JWTPayload } from '../utils/jwt.js';
export type Env = {
  Bindings: {
    DB: D1Database;
    STORAGE: R2Bucket;
    STORAGE_PUBLIC: R2Bucket;
    JWT_SECRET: string;
    OPENAI_API_KEY?: string;
    AI_PROVIDER?: string;
    AI_ENABLED?: string;
    SUPER_ADMIN_SETUP_TOKEN?: string;
    PLATFORM_NAME?: string;
  };
  Variables: { user: JWTPayload };
};
export async function authMiddleware(c: Context<Env>, next: Next) {
  if (!c.env.JWT_SECRET || c.env.JWT_SECRET.length < 32)
    return c.json({ error: 'Autenticação indisponível.' }, 503);
  const token = extractToken(c.req.header('Authorization'));
  if (!token) return c.json({ error: 'Não autorizado.' }, 401);
  const payload = verifyToken(token, c.env.JWT_SECRET);
  if (!payload) return c.json({ error: 'Token inválido ou expirado.' }, 401);
  const user = await c.env.DB.prepare(
    'SELECT id, email, is_active, role, store_id FROM users WHERE id = ?'
  ).bind(payload.userId).first() as any;
  if (!user || !user.is_active) return c.json({ error: 'Acesso não autorizado.' }, 401);
  if (user.email !== payload.email || user.role !== payload.role || user.store_id !== payload.storeId)
    return c.json({ error: 'Sessão desatualizada.' }, 401);
  if (user.role === 'store_admin') {
    if (!user.store_id) return c.json({ error: 'Loja indisponível.' }, 403);
    const store = await c.env.DB.prepare('SELECT status FROM stores WHERE id = ?')
      .bind(user.store_id).first() as any;
    if (!store || store.status !== 'active') return c.json({ error: 'Loja indisponível.' }, 403);
  }
  c.set('user', payload);
  await next();
}
export function requireRole(...roles: string[]) {
  return async (c: Context<Env>, next: Next) => {
    const user = c.get('user');
    if (!user || !roles.includes(user.role)) return c.json({ error: 'Acesso negado.' }, 403);
    await next();
  };
}
export function requireSuperAdmin(c: Context<Env>, next: Next) {
  const user = c.get('user');
  if (!user || user.role !== 'super_admin')
    return c.json({ error: 'Acesso exclusivo do Super Administrador.' }, 403);
  return next();
}
