import { validator } from 'hono/validator';
import { z, ZodTypeAny } from 'zod';

export function zValidator<T extends ZodTypeAny>(source: 'json' | 'query' | 'param', schema: T) {
  return validator(source, (value, c) => {
    const result = schema.safeParse(value);
    if (!result.success) return c.json({ error: 'Dados inválidos', details: result.error.errors.map(e => ({ field: e.path.join('.'), message: e.message })) }, 400);
    return result.data as z.output<T>;
  });
}
