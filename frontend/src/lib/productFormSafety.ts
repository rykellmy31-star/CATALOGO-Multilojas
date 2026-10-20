/** Valores financeiros nunca devem virar zero após erro de conversão. */
export function parseProductAmount(value: unknown, optional = false): number | null {
  if (value === null || value === undefined ||
      (typeof value === 'string' && value.trim() === '')) {
    if (optional) return null;
    throw new Error('Informe um preço válido');
  }
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new Error('Preço inválido');
  }
  const text = String(value).trim();
  if (!/^(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)$/.test(text)) {
    throw new Error('Preço inválido');
  }
  const amount = Number(text);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error('Preço deve ser finito e não negativo');
  }
  return amount;
}
