/** Constrói apenas links wa.me com número internacional plausível. */
export function getWhatsAppContactUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !/^[\d+().\-\s]+$/.test(value)) return null;
  const digits = value.replace(/\D/g, '');
  if (!/^[1-9]\d{9,14}$/.test(digits)) return null;
  return `https://wa.me/${digits}`;
}
