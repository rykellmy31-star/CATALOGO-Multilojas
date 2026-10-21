import bcrypt from 'bcryptjs';
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
}
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!/^\$2[aby]\$\d{2}\$/.test(hash)) return false;
  try { return await bcrypt.compare(password, hash); }
  catch { return false; }
}
export function generateSecureToken(length = 32): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
