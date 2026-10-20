/**
 * Auditoria somente de leitura do R2. NÃO remove arquivos e NÃO recalcula a
 * quota da loja: uploads em andamento e edições não salvas são possíveis.
 */
const MIB = 1024 * 1024;
const MIN_REVIEW_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_PAGE_SIZE = 100;
const MAX_CURSOR_LENGTH = 4096;

export type StorageAuditOptions = {
  cursor?: string;
  limit?: number;
  now?: Date;
};

export function validateStorageAuditOptions(options: StorageAuditOptions): boolean {
  return (options.cursor === undefined ||
    (typeof options.cursor === 'string' && options.cursor.length > 0 &&
      options.cursor.length <= MAX_CURSOR_LENGTH)) &&
    (options.limit === undefined ||
      (Number.isSafeInteger(options.limit) && options.limit >= 1 && options.limit <= MAX_PAGE_SIZE)) &&
    (options.now === undefined || (options.now instanceof Date && Number.isFinite(options.now.getTime())));
}

export async function auditStoreStorage(
  db: D1Database,
  storage: Pick<R2Bucket, 'list'>,
  storeId: string,
  options: StorageAuditOptions = {}
) {
  if (!/^[a-z0-9_-]{1,128}$/i.test(storeId) || !validateStorageAuditOptions(options)) {
    throw new Error('Parâmetros inválidos para auditoria');
  }

  const store = await db.prepare(
    'SELECT id, storage_used_mb, storage_limit_mb FROM stores WHERE id = ? AND status != ?'
  ).bind(storeId, 'deleted').first() as {
    id: string; storage_used_mb: number | null; storage_limit_mb: number | null
  } | null;
  if (!store) return null;

  const prefix = `stores/${storeId}/`;
  const page = await storage.list({
    prefix,
    limit: options.limit || MAX_PAGE_SIZE,
    ...(options.cursor ? { cursor: options.cursor } : {})
  });

  // Nunca confiar em objetos fora do prefixo, mesmo diante de um mock defeituoso.
  const objects = page.objects;
  if (objects.some(o => !o.key.startsWith(prefix) ||
      !Number.isSafeInteger(o.size) || o.size < 0)) {
    throw new Error('Listagem R2 inconsistente');
  }
  if (page.truncated && !page.cursor) {
    throw new Error('R2 não devolveu cursor da próxima página');
  }

  const urls = objects.map(o => `/api/storage/${encodeURIComponent(o.key)}`);
  const referenced = new Set<string>();
  if (urls.length) {
    // Apenas UMA consulta D1 por página, incluindo usos que não aparecem
    // em product_images (branding, banners e histórico/entrada da IA).
    const sql = `
      SELECT DISTINCT url FROM (
        SELECT url FROM product_images WHERE store_id = ?
        UNION ALL SELECT thumbnail_url AS url FROM product_images WHERE store_id = ?
        UNION ALL SELECT medium_url AS url FROM product_images WHERE store_id = ?
        UNION ALL SELECT input_image_url AS url FROM ai_generations WHERE store_id = ?
        UNION ALL SELECT generated_image_url AS url FROM ai_generations WHERE store_id = ?
        UNION ALL SELECT image_url AS url FROM banners WHERE store_id = ?
        UNION ALL SELECT logo_url AS url FROM stores WHERE id = ?
        UNION ALL SELECT banner_url AS url FROM stores WHERE id = ?
      ) WHERE url IN (${urls.map(() => '?').join(',')})
    `;
    const result = await db.prepare(sql)
      .bind(...Array(8).fill(storeId), ...urls).all();
    for (const row of (result.results || []) as { url: string }[]) {
      referenced.add(row.url);
    }
  }

  const now = (options.now || new Date()).getTime();
  let referencedCount = 0;
  let unreferencedCount = 0;
  let reviewCandidateCount = 0;
  let unknownAgeCount = 0;
  let totalBytes = 0;
  const reviewCandidates: { key: string; size_bytes: number; uploaded_at: string }[] = [];

  for (let i = 0; i < objects.length; i++) {
    const object = objects[i];
    totalBytes += object.size;
    if (referenced.has(urls[i])) {
      referencedCount++;
      continue;
    }
    unreferencedCount++;
    const uploaded = object.uploaded instanceof Date ? object.uploaded : new Date(String(object.uploaded));
    if (!Number.isFinite(uploaded.getTime())) {
      unknownAgeCount++;
      continue;
    }
    if (now - uploaded.getTime() >= MIN_REVIEW_AGE_MS) {
      reviewCandidateCount++;
      reviewCandidates.push({
        key: object.key,
        size_bytes: object.size,
        uploaded_at: uploaded.toISOString()
      });
    }
  }

  return {
    mode: 'read_only' as const,
    page_scope_only: true,
    store_id: storeId,
    quota: {
      recorded_used_mb: Number(store.storage_used_mb ?? 0),
      limit_mb: Number(store.storage_limit_mb ?? 0)
    },
    scanned: {
      objects: objects.length,
      bytes: totalBytes,
      referenced: referencedCount,
      unreferenced: unreferencedCount,
      older_than_7_days_for_review: reviewCandidateCount,
      unknown_upload_date: unknownAgeCount
    },
    review_candidates: reviewCandidates,
    pagination: {
      has_more: page.truncated,
      next_cursor: page.truncated ? page.cursor : null
    },
    complete_store_scan: !page.truncated && !options.cursor,
    warning: 'Candidatos são apenas sugestões de revisão, não objetos seguros para exclusão. A quota não foi alterada.'
  };
}
