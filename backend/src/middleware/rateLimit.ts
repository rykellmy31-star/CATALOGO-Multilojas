import { Context, Next } from 'hono';

// Rate limit simples em memória (para Workers, ideal usar KV ou Durable Objects em produção)
// Aqui implementamos um limitador por IP/sessão

const requestCounts = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(options: { max: number; windowMs: number; message?: string }) {
  return async (c: Context, next: Next) => {
    const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
    const key = `${c.req.path}:${ip}`;
    const now = Date.now();

    let entry = requestCounts.get(key);
    
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + options.windowMs };
    }

    entry.count++;
    requestCounts.set(key, entry);

    // Limpeza periódica
    if (requestCounts.size > 10000) {
      for (const [k, v] of requestCounts.entries()) {
        if (now > v.resetAt) requestCounts.delete(k);
      }
    }

    if (entry.count > options.max) {
      return c.json({ 
        error: options.message || 'Muitas requisições. Tente novamente em alguns minutos.',
        retryAfter: Math.ceil((entry.resetAt - now) / 1000)
      }, 429);
    }

    c.header('X-RateLimit-Limit', String(options.max));
    c.header('X-RateLimit-Remaining', String(Math.max(0, options.max - entry.count)));
    c.header('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    await next();
  };
}
