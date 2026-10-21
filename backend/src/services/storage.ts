// ============================================
// STORAGE SERVICE - Cloudflare R2
// ============================================

export async function uploadToR2(
  bucket: R2Bucket,
  file: ArrayBuffer,
  key: string,
  contentType: string
): Promise<string> {
  const object = await bucket.put(key, file, {
    httpMetadata: {
      contentType,
      cacheControl: 'public, max-age=31536000'
    }
  });

  if (!object) throw new Error('Falha ao fazer upload');

  // Retorna URL pública (configurar domínio customizado no R2)
  // Em dev, retorna key para servir via endpoint
  return key;
}

export async function deleteFromR2(bucket: R2Bucket, key: string): Promise<void> {
  await bucket.delete(key);
}

export async function getPublicUrl(
  bucketName: string,
  publicUrlBase: string | undefined,
  key: string
): Promise<string> {
  if (publicUrlBase) {
    return `${publicUrlBase.replace(/\/$/, '')}/${key}`;
  }
  // Fallback: servir via Worker endpoint /api/storage/:key
  return `/api/storage/${encodeURIComponent(key)}`;
}

export function generateStorageKey(storeId: string, productId: string, filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `stores/${storeId}/products/${productId}/${timestamp}-${random}.${ext}`;
}

export function isValidImageType(contentType: string): boolean {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/gif'];
  return allowed.includes(contentType.toLowerCase());
}

export function isValidImageSize(size: number, maxMb = 10): boolean {
  return size <= maxMb * 1024 * 1024;
}
