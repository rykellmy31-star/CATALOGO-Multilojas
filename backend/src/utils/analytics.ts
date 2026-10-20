/** Analytics de catálogo: limites, sessões privadas e contadores deduplicados. */
const eventTypes = new Set(['whatsapp_click', 'share_click', 'search', 'interest_list', 'banner_click']);
export type AnalyticsEvent = { event_type: string; product_id?: string; metadataJson: string | null };

export function parseAnalyticsEvent(input: unknown): AnalyticsEvent | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const data = input as Record<string, unknown>;
  if (Object.keys(data).some(key => !['event_type', 'product_id', 'metadata'].includes(key))) return null;
  if (typeof data.event_type !== 'string' || !eventTypes.has(data.event_type)) return null;
  const productId = data.product_id;
  if (productId !== undefined && (typeof productId !== 'string' || !/^[a-z0-9_-]{1,128}$/i.test(productId))) return null;
  if (data.event_type === 'whatsapp_click' && !productId) return null;
  let metadataJson: string | null = null;
  if (data.metadata !== undefined) {
    if (!data.metadata || typeof data.metadata !== 'object' || Array.isArray(data.metadata)) return null;
    try {
      metadataJson = JSON.stringify(data.metadata);
      if (new TextEncoder().encode(metadataJson).byteLength > 1024) return null;
    } catch { return null; }
  }
  return { event_type: data.event_type, ...(productId ? { product_id: productId as string } : {}), metadataJson };
}

export function parseAnalyticsSessionId(value: string | undefined): string | null {
  if (value === undefined) return 'anon';
  return /^[a-z0-9_-]{1,128}$/i.test(value) ? value : null;
}

export async function analyticsRateLimitKey(secret: string, ip: string, storeId: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret + ':analytics:' + storeId + ':' + ip));
  return 'analytics:' + Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

export async function hashAnalyticsSessionId(secret: string, sessionId: string, storeId: string): Promise<string> {
  if (!secret || secret.length < 32 || !storeId) throw new Error('Segredo ou loja de analytics indisponível');
  if (sessionId === 'anon') return 'anon';
  if (parseAnalyticsSessionId(sessionId) !== sessionId) throw new Error('Sessão inválida');
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode('catalogo:analytics:session:v1:' + JSON.stringify([storeId, sessionId])));
  return 's:' + Array.from(new Uint8Array(sig), b => b.toString(16).padStart(2, '0')).join('');
}

export async function recordUniquePublicView(
  db: D1Database, eventType: 'catalog_view' | 'product_view', storeId: string,
  productId: string | null, sessionId: string, secret: string
): Promise<boolean> {
  if (sessionId === 'anon' || parseAnalyticsSessionId(sessionId) !== sessionId) return false;
  if (!secret || secret.length < 32) return false;
  if ((eventType === 'product_view') !== Boolean(productId)) return false;
  const storedSessionId = await hashAnalyticsSessionId(secret, sessionId, storeId);
  const eventId = crypto.randomUUID();
  const insert = db.prepare(
    'INSERT INTO analytics_events (id, store_id, product_id, event_type, session_id) ' +
    'SELECT ?, ?, ?, ?, ? WHERE (? IS NULL OR EXISTS ' +
    '(SELECT 1 FROM products WHERE id = ? AND store_id = ?)) AND NOT EXISTS (' +
    'SELECT 1 FROM analytics_events WHERE store_id = ? AND event_type = ? AND session_id = ? ' +
    "AND product_id IS ? AND created_at >= datetime('now', '-1 day'))"
  ).bind(eventId, storeId, productId, eventType, storedSessionId,
    productId, productId, storeId, storeId, eventType, storedSessionId, productId);
  if (eventType === 'product_view' && productId) {
    const increment = db.prepare(
      'UPDATE products SET views = views + 1 WHERE id = ? AND store_id = ? ' +
      'AND EXISTS (SELECT 1 FROM analytics_events WHERE id = ?)'
    ).bind(productId, storeId, eventId);
    const [result] = await db.batch([insert, increment]);
    return result?.meta?.changes === 1;
  }
  const result = await insert.run();
  return result.meta?.changes === 1;
}
