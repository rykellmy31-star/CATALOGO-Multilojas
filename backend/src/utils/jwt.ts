import jwt from 'jsonwebtoken';
export interface JWTPayload {
  userId: string;
  email: string;
  role: 'super_admin' | 'store_admin';
  storeId: string | null;
  version?: number;
  iat?: number;
  exp?: number;
}
export function signToken(payload: Omit<JWTPayload, 'iat' | 'exp'>, secret: string, expiresIn = '7d'): string {
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET inválido');
  return jwt.sign(payload, secret, { expiresIn } as any);
}
export function verifyToken(token: string, secret: string): JWTPayload | null {
  if (!secret || secret.length < 32) return null;
  try { return jwt.verify(token, secret, { algorithms: ['HS256'] }) as JWTPayload; }
  catch { return null; }
}
export function extractToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const match = /^Bearer ([^\s]+)$/.exec(authHeader);
  return match ? match[1] : null;
}
