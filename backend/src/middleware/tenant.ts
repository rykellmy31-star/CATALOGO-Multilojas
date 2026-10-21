import { Context, Next } from 'hono';
import { JWTPayload } from '../utils/jwt.js';

// Middleware que garante isolamento multi-tenant
// Toda requisição de store_admin é automaticamente filtrada por store_id
// Tentativas de acessar outra loja são bloqueadas

export async function tenantMiddleware(c: Context<any>, next: Next) {
  const user = c.get('user') as JWTPayload | undefined;
  
  if (!user) {
    await next();
    return;
  }

  // Super admin pode acessar qualquer loja, mas com log de auditoria
  if (user.role === 'super_admin') {
    await next();
    return;
  }

  // Store admin: injeta storeId no contexto para uso nas queries
  if (user.role === 'store_admin' && user.storeId) {
    c.set('storeId', user.storeId);
  }

  await next();
}

// Helper para validar ownership de recursos
export async function validateOwnership(
  db: D1Database,
  table: string,
  resourceId: string,
  storeId: string
): Promise<boolean> {
  const result = await db.prepare(`SELECT id FROM ${table} WHERE id = ? AND store_id = ?`).bind(resourceId, storeId).first();
  return !!result;
}

export function tenantFilter(storeId: string | null, allowSuperAdmin = true) {
  return {
    getWhereClause: (user: JWTPayload) => {
      if (user.role === 'super_admin' && allowSuperAdmin) {
        return storeId ? 'store_id = ?' : '1=1';
      }
      return 'store_id = ?';
    },
    getParams: (user: JWTPayload) => {
      if (user.role === 'super_admin' && allowSuperAdmin && storeId) {
        return [storeId];
      }
      if (user.role === 'super_admin' && allowSuperAdmin && !storeId) {
        return [];
      }
      return [user.storeId];
    }
  };
}
