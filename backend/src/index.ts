import { bodyLimit } from 'hono/body-limit';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import authRoutes from './routes/auth.js';
import superadminRoutes from './routes/superadmin.js';
import storeRoutes from './routes/store.js';
import publicRoutes from './routes/public.js';
import uploadRoutes from './routes/upload.js';

type Bindings = {
  DB: D1Database; STORAGE: R2Bucket; STORAGE_PUBLIC: R2Bucket;
  JWT_SECRET: string; SUPER_ADMIN_SETUP_TOKEN?: string;
  OPENAI_API_KEY?: string; AI_PROVIDER?: string; AI_ENABLED?: string;
  R2_PUBLIC_URL?: string; PLATFORM_NAME?: string; ENVIRONMENT?: string;
  CORS_ALLOWED_ORIGINS?: string;
};
const app = new Hono<{ Bindings: Bindings }>();
app.use('*', logger());
app.use('/api/*', bodyLimit({ maxSize: 11 * 1024 * 1024, onError: c => c.json({ error: 'Requisição muito grande' }, 413) }));
app.use('*', secureHeaders());
app.use('*', async (c, next) => {
  const configured = (c.env.CORS_ALLOWED_ORIGINS || '').split(',')
    .map(v => v.trim()).filter(Boolean);
  const middleware = cors({
    origin: (origin) => configured.includes(origin) ? origin : '',
    allowHeaders: ['Content-Type', 'Authorization', 'X-Session-Id'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    credentials: true,
  });
  return middleware(c, next);
});
app.get('/api/health', async c => {
  try {
    await c.env.DB.prepare('SELECT 1').first();
    return c.json({ status: 'ok', database: 'connected' });
  } catch {
    return c.json({ status: 'degraded' }, 503);
  }
});
app.route('/api/auth', authRoutes);
app.route('/api/superadmin', superadminRoutes);
app.route('/api/store', storeRoutes);
app.route('/api/public', publicRoutes);
app.route('/api/upload', uploadRoutes);
app.route('/api', uploadRoutes);
app.notFound(c => c.json({ error: 'Rota não encontrada' }, 404));
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ error: 'Erro interno do servidor' }, 500);
});
export async function scheduled(_event: ScheduledEvent, env: Bindings, _ctx: ExecutionContext) {
  try {
    await env.DB.prepare("DELETE FROM auth_rate_limits WHERE expires_at < unixepoch()").run();
    await env.DB.prepare("DELETE FROM analytics_events WHERE created_at < datetime('now', '-90 days')").run();
  } catch (error) {
    console.error('Scheduled maintenance failed', error);
  }
}
export default app;
