import { describe, expect, it } from 'vitest';
import {
  mergeStorageAuditPage, type StorageAuditPage
} from '../frontend/src/lib/storageAuditProgress';

const aPage = (overrides: Partial<StorageAuditPage> = {}): StorageAuditPage => ({
  store_id: 'a',
  mode: 'read_only',
  quota: { recorded_used_mb: 4, limit_mb: 20 },
  scanned: {
    objects: 2, bytes: 1048576, referenced: 1, unreferenced: 1,
    older_than_7_days_for_review: 1, unknown_upload_date: 0
  },
  review_candidates: [
    { key: 'stores/a/products/general/orphan.png', size_bytes: 512, uploaded_at: '2026-10-01T00:00:00Z' }
  ],
  pagination: { has_more: true, next_cursor: 'page-two' },
  ...overrides
});

describe('Conciliação acumulada de páginas R2 no Super Admin', () => {
  it('não compara cota após primeira página incompleta', () => {
    const value = mergeStorageAuditPage(null, aPage());
    expect(value).toMatchObject({
      storeId: 'a', pages: 1, objects: 2, bytes: 1048576,
      referenced: 1, unreferenced: 1, complete: false,
      differenceMb: null, nextCursor: 'page-two'
    });
  });

  it('acumula todas as páginas antes de calcular divergência de armazenamento', () => {
    const first = mergeStorageAuditPage(null, aPage());
    const result = mergeStorageAuditPage(first, aPage({
      scanned: {
        objects: 1, bytes: 524288, referenced: 1, unreferenced: 0,
        older_than_7_days_for_review: 0, unknown_upload_date: 0
      },
      review_candidates: [],
      pagination: { has_more: false, next_cursor: null }
    }), 'page-two');
    expect(result).toMatchObject({
      pages: 2, objects: 3, bytes: 1572864,
      referenced: 2, unreferenced: 1,
      complete: true, nextCursor: null
    });
    expect(result.differenceMb).toBeCloseTo(1.5 - 4);
  });

  it('não usa contador de outra loja ao somar páginas', () => {
    const first = mergeStorageAuditPage(null, aPage());
    expect(() => mergeStorageAuditPage(first, aPage({
      store_id: 'b'
    }), 'page-two')).toThrow('Sequência de páginas inconsistente');
  });

  it('bloqueia cursor repetido que causaria ciclo', () => {
    const first = mergeStorageAuditPage(null, aPage());
    expect(() => mergeStorageAuditPage(first, aPage({
      pagination: { has_more: true, next_cursor: 'page-two' }
    }), 'page-two')).toThrow('Paginação R2 sem avanço');
  });

  it('não permite somar novamente páginas depois da conclusão', () => {
    const finished = mergeStorageAuditPage(null, aPage({
      pagination: { has_more: false, next_cursor: null }
    }));
    expect(() => mergeStorageAuditPage(finished, aPage(), 'page-two')).toThrow();
  });

  it('não aceita começar pelo meio da paginação', () => {
    expect(() => mergeStorageAuditPage(null, aPage(), 'page-two')).toThrow();
  });

  it('exige contagens consistentes na resposta', () => {
    expect(() => mergeStorageAuditPage(null, aPage({
      scanned: { objects: 1, bytes: 10, referenced: 2, unreferenced: 1,
        older_than_7_days_for_review: 1, unknown_upload_date: 0 }
    }))).toThrow('Contagens de auditoria inconsistentes');
  });

  it('limita a memória usada para guardar candidatos exibidos', () => {
    const candidates = Array.from({ length: 60 }, (_, i) => ({
      key: `stores/a/products/general/file-${i}.png`,
      size_bytes: 100, uploaded_at: '2026-10-01T00:00:00Z'
    }));
    const page = aPage({
      scanned: { objects: 60, bytes: 6000, referenced: 0, unreferenced: 60,
        older_than_7_days_for_review: 60, unknown_upload_date: 0 },
      review_candidates: candidates,
      pagination: { has_more: false, next_cursor: null }
    });
    const result = mergeStorageAuditPage(null, page);
    expect(result.reviewCandidatesCount).toBe(60);
    expect(result.reviewCandidates).toHaveLength(50);
  });

  it('não inventa ajuste automático mesmo com divergência', () => {
    const result = mergeStorageAuditPage(null, aPage({
      pagination: { has_more: false, next_cursor: null }
    }));
    expect(result.complete).toBe(true);
    expect(result.differenceMb).toBe(-3);
  });
});
