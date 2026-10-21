import { Context, Next } from 'hono';
// Atomic D1 counter shared by Worker instances. No raw IP is persisted.
export async function authRateLimit(c: Context, next: Next) {
  const secret = c.env.JWT_SECRET;
  // Falhar fechado antes de calcular identificadores ou gravar rate limits no D1.
  if (typeof secret !== 'string' || secret.length < 32) {
    return c.json({ error: 'Autenticação indisponível.' }, 503);
  }
  const ip = c.req.header('CF-Connecting-IP') || 'local';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${secret}:${ip}`));
  const key = `${c.req.path}:${Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2,'0')).join('')}`;
  const now = Math.floor(Date.now()/1000);
  const row = await c.env.DB.prepare(`INSERT INTO auth_rate_limits (id, hits, expires_at) VALUES (?, 1, ?)
    ON CONFLICT(id) DO UPDATE SET hits = CASE WHEN expires_at <= ? THEN 1 ELSE hits + 1 END,
    expires_at = CASE WHEN expires_at <= ? THEN excluded.expires_at ELSE expires_at END
    RETURNING hits, expires_at`).bind(key, now+900, now, now).first();
  if (!row) return c.json({ error: 'Autenticação indisponível.' }, 503);
  if (row.hits > 20) {
    c.header('Retry-After', String(Math.max(1, row.expires_at-now)));
    return c.json({ error: 'Muitas tentativas. Tente novamente mais tarde.' },429);
  }
  await next();
}
