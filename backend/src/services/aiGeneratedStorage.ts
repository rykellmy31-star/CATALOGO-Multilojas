/**
 * Guarda no R2 privado a imagem PNG devolvida pela API de edição.
 * O cliente recebe apenas uma URL controlada pelo Worker, nunca base64 nem URL temporária.
 */
const MAX_GENERATED_IMAGE_BYTES = 10 * 1024 * 1024;
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

export type StoredGeneratedImage = { key: string; url: string };

export function decodeGeneratedPng(base64: string): Uint8Array {
  if (typeof base64 !== 'string' || !base64 || base64.length > Math.ceil(MAX_GENERATED_IMAGE_BYTES / 3) * 4 + 4 ||
      base64.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) {
    throw new Error('Resposta de imagem inválida');
  }
  let raw: string;
  try { raw = atob(base64); } catch { throw new Error('Resposta de imagem inválida'); }
  if (raw.length < 24 || raw.length > MAX_GENERATED_IMAGE_BYTES) {
    throw new Error('Tamanho de imagem inválido');
  }
  const bytes = Uint8Array.from(raw, ch => ch.charCodeAt(0));
  if (!PNG_SIGNATURE.every((value, index) => bytes[index] === value)) {
    throw new Error('Arquivo gerado não é PNG');
  }
  return bytes;
}

export async function saveGeneratedImage(
  storage: Pick<R2Bucket, 'put'>,
  storeId: string,
  productId: string | null,
  base64: string
): Promise<StoredGeneratedImage> {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(storeId) ||
      (productId !== null && !/^[a-zA-Z0-9_-]{1,128}$/.test(productId))) {
    throw new Error('Identificador inválido');
  }
  const bytes = decodeGeneratedPng(base64);
  const key = `stores/${storeId}/products/${productId || 'general'}/${crypto.randomUUID()}.png`;
  const result = await storage.put(key, bytes, {
    httpMetadata: { contentType: 'image/png', cacheControl: 'no-store' }
  });
  if (!result) throw new Error('Não foi possível armazenar a imagem gerada');
  return { key, url: `/api/storage/${encodeURIComponent(key)}` };
}
