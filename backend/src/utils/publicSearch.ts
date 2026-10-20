/** Limites e normalização compartilhados pelas buscas públicas. */
const MAX_PAGE = 10_000;
const MAX_LIMIT = 50;
const MAX_QUERY_LENGTH = 120;

export type CatalogPagination = { page: number; limit: number; offset: number };

function positiveInteger(value: string | undefined, fallback: number, max: number): number | null {
  if (value === undefined) return fallback;
  if (!/^[1-9][0-9]*$/.test(value) || value.length > 5) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= max ? parsed : null;
}

export function parseCatalogPagination(pageRaw: string | undefined, limitRaw: string | undefined): CatalogPagination | null {
  const page = positiveInteger(pageRaw, 1, MAX_PAGE);
  const limit = positiveInteger(limitRaw, 12, MAX_LIMIT);
  if (page === null || limit === null) return null;
  return { page, limit, offset: (page - 1) * limit };
}

export function parsePublicSearch(raw: string | undefined):
  { valid: true; term: string | undefined } | { valid: false } {
  if (raw === undefined) return { valid: true, term: undefined };
  const term = raw.trim();
  if (term.length > MAX_QUERY_LENGTH || /[\u0000-\u001f\u007f]/.test(term)) return { valid: false };
  return { valid: true, term: term || undefined };
}

/** Os caracteres % _ e \ devem ser literais na consulta LIKE. */
export function escapePublicLike(term: string): string {
  return "%"+term.replace(/[\\%_]/g, "\\$&")+"%";
}
