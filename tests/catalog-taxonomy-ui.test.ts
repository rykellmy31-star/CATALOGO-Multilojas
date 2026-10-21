import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const pages = [
  {
    path: '../frontend/src/pages/StoreAdmin/Categories.tsx',
    label: 'Categorias',
    route: '/store/categories',
    error: 'Não foi possível salvar a categoria'
  },
  {
    path: '../frontend/src/pages/StoreAdmin/Brands.tsx',
    label: 'Marcas',
    route: '/store/brands',
    error: 'Não foi possível salvar a marca'
  }
];

describe.each(pages)('Painel de $label', ({ path, label, route, error }) => {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');

  it('é TSX sintaticamente válido', () => {
    const result = ts.transpileModule(source, {
      fileName: label + '.tsx',
      reportDiagnostics: true,
      compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX }
    });
    expect(result.diagnostics?.filter(x => x.category === ts.DiagnosticCategory.Error) || []).toEqual([]);
  });

  it('bloqueia cliques repetidos antes da primeira resposta HTTP', () => {
    expect(source).toContain('if (savingRef.current) return;');
    expect(source).toContain('savingRef.current = true;');
    expect(source).toContain('savingRef.current = false;');
    expect(source).toContain('disabled={saving}');
    expect(source).toContain('finally {');
  });

  it('não envia cadastro com somente espaços', () => {
    expect(source).toContain('const trimmedName = name.trim();');
    expect(source).toContain('if (trimmedName.length < 2)');
    expect(source).toContain('name: trimmedName');
  });

  it('exibe mensagem do backend para conflito de slug', () => {
    expect(source).toContain('error?.response?.data?.error');
    expect(source).toContain(error);
    expect(source).toContain(route);
  });
});
