// Uma lista de interesse não deve guardar preços: eles podem mudar na loja.
export type InterestProduct = { id: string; name: string; slug: string };
export const MAX_INTEREST_PRODUCTS = 30;

export function normalizeInterestProducts(value: unknown): InterestProduct[] {
  if (!Array.isArray(value)) return [];
  const output: InterestProduct[] = [];
  const ids = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const product = item as Record<string, unknown>;
    if (typeof product.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(product.id)) continue;
    if (typeof product.name !== 'string' || typeof product.slug !== 'string') continue;
    const name = product.name.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
    const slug = product.slug.trim();
    if (!name || name.length > 200 || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/.test(slug)) continue;
    if (ids.has(product.id)) continue;
    ids.add(product.id);
    output.push({ id: product.id, name, slug });
    if (output.length >= MAX_INTEREST_PRODUCTS) break;
  }
  return output;
}

export function buildInterestListUrl(
  whatsapp: unknown,
  storeName: unknown,
  storeSlug: unknown,
  products: unknown,
  origin: string
): string | null {
  if (typeof whatsapp !== 'string' || typeof storeName !== 'string' || typeof storeSlug !== 'string') return null;
  const phone = whatsapp.replace(/\D/g, '');
  if (phone.length < 10 || phone.length > 15 || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/.test(storeSlug)) return null;
  const selected = normalizeInterestProducts(products);
  if (!selected.length) return null;
  let base: URL;
  try { base = new URL(origin); } catch { return null; }
  if (base.protocol !== 'https:' && base.protocol !== 'http:') return null;
  const safeStoreName = storeName.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 200);
  const lines = selected.map(product => {
    const url = new URL(`/loja/${encodeURIComponent(storeSlug)}/produto/${encodeURIComponent(product.slug)}`, base.origin);
    return `• ${product.name} - ${url.toString()}`;
  });
  const message = `Olá! Tenho interesse nos seguintes produtos da ${safeStoreName}:\n\n${lines.join('\n')}\n\nConsulte os preços e a disponibilidade atualizados nos links. Gostaria de mais informações!`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
