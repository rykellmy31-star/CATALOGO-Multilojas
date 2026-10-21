import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const page = readFileSync(new URL(
  '../frontend/src/pages/SuperAdmin/StoreDetail.tsx', import.meta.url
), 'utf8');

describe('Super Admin: segurança da auditoria paginada', () => {
  it('a tela TSX mantém sintaxe válida', () => {
    const transpile = ts.transpileModule(page, {
      fileName: 'StoreDetail.tsx', reportDiagnostics: true,
      compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX }
    });
    expect(transpile.diagnostics?.filter(
      x => x.category === ts.DiagnosticCategory.Error
    ) || []).toEqual([]);
  });

  it('só calcula a conciliação pelo consolidador de páginas', () => {
    expect(page).toContain('mergeStorageAuditPage(');
    expect(page).toContain('audit.complete &&');
    expect(page).toContain('audit.differenceMb');
    expect(page).not.toContain('audit.result.reconciliation');
  });

  it('não acessa campos de auditoria nula ao trocar de loja', () => {
    expect(page).toContain('{audit && audit.storeId === id && (');
    expect(page).toContain('setAudit(null)');
    expect(page).toContain('auditProgressRef.current = null');
  });

  it('descarta resultados atrasados ao navegar entre lojas', () => {
    expect(page).toContain('controller.abort()');
    expect(page).toContain('currentStoreIdRef.current !== requestedId');
    expect(page).toContain('auditProgressRef.current = null');
  });

  it('exige ação manual e não apresenta opção de apagar arquivos', () => {
    expect(page).toContain('onClick={() => fetchStorageAudit()}');
    expect(page).toContain('Nenhum arquivo será excluído');
    expect(page).not.toContain("api.delete('/superadmin/stores/");
  });
});
