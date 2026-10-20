import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixture } from './helpers';
import { auditStoreStorage, validateStorageAuditOptions } from '../backend/src/utils/storageAudit';

let f: ReturnType<typeof fixture> | undefined;
afterEach(() => { f?.db.close(); f = undefined; });

const old = new Date('2026-08-01T12:00:00.000Z');
const recent = new Date('2026-10-19T12:00:00.000Z');
const now = new Date('2026-10-20T12:00:00.000Z');
const key = (name: string, store = 'a') => `stores/${store}/products/general/${name}.png`;
const url = (name: string) => '/api/storage/' + encodeURIComponent(key(name));
const object = (name: string, uploaded: Date = old, store = 'a') => ({
  key: key(name, store), size: 2048, uploaded
});

function setup(objects = [object('used'), object('orphan'), object('fresh', recent)],
               truncated = false, cursor = 'next-page') {
  f = fixture();
  const list = vi.fn(async (_options: unknown) => ({
    objects, truncated, cursor: truncated ? cursor : undefined,
    delimitedPrefixes: []
  }));
  const del = vi.fn();
  const put = vi.fn();
  (f.env as any).STORAGE = { list, delete: del, put };
  const adminToken = f.token('root', null, 'super_admin');
  const request = (suffix = '') =>
    f!.request('/api/superadmin/stores/a/storage-audit' + suffix, 'GET', undefined, adminToken);
  return { list, del, put, request };
}

describe('Auditoria R2 sem mutação de produção', () => {
  it('classifica referência, órfão antigo e upload recente separadamente', async () => {
    const { request, list, del, put } = setup();
    f!.db.prepare(
      'INSERT INTO product_images (id, product_id, store_id, url) VALUES (?, ?, ?, ?)'
    ).run('image-a', 'pa', 'a', url('used'));
    f!.db.prepare('UPDATE stores SET storage_used_mb = 2.5, storage_limit_mb = 10 WHERE id = ?').run('a');

    const response = await request();
    expect(response.status).toBe(200);
    const result = await response.json() as any;
    expect(result.mode).toBe('read_only');
    expect(result.page_scope_only).toBe(true);
    expect(result.scanned).toMatchObject({
      objects: 3, bytes: 6144, referenced: 1, unreferenced: 2,
      older_than_7_days_for_review: 1
    });
    expect(result.review_candidates.map((x: any) => x.key)).toEqual([key('orphan')]);
    expect(result.quota).toMatchObject({ recorded_used_mb: 2.5, limit_mb: 10 });
    expect(result.complete_store_scan).toBe(true);
    expect(result.reconciliation).toMatchObject({
      is_complete_snapshot: true, automatic_adjustment: false
    });
    expect(result.reconciliation.actual_r2_mb).toBeCloseTo(6144 / 1048576);
    expect(result.reconciliation.difference_mb).toBeCloseTo(6144 / 1048576 - 2.5);
    expect((f!.db.prepare("SELECT storage_used_mb FROM stores WHERE id = 'a'").get() as any).storage_used_mb).toBe(2.5);
    expect(list.mock.calls[0][0]).toMatchObject({ prefix: 'stores/a/', limit: 100 });
    expect(del).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  it('reconhece todas as referências possíveis de imagem, sem falsas exclusões', async () => {
    const names = ['image', 'thumb', 'medium', 'banner', 'logo', 'brand-banner', 'ai-source', 'ai-output'];
    const { request } = setup(names.map(n => object(n)));
    f!.db.prepare(
      'INSERT INTO product_images (id, product_id, store_id, url, thumbnail_url, medium_url) VALUES (?, ?, ?, ?, ?, ?)'
    ).run('image-a', 'pa', 'a', url('image'), url('thumb'), url('medium'));
    f!.db.prepare('INSERT INTO banners (id, store_id, image_url) VALUES (?, ?, ?)')
      .run('banner-a', 'a', url('banner'));
    f!.db.prepare('UPDATE stores SET logo_url = ?, banner_url = ? WHERE id = ?')
      .run(url('logo'), url('brand-banner'), 'a');
    f!.db.prepare(`
      INSERT INTO ai_generations (id, store_id, user_id, type, status, input_image_url, generated_image_url)
      VALUES (?, ?, ?, 'image', 'completed', ?, ?)
    `).run('generation-a', 'a', 'ua', url('ai-source'), url('ai-output'));

    const response = await request();
    expect(response.status).toBe(200);
    const result = await response.json() as any;
    expect(result.scanned.referenced).toBe(8);
    expect(result.scanned.unreferenced).toBe(0);
    expect(result.review_candidates).toEqual([]);
  });

  it('retorna cursor e deixa explícito que os números pertencem à página', async () => {
    const { request, list } = setup([object('first')], true, 'opaque_cursor_value');
    const response = await request('?limit=10&cursor=previous_cursor');
    expect(response.status).toBe(200);
    const result = await response.json() as any;
    expect(result.complete_store_scan).toBe(false);
    expect(result.reconciliation).toEqual({
      is_complete_snapshot: false, actual_r2_mb: null,
      difference_mb: null, automatic_adjustment: false
    });
    expect(result.pagination).toEqual({ has_more: true, next_cursor: 'opaque_cursor_value' });
    expect(result.scanned.objects).toBe(1);
    expect(list.mock.calls[0][0]).toMatchObject({
      prefix: 'stores/a/', limit: 10, cursor: 'previous_cursor'
    });
  });

  it('não trata data desconhecida como motivo para excluir arquivo', async () => {
    const { request } = setup([{ key: key('unknown'), size: 9, uploaded: undefined as any }]);
    const result = await (await request()).json() as any;
    expect(result.scanned.unknown_upload_date).toBe(1);
    expect(result.scanned.older_than_7_days_for_review).toBe(0);
  });

  it('página vazia não executa SQL de URLs e não sugere limpeza', async () => {
    const { request, del } = setup([]);
    const response = await request();
    expect(response.status).toBe(200);
    const result = await response.json() as any;
    expect(result.scanned.objects).toBe(0);
    expect(result.review_candidates).toEqual([]);
    expect(result.reconciliation.actual_r2_mb).toBe(0);
    expect(del).not.toHaveBeenCalled();
  });

  it('não presume que página posterior represente o uso total da loja', async () => {
    const { request } = setup([object('other')], false);
    const response = await request('?cursor=second-page');
    expect(response.status).toBe(200);
    const result = await response.json() as any;
    expect(result.complete_store_scan).toBe(false);
    expect(result.reconciliation.actual_r2_mb).toBeNull();
  });

  it('nunca mistura chave de outra loja no relatório', async () => {
    const { request } = setup([object('private', old, 'b')]);
    expect((await request()).status).toBe(503);
  });

  it('recusa cursor inválido ou limite fora de 1 a 100', async () => {
    const { request, list } = setup();
    for (const query of ['?limit=0', '?limit=101', '?limit=1e2', '?limit=3.5',
      '?cursor=', '?cursor=' + 'x'.repeat(4100)]) {
      expect((await request(query)).status).toBe(400);
    }
    expect(list).not.toHaveBeenCalled();
    expect(validateStorageAuditOptions({ limit: 100 })).toBe(true);
    expect(validateStorageAuditOptions({ limit: 101 })).toBe(false);
  });

  it('somente Super Admin pode auditar os arquivos por loja', async () => {
    const { request, list } = setup();
    expect((await f!.request('/api/superadmin/stores/a/storage-audit')).status).toBe(403);
    expect((await f!.request('/api/superadmin/stores/a/storage-audit', 'GET', undefined, null)).status).toBe(401);
    expect((await request()).status).toBe(200);
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('loja inexistente retorna 404 e não consulta o bucket', async () => {
    const { list } = setup();
    const response = await f!.request('/api/superadmin/stores/inexistente/storage-audit',
      'GET', undefined, f!.token('root', null, 'super_admin'));
    expect(response.status).toBe(404);
    expect(list).not.toHaveBeenCalled();
  });

  it('falha de listagem não promove limpeza nem altera quota', async () => {
    const { request, list, del } = setup();
    list.mockRejectedValueOnce(new Error('R2 indisponível'));
    expect((await request()).status).toBe(503);
    expect(del).not.toHaveBeenCalled();
    expect((f!.db.prepare("SELECT storage_used_mb FROM stores WHERE id = 'a'").get() as any).storage_used_mb).toBe(0);
  });

  it('listagem truncada sem cursor não produz relatório enganoso', async () => {
    const { request } = setup([object('old')], true, '');
    expect((await request()).status).toBe(503);
  });
});
