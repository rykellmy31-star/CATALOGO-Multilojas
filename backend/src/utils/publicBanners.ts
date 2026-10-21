/**
 * Fonte única para a listagem pública de campanhas.
 * O banco compara datas ISO/UTC com julianday, inclusive offsets explícitos
 * e datas antigas que o SQLite registrou como UTC sem timezone.
 */
export async function loadVisibleBanners(db: D1Database, storeId: string) {
  const result = await db.prepare(`
    SELECT * FROM banners
    WHERE store_id = ? AND is_active = 1
      AND (starts_at IS NULL OR julianday(starts_at) <= julianday('now'))
      AND (ends_at IS NULL OR julianday(ends_at) > julianday('now'))
    ORDER BY sort_order, created_at DESC, id
  `).bind(storeId).all();
  return result.results || [];
}

/**
 * Próxima mudança de visibilidade. Evita polling constante de visitantes:
 * o navegador consulta novamente somente quando a programação muda.
 */
export async function nextBannerTransitionAt(
  db: D1Database,
  storeId: string
): Promise<string | null> {
  const row = await db.prepare(`
    SELECT MIN(next_julian) AS next_julian FROM (
      SELECT julianday(starts_at) AS next_julian
      FROM banners
      WHERE store_id = ? AND is_active = 1
        AND julianday(starts_at) > julianday('now')
      UNION ALL
      SELECT julianday(ends_at) AS next_julian
      FROM banners
      WHERE store_id = ? AND is_active = 1
        AND julianday(ends_at) > julianday('now')
    )
  `).bind(storeId, storeId).first() as { next_julian: number | null } | null;
  if (row?.next_julian == null) return null;
  const timestamp = Math.round((Number(row.next_julian) - 2440587.5) * 86400000);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}
