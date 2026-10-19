import { Context, Next } from 'hono';
import { ZodSchema } from 'zod';

export function zValidator<T extends ZodSchema>(source: 'json' | 'query' | 'param', schema: T) {
  return async (c: Context, next: Next) => {
    let data: any;
    try {
      if (source === 'json') data = await c.req.json();
      else if (source === 'query') data = c.req.query();
      else if (source === 'param') data = c.req.param();
    } catch {
      return c.json({ error: 'JSON inválido' }, 400);
    }

    const result = schema.safeParse(data);
    if (!result.success) {
      return c.json({ 
        error: 'Dados inválidos',
        details: result.error.errors.map(e => ({ field: e.path.join('.'), message: e.message }))
      }, 400);
    }

    c.set('validatedData' as any, result.data);
    // Also store for easy access
    (c.req as any).valid = (s: string) => result.data;
    // Monkey patch for compatibility
    const originalValid = (c.req as any).valid;
    c.req.valid = ((src: string) => {
      if (src === source) return result.data;
      return result.data;
    }) as any;

    await next();
  };
}
