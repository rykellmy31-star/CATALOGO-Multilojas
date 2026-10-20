/**
 * Resolve imagens enviadas para IA; nunca solicita conteúdo de outra loja.
 * A URL original continua no histórico e só a imagem em base64 vai ao provedor.
 */
export type AIImageResolution =
  | { ok: true; url: string }
  | { ok: false; status: 400 | 404 | 413 | 503; error: string };

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']);

export function matchesImageSignature(bytes: Uint8Array, mime: string): boolean {
  if (mime === 'image/png') {
    const prefix = [137, 80, 78, 71, 13, 10, 26, 10];
    return bytes.length >= 8 && prefix.every((b, i) => bytes[i] === b);
  }
  if (mime === 'image/jpeg' || mime === 'image/jpg') {
    return bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  }
  if (mime === 'image/gif') {
    return bytes.length >= 6 &&
      /^GIF8[79]a$/.test(String.fromCharCode(...bytes.subarray(0, 6)));
  }
  if (mime === 'image/webp') {
    return bytes.length >= 12 &&
      String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF' &&
      String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP';
  }
  return false;
}

export async function resolveAIInputImage(
  imageUrl: string,
  storeId: string,
  storage: Pick<R2Bucket, 'get'>
): Promise<AIImageResolution> {
  if (imageUrl.startsWith('/')) {
    const prefix = '/api/storage/';
    if (!imageUrl.startsWith(prefix)) {
      return { ok: false, status: 400, error: 'Caminho de imagem inválido para IA' };
    }
    const encoded = imageUrl.slice(prefix.length);
    let key: string;
    try { key = decodeURIComponent(encoded); }
    catch { return { ok: false, status: 400, error: 'Caminho de imagem inválido para IA' }; }
    // A codificação e a loja são obrigatoriamente canônicas.
    if (encodeURIComponent(key) !== encoded ||
        !key.startsWith(`stores/${storeId}/products/`) ||
        key.split('/').some(segment => !segment || segment === '.' || segment === '..')) {
      return { ok: false, status: 404, error: 'Imagem não encontrada nesta loja' };
    }
    let object: R2ObjectBody | null;
    try { object = await storage.get(key); }
    catch { return { ok: false, status: 503, error: 'Armazenamento indisponível' }; }
    if (!object) return { ok: false, status: 404, error: 'Imagem não encontrada nesta loja' };
    if (object.size > MAX_IMAGE_BYTES) {
      return { ok: false, status: 413, error: 'Imagem excede 10 MB' };
    }
    const mime = object.httpMetadata?.contentType?.trim().toLowerCase();
    if (!mime || !IMAGE_TYPES.has(mime)) {
      return { ok: false, status: 400, error: 'Formato de imagem não permitido para IA' };
    }
    let bytes: Uint8Array;
    try { bytes = new Uint8Array(await object.arrayBuffer()); }
    catch { return { ok: false, status: 503, error: 'Não foi possível ler a imagem' }; }
    if (bytes.length > MAX_IMAGE_BYTES) return { ok: false, status: 413, error: 'Imagem excede 10 MB' };
    if (!matchesImageSignature(bytes, mime)) {
      return { ok: false, status: 400, error: 'Conteúdo de imagem inválido para IA' };
    }
    const chunks: string[] = [];
    for (let offset = 0; offset < bytes.length; offset += 32768) {
      chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 32768)));
    }
    const normalizedMime = mime === 'image/jpg' ? 'image/jpeg' : mime;
    return { ok: true, url: `data:${normalizedMime};base64,${btoa(chunks.join(''))}` };
  }

  // Não permitir IPs, URLs com credenciais, esquemas ativos nem nomes locais.
  let parsed: URL;
  try { parsed = new URL(imageUrl); }
  catch { return { ok: false, status: 400, error: 'URL inválida para IA' }; }
  const host = parsed.hostname.toLowerCase();
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password ||
      !/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(host) ||
      /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(host) ||
      host.endsWith('.localhost') || host.endsWith('.internal') ||
      host.endsWith('.local')) {
    return { ok: false, status: 400, error: 'A IA exige URL HTTPS pública e válida' };
  }
  return { ok: true, url: parsed.href };
}
