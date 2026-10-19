import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';

type Env = {
  Bindings: {
    DB: D1Database;
    STORAGE: R2Bucket;
    R2_PUBLIC_URL?: string;
    JWT_SECRET: string;
  };
};

const upload = new Hono<Env>();

upload.use('*', authMiddleware as any);

// POST /api/upload - upload de imagem
upload.post('/', async (c) => {
  const user = (c as any).get('user');
  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;
  const productId = formData.get('productId') as string | null;

  if (!file) return c.json({ error: 'Nenhum arquivo enviado' }, 400);

  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/gif'];
  if (!allowed.includes(file.type)) {
    return c.json({ error: 'Tipo de arquivo não permitido. Use JPG, PNG, WEBP ou GIF.' }, 400);
  }

  if (file.size > 10 * 1024 * 1024) {
    return c.json({ error: 'Arquivo muito grande. Máximo: 10MB.' }, 400);
  }

  const storeId = user.storeId;
  if (!storeId && user.role !== 'super_admin') {
    return c.json({ error: 'Loja não identificada' }, 400);
  }

  // Para super_admin, tenta pegar store do product
  let effectiveStoreId = storeId;
  if (!effectiveStoreId && productId) {
    const product = await c.env.DB.prepare('SELECT store_id FROM products WHERE id = ?').bind(productId).first() as any;
    effectiveStoreId = product?.store_id || 'platform';
  }
  if (!effectiveStoreId) effectiveStoreId = 'platform';

  const arrayBuffer = await file.arrayBuffer();
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const key = `stores/${effectiveStoreId}/products/${productId || 'general'}/${timestamp}-${random}.${ext}`;

  try {
    await c.env.STORAGE.put(key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
        cacheControl: 'public, max-age=31536000'
      }
    });
  } catch (e: any) {
    // Fallback para ambiente sem R2 (dev local): retorna data URL
    console.warn('R2 não disponível, usando fallback:', e.message);
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    bytes.forEach(b => binary += String.fromCharCode(b));
    const base64 = btoa(binary);
    const dataUrl = `data:${file.type};base64,${base64}`;
    return c.json({ 
      url: dataUrl,
      key: `local/${timestamp}-${random}.${ext}`,
      message: 'Upload local (R2 não configurado)'
    });
  }

  // URL pública
  const publicBase = c.env.R2_PUBLIC_URL;
  const url = publicBase ? `${publicBase.replace(/\/$/, '')}/${key}` : `/api/storage/${encodeURIComponent(key)}`;

  // Se for imagem de produto, já insere no banco
  if (productId) {
    const existingCount = await c.env.DB.prepare('SELECT COUNT(*) as count FROM product_images WHERE product_id = ?').bind(productId).first() as any;
    const isPrimary = (existingCount?.count || 0) === 0 ? 1 : 0;
    
    await c.env.DB.prepare(
      'INSERT INTO product_images (id, product_id, store_id, url, is_primary, sort_order, file_size_kb) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(crypto.randomUUID(), productId, effectiveStoreId, url, isPrimary, existingCount?.count || 0, Math.round(file.size / 1024)).run();
  }

  return c.json({ url, key, message: 'Upload realizado com sucesso!' });
});

// GET /api/storage/:key - servir arquivos do R2
upload.get('/storage/:key{.*}', async (c) => {
  const key = c.req.param('key');
  try {
    const obj = await c.env.STORAGE.get(decodeURIComponent(key));
    if (!obj) return c.json({ error: 'Arquivo não encontrado' }, 404);

    return new Response(obj.body, {
      headers: {
        'Content-Type': obj.httpMetadata?.contentType || 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000',
        'ETag': obj.etag
      }
    });
  } catch (e: any) {
    return c.json({ error: 'Erro ao buscar arquivo' }, 500);
  }
});

export default upload;
