import { getWhatsAppContactUrl } from './whatsapp';

/** Link comercial seguro: sempre aponta ao domínio atual do catálogo. */
export function buildProductContactUrl(
  whatsapp: unknown,
  productName: unknown,
  storeSlug: unknown,
  productSlug: unknown,
  origin: string
): string | null {
  const contact = getWhatsAppContactUrl(whatsapp);
  if (!contact || typeof productName !== 'string' || typeof storeSlug !== 'string' || typeof productSlug !== 'string') return null;
  if (!/^[a-z0-9_-]{1,200}$/i.test(storeSlug) || !/^[a-z0-9_-]{1,200}$/i.test(productSlug)) return null;
  const name = productName.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 200);
  if (!name) return null;
  let url: URL;
  try { url = new URL(origin); } catch { return null; }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
  const productUrl = new URL(`/loja/${encodeURIComponent(storeSlug)}/produto/${encodeURIComponent(productSlug)}`, url.origin);
  const message = `Olá! Tenho interesse em ${name}. Link: ${productUrl.toString()} — Poderia confirmar o preço e a disponibilidade atualizados?`;
  return `${contact}?text=${encodeURIComponent(message)}`;
}
