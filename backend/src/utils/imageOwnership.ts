/**
 * Impede associar imagens privadas de outra loja a produtos, banners ou
 * configurações da loja atual. URLs externas legadas continuam aceitas.
 */
const FILE_NAME = /^[a-z0-9_-]{1,128}\.(?:jpe?g|png|webp|gif)$/i;
const SEGMENT = /^[a-z0-9_-]{1,128}$/i;

export function isOwnedStorageImageUrl(url: string, storeId: string): boolean {
  if (typeof url !== 'string' || !SEGMENT.test(storeId) || !url ||
      url.length > 4096 || /[\\\u0000-\u0020\u007f]/.test(url)) return false;
  const prefix = '/api/storage/';

  if (!url.startsWith(prefix)) {
    // Imagens externas http(s) continuam funcionando, mas um endereço
    // absoluto para /api/storage não pode contornar a verificação da loja.
    if (url.startsWith('//') || url.startsWith('/')) return false;
    let external: URL;
    try { external = new URL(url); }
    catch { return false; }
    if (!['https:', 'http:'].includes(external.protocol) ||
        external.username || external.password ||
        external.pathname === '/api/storage' ||
        external.pathname.startsWith(prefix)) return false;
    return true;
  }

  const encodedKey = url.slice(prefix.length);
  let key: string;
  try {
    key = decodeURIComponent(encodedKey);
  } catch {
    return false;
  }
  // Rejeita dupla codificação, query/hash, barras ambíguas e traversal.
  if (encodeURIComponent(key) !== encodedKey) return false;
  const parts = key.split('/');
  return parts.length === 5 &&
    parts[0] === 'stores' && parts[1] === storeId &&
    parts[2] === 'products' &&
    SEGMENT.test(parts[3]) && FILE_NAME.test(parts[4]);
}

export function areOwnedStorageImages(
  images: readonly string[] | undefined,
  storeId: string
): boolean {
  return images === undefined ||
    (Array.isArray(images) && images.every(url => isOwnedStorageImageUrl(url, storeId)));
}
