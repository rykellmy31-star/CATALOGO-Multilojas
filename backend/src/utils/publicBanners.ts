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
