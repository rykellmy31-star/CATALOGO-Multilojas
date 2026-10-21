/** Reservas atômicas de espaço para arquivos privados da loja (MiB). */
const MIB = 1024 * 1024;

export type StorageReservation = 'reserved' | 'quota_exceeded' | 'store_unavailable';

export async function reserveStorageBytes(
  db: D1Database,
  storeId: string,
  bytes: number
): Promise<StorageReservation> {
  if (!/^[a-z0-9_-]{1,128}$/i.test(storeId) ||
      !Number.isSafeInteger(bytes) || bytes <= 0) {
    throw new Error('Reserva de armazenamento inválida');
  }
  const delta = bytes / MIB;
  // A checagem e a soma ocorrem juntas no D1: uploads concorrentes não
  // podem usar a mesma capacidade livre.
  const result = await db.prepare(`
    UPDATE stores
    SET storage_used_mb = COALESCE(storage_used_mb, 0) + ?
    WHERE id = ? AND status = 'active'
      AND storage_limit_mb IS NOT NULL AND storage_limit_mb > 0
      AND COALESCE(storage_used_mb, 0) + ? <= storage_limit_mb
  `).bind(delta, storeId, delta).run();
  if (result.meta?.changes === 1) return 'reserved';
  const store = await db.prepare('SELECT status FROM stores WHERE id = ?')
    .bind(storeId).first() as { status?: string } | null;
  return store?.status === 'active' ? 'quota_exceeded' : 'store_unavailable';
}

export async function releaseStorageBytes(
  db: D1Database,
  storeId: string,
  bytes: number
): Promise<void> {
  if (!/^[a-z0-9_-]{1,128}$/i.test(storeId) ||
      !Number.isSafeInteger(bytes) || bytes <= 0) {
    throw new Error('Devolução de armazenamento inválida');
  }
  await db.prepare(`
    UPDATE stores
    SET storage_used_mb = MAX(0, COALESCE(storage_used_mb, 0) - ?)
    WHERE id = ?
  `).bind(bytes / MIB, storeId).run();
}
