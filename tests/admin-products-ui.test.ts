import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL(
  '../frontend/src/pages/StoreAdmin/Products.tsx', import.meta.url
), 'utf8');

describe('Painel de produtos: navegação e busca sem respostas atrasadas', () => {
  it('mantém sintaxe TSX válida', () => {
    const result = ts.transpileModule(source, {
      fileName: 'Products.tsx',
      reportDiagnostics: true,
      compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX }
    });
    expect(result.diagnostics?.filter(
      error => error.category === ts.DiagnosticCategory.Error
    ) || []).toEqual([]);
  });

  it('cancela a busca anterior antes de iniciar outra página ou filtro', () => {
    expect(source).toContain('productsController.current?.abort()');
    expect(source).toContain('const controller = new AbortController()');
    expect(source).toContain('signal: controller.signal');
    expect(source).toContain('if (controller.signal.aborted) return');
  });

  it('somente o controlador atual pode liberar estado de carregamento', () => {
    expect(source).toContain('if (productsController.current === controller)');
    expect(source).toContain('setLoading(false)');
  });

  it('cancela consulta pendente ao sair do painel ou trocar filtro', () => {
    expect(source).toContain('return () => {');
    expect(source).toContain('productsController.current = null');
    expect(source).toContain('}, [q, status]');
  });
});
