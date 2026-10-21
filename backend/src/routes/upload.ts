import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { reserveStorageBytes, releaseStorageBytes } from '../utils/storageQuota.js';

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
  const contentType = c.req.header('Content-Type') || '';
  if (!/^multipart\/form-data(?:;|$)/i.test(contentType)) {
    return c.json({ error: 'Envie a imagem por formulário multipart' }, 400);
  }

  let formData: FormData;
  try {
    formData = await c.req.formData();
  } catch {
    return c.json({ error: 'Formulário de upload inválido' }, 400);
  }
  const file = formData.get('file');
  const requestedProduct = formData.get('productId');
  if (requestedProduct !== null && (
    typeof requestedProduct !== 'string' ||
    !/^[a-z0-9_-]{1,128}$/i.test(requestedProduct)
  )) return c.json({ error: 'Identificador de produto inválido' }, 400);
  const productId = requestedProduct as string | null;

  if (!file || typeof file === 'string') return c.json({ error: 'Nenhum arquivo enviado' }, 400);
  if (file.size === 0) return c.json({ error: 'Arquivo vazio não pode ser enviado' }, 400);

  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/gif'];
  if (!allowed.includes(file.type)) {
    return c.json({ error: 'Tipo de arquivo não permitido. Use JPG, PNG, WEBP ou GIF.' }, 400);
  }

  if (file.size > 10 * 1024 * 1024) {
    return c.json({ error: 'Arquivo muito grande. Máximo: 10MB.' }, 400);
  }

  const storeId = user.storeId as string | null;
  // Super Admin sem produto precisa indicar explicitamente a loja alvo.
  const requestedStore = formData.get('storeId');
  if (user.role !== 'super_admin' && !storeId) {
    return c.json({ error: 'Loja não identificada' }, 400);
  }
  let effectiveStoreId = storeId;
  if (productId) {
    const product = user.role === 'super_admin'
      ? await c.env.DB.prepare('SELECT store_id FROM products WHERE id = ?').bind(productId).first() as any
      : await c.env.DB.prepare('SELECT store_id FROM products WHERE id = ? AND store_id = ?').bind(productId, storeId).first() as any;
    if (!product) return c.json({ error: 'Produto não encontrado' }, 404);
    effectiveStoreId = product.store_id;
  } else if (user.role === 'super_admin') {
    if (typeof requestedStore !== 'string' || !/^[a-z0-9_-]{1,128}$/i.test(requestedStore)) {
      return c.json({ error: 'Selecione a loja para enviar imagens' }, 400);
    }
    effectiveStoreId = requestedStore;
  }
  if (!effectiveStoreId) return c.json({ error: 'Loja não identificada' }, 400);

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

  const quota = await reserveStorageBytes(c.env.DB, effectiveStoreId, file.size);
  if (quota === 'store_unavailable') {
    return c.json({ error: 'Loja não encontrada ou indisponível' }, 404);
  }
  if (quota === 'quota_exceeded') {
    return c.json({ error: 'Limite de armazenamento da loja atingido' }, 413);
  }

  // A reserva cobre uploads ainda em trânsito e impede ultrapassar a
  // capacidade em concorrência. Em falhas, compensa a reserva.
  let uploaded = false;
  try {
    const stored = await c.env.STORAGE.put(key, arrayBuffer, {
      httpMetadata: {
        contentType: mime,
        cacheControl: 'no-store'
      }
    });
    if (!stored) throw new Error('R2 não confirmou o arquivo');
    uploaded = true;

    // URLs diretas do R2 contornariam o status de publicação do produto.
    const url = `/api/storage/${encodeURIComponent(key)}`;
    if (productId) {
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
      if (inserted.meta?.changes !== 1) {
        throw new Error('Imagem não registrada no produto');
      }
    }
    return c.json({ url, key, message: 'Upload realizado com sucesso!' });
  } catch {
    let canRelease = !uploaded;
    if (uploaded) {
      try {
        await c.env.STORAGE.delete(key);
        canRelease = true;
      } catch {
        // Se a exclusão falhou, a cota permanece reservada para o objeto
        // que pode ainda estar ocupando espaço físico no R2.
        console.error('Falha ao limpar arquivo R2 após upload');
      }
    }
    if (canRelease) {
      try { await releaseStorageBytes(c.env.DB, effectiveStoreId, file.size); }
      catch { console.error('Falha ao devolver reserva de armazenamento'); }
    }
    return c.json({ error: 'Não foi possível concluir o envio. Tente novamente.' }, 503);
  }


});

// GET /api/storage/:key - servir arquivos do R2
upload.get('/storage/:key{.*}', async (c) => {
  const key = c.req.param('key');
  if (!key.startsWith('stores/') || key.includes('..')) return c.json({ error: 'Arquivo não encontrado' }, 404);
  const image = await c.env.DB.prepare("SELECT pi.id FROM product_images pi JOIN products p ON pi.product_id = p.id AND pi.store_id = p.store_id JOIN stores s ON p.store_id = s.id WHERE pi.url = ? AND p.status = 'published' AND s.status = 'active' AND pi.store_id = ?").bind(`/api/storage/${encodeURIComponent(key)}`, key.split('/')[1]).first();
  const url = `/api/storage/${encodeURIComponent(key)}`;
  const branding = image ? null : await c.env.DB.prepare(`SELECT id FROM stores WHERE status = 'active' AND id = ? AND (logo_url = ? OR banner_url = ?)
    UNION ALL SELECT b.id FROM banners b
      JOIN stores s ON b.store_id = s.id
      WHERE b.store_id = ? AND b.image_url = ? AND b.is_active = 1
        AND s.status = 'active'
        AND (b.starts_at IS NULL OR julianday(b.starts_at) <= julianday('now'))
        AND (b.ends_at IS NULL OR julianday(b.ends_at) > julianday('now'))`).bind(key.split('/')[1], url, url, key.split('/')[1], url).first();
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
