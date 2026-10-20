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

// Objetos legados do R2 não podem determinar Content-Type arbitrário na nossa origem.
// Recusar inclusive MIME ausente e MIME composto evita interpretação como HTML/SVG/JS.
function normalizeStoredImageType(contentType?: string): string | null {
  const type = contentType?.trim().toLowerCase();
  if (type === 'image/jpg') return 'image/jpeg';
  if (type === 'image/jpeg' || type === 'image/png' ||
      type === 'image/webp' || type === 'image/gif') return type;
  return null;
}

const upload = new Hono<Env>();

upload.use('/', authMiddleware as any);

// GET /api/upload/preview/:key — prévia privada autenticada, sem token na URL.
// Compatível com clientes que requisitam o arquivo via Authorization e blob.
upload.get('/preview/:key{.*}', authMiddleware as any, async (c) => {
  const key = c.req.param('key');
  const parts = key.split('/');
  if (parts.length !== 5 || parts[0] !== 'stores' || parts[2] !== 'products' ||
      !/^[a-z0-9_-]{1,128}$/i.test(parts[1]) ||
      !/^[a-z0-9_-]{1,128}$/i.test(parts[3]) ||
      !/^[a-z0-9-]{1,128}\.(?:jpe?g|png|webp|gif)$/i.test(parts[4])) {
    return c.json({ error: 'Arquivo não encontrado' }, 404);
  }
  const user = (c as any).get('user');
  if (user.role !== 'super_admin' && parts[1] !== user.storeId) {
    return c.json({ error: 'Arquivo não encontrado' }, 404);
  }
  try {
    const obj = await c.env.STORAGE.get(key);
    if (!obj) return c.json({ error: 'Arquivo não encontrado' }, 404);
    const type = normalizeStoredImageType(obj.httpMetadata?.contentType);
    if (!type) return c.json({ error: 'Arquivo não encontrado' }, 404);
    return new Response(obj.body, {
      headers: {
        'Content-Type': type,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  } catch {
    return c.json({ error: 'Não foi possível carregar a imagem' }, 503);
  }
});

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
  const bytes = new Uint8Array(arrayBuffer);
  const mime = file.type === 'image/jpg' ? 'image/jpeg' : file.type;
  // Comparar a assinatura completa: cabeçalhos parciais não são imagens válidas.
  const png = [137, 80, 78, 71, 13, 10, 26, 10];
  const validImage = mime === 'image/png'
    ? bytes.length >= 8 && png.every((value, i) => bytes[i] === value)
    : mime === 'image/webp'
      ? bytes.length >= 12 &&
        String.fromCharCode(...bytes.subarray(0, 4)) === 'RIFF' &&
        String.fromCharCode(...bytes.subarray(8, 12)) === 'WEBP'
      : mime === 'image/gif'
        ? bytes.length >= 6 && /^GIF8[79]a$/.test(String.fromCharCode(...bytes.subarray(0, 6)))
        : bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (!validImage) return c.json({ error: 'Conteúdo de imagem inválido' }, 400);
  const ext = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' } as Record<string, string>)[mime];
  // UUID criptográfico reduz colisões de uploads simultâneos.
  const key = `stores/${effectiveStoreId}/products/${productId || 'general'}/${crypto.randomUUID()}.${ext}`;

  try {
    await c.env.STORAGE.put(key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type === 'image/jpg' ? 'image/jpeg' : file.type,
        cacheControl: 'no-store'
      }
    });
  } catch (e: any) {
    console.error('Upload indisponível');
    return c.json({ error: 'Armazenamento indisponível. Tente novamente.' }, 503);
  }

  // URLs diretas do R2 contornariam o status de publicação do produto.
  const url = `/api/storage/${encodeURIComponent(key)}`;

  // Registra a imagem em uma instrução que recalcula ordem, vínculo e primária
  // no momento da gravação. Falhas no D1 removem o objeto recém-criado do R2.
  if (productId) {
    try {
      const inserted = await c.env.DB.prepare(`
        INSERT INTO product_images (id, product_id, store_id, url, is_primary, sort_order, file_size_kb)
        SELECT ?, p.id, p.store_id, ?,
          CASE WHEN NOT EXISTS (
            SELECT 1 FROM product_images AS pi
            WHERE pi.product_id = p.id AND pi.store_id = p.store_id
          ) THEN 1 ELSE 0 END,
          COALESCE((
            SELECT MAX(pi.sort_order) + 1 FROM product_images AS pi
            WHERE pi.product_id = p.id AND pi.store_id = p.store_id
          ), 0), ?
        FROM products AS p
        WHERE p.id = ? AND p.store_id = ?
      `).bind(crypto.randomUUID(), url, Math.round(file.size / 1024),
        productId, effectiveStoreId).run();
      if (inserted.success === false || inserted.meta?.changes !== 1) {
        throw new Error('Imagem não registrada');
      }
    } catch {
      try {
        await c.env.STORAGE.delete(key);
      } catch {
        console.error('Falha ao limpar arquivo de upload não registrado');
      }
      return c.json({ error: 'Não foi possível registrar a imagem. Tente novamente.' }, 503);
    }
  }

  return c.json({ url, key, message: 'Upload realizado com sucesso!' });
});

// GET /api/storage/:key - servir arquivos do R2
upload.get('/storage/:key{.*}', async (c) => {
  const key = c.req.param('key');
  if (!key.startsWith('stores/') || key.includes('..')) return c.json({ error: 'Arquivo não encontrado' }, 404);
  const image = await c.env.DB.prepare("SELECT pi.id FROM product_images pi JOIN products p ON pi.product_id = p.id AND pi.store_id = p.store_id JOIN stores s ON p.store_id = s.id WHERE pi.url = ? AND p.status = 'published' AND s.status = 'active' AND pi.store_id = ?").bind(`/api/storage/${encodeURIComponent(key)}`, key.split('/')[1]).first();
  const url = `/api/storage/${encodeURIComponent(key)}`;
  const branding = image ? null : await c.env.DB.prepare(`SELECT id FROM stores WHERE status = 'active' AND id = ? AND (logo_url = ? OR banner_url = ?)
    UNION ALL SELECT b.id FROM banners b JOIN stores s ON b.store_id = s.id WHERE b.store_id = ? AND b.image_url = ? AND b.is_active = 1 AND s.status = 'active'`).bind(key.split('/')[1], url, url, key.split('/')[1], url).first();
  if (!image && !branding) return c.json({ error: 'Arquivo não encontrado' }, 404);
  try {
    const obj = await c.env.STORAGE.get(key);
    if (!obj) return c.json({ error: 'Arquivo não encontrado' }, 404);

    // Nunca servir metadados R2 que possam forçar execução no navegador.
    const type = normalizeStoredImageType(obj.httpMetadata?.contentType);
    if (!type) return c.json({ error: 'Arquivo não encontrado' }, 404);

    return new Response(obj.body, {
      headers: {
        'Content-Type': type,
        // A publicação pode ser revogada; imagens não devem permanecer em cache.
        'Cache-Control': 'no-store',
        'ETag': obj.etag,
        'X-Content-Type-Options': 'nosniff'
      }
    });
  } catch (e: any) {
    return c.json({ error: 'Erro ao buscar arquivo' }, 500);
  }
});

export default upload;
