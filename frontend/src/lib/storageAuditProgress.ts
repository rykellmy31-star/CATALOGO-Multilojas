/** Resumo de auditoria R2 paginada, sem exclusão nem gravação no servidor. */
const MIB = 1024 * 1024;
const MAX_REVIEW_ITEMS = 50;

export interface StorageAuditPage {
  store_id: string;
  mode: 'read_only';
  quota: { recorded_used_mb: number; limit_mb: number };
  scanned: {
    objects: number;
    bytes: number;
    referenced: number;
    unreferenced: number;
    older_than_7_days_for_review: number;
    unknown_upload_date: number;
  };
  review_candidates: { key: string; size_bytes: number; uploaded_at: string }[];
  pagination: { has_more: boolean; next_cursor: string | null };
}

export interface StorageAuditProgress {
  storeId: string;
  pages: number;
  objects: number;
  bytes: number;
  referenced: number;
  unreferenced: number;
  reviewCandidatesCount: number;
  unknownUploadDate: number;
  reviewCandidates: StorageAuditPage['review_candidates'];
  recordedUsedMb: number;
  limitMb: number;
  nextCursor: string | null;
  complete: boolean;
  differenceMb: number | null;
  visitedCursors: string[];
}

export function mergeStorageAuditPage(
  prior: StorageAuditProgress | null,
  page: StorageAuditPage,
  requestedCursor?: string
): StorageAuditProgress {
  if (page.mode !== 'read_only' || !page.store_id ||
      !Number.isSafeInteger(page.scanned.objects) || page.scanned.objects < 0 ||
      !Number.isSafeInteger(page.scanned.bytes) || page.scanned.bytes < 0 ||
      !Array.isArray(page.review_candidates) ||
      !Number.isFinite(page.quota.recorded_used_mb) || !Number.isFinite(page.quota.limit_mb)) {
    throw new Error('Resposta de auditoria inválida');
  }
  for (const value of [page.scanned.referenced, page.scanned.unreferenced,
    page.scanned.older_than_7_days_for_review, page.scanned.unknown_upload_date]) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('Contagens inválidas');
  }
  if (page.scanned.referenced + page.scanned.unreferenced !== page.scanned.objects ||
      page.scanned.older_than_7_days_for_review > page.scanned.unreferenced ||
      page.review_candidates.length !== page.scanned.older_than_7_days_for_review) {
    throw new Error('Contagens de auditoria inconsistentes');
  }
  if (prior) {
    if (prior.storeId !== page.store_id || prior.complete ||
        prior.nextCursor !== requestedCursor ||
        !requestedCursor || prior.visitedCursors.includes(requestedCursor)) {
      throw new Error('Sequência de páginas inconsistente');
    }
  } else if (requestedCursor) {
    throw new Error('A auditoria deve começar na primeira página');
  }
  const visitedCursors = prior
    ? [...prior.visitedCursors, requestedCursor as string]
    : [];
  const nextCursor = page.pagination.has_more ? page.pagination.next_cursor : null;
  if (page.pagination.has_more &&
      (!nextCursor || visitedCursors.includes(nextCursor))) {
    throw new Error('Paginação R2 sem avanço');
  }
  const objects = (prior?.objects || 0) + page.scanned.objects;
  const bytes = (prior?.bytes || 0) + page.scanned.bytes;
  const complete = !page.pagination.has_more;
  return {
    storeId: page.store_id,
    pages: (prior?.pages || 0) + 1,
    objects, bytes,
    referenced: (prior?.referenced || 0) + page.scanned.referenced,
    unreferenced: (prior?.unreferenced || 0) + page.scanned.unreferenced,
    reviewCandidatesCount: (prior?.reviewCandidatesCount || 0) +
      page.scanned.older_than_7_days_for_review,
    unknownUploadDate: (prior?.unknownUploadDate || 0) +
      page.scanned.unknown_upload_date,
    reviewCandidates: [
      ...(prior?.reviewCandidates || []), ...page.review_candidates
    ].slice(0, MAX_REVIEW_ITEMS),
    recordedUsedMb: page.quota.recorded_used_mb,
    limitMb: page.quota.limit_mb,
    nextCursor, complete,
    differenceMb: complete ? bytes / MIB - page.quota.recorded_used_mb : null,
    visitedCursors
  };
}
