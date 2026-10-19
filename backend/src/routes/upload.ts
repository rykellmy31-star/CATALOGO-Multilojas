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

upload.use('/', authMiddleware as any);

// POST /api/upload - upload de imagem
upload.post('/', async (c) => {
  const user = (c as any).get('user');
  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;
  const productId = formData.get('productId') as string | null;

  if (!file || typeof file === 'string') return c.json({ error: 'Nenhum arquivo enviado' }, 400);

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

  let effectiveStoreId = storeId || 'platform';
  if (productId) {
    const product = user.role === 'super_admin'
      ? await c.env.DB.prepare('SELECT store_id FROM products WHERE id = ?').bind(productId).first() as any
      : await c.env.DB.prepare('SELECT store_id FROM products WHERE id = ? AND store_id = ?').bind(productId, storeId).first() as any;
    if (!product) return c.json({ error: 'Produto não encontrado' }, 404);
    effectiveStoreId = product.store_id;
  }

  const arrayBuffer = await file.arrayBuffer();
  const ext = ({ 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' } as Record<string, string>)[file.type];
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
    console.error('Upload indisponível');
    return c.json({ error: 'Armazenamento indisponível. Tente novamente.' }, 503);
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
  if (!key.startsWith('stores/') || key.includes('..')) return c.json({ error: 'Arquivo não encontrado' }, 404);
  const image = await c.env.DB.prepare("SELECT pi.id FROM product_images pi JOIN products p ON pi.product_id = p.id AND pi.store_id = p.store_id JOIN stores s ON p.store_id = s.id WHERE pi.url = ? AND p.status = 'published' AND s.status = 'active'").bind(`/api/storage/${encodeURIComponent(key)}`).first();
  if (!image) return c.json({ error: 'Arquivo não encontrado' }, 404);
  try {
    const obj = await c.env.STORAGE.get(key);
    if (!obj) return c.json({ error: 'Arquivo não encontrado' }, 404);

    return new Response(obj.body, {
      headers: {
        'Content-Type': obj.httpMetadata?.contentType || 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000',
        'ETag': obj.etag,
        'X-Content-Type-Options': 'nosniff'
      }
    });
  } catch (e: any) {
    return c.json({ error: 'Erro ao buscar arquivo' }, 500);
  }
});

export default upload;
