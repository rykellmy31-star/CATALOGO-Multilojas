import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(
  new URL('../frontend/src/pages/PublicCatalog/Catalog.tsx', import.meta.url), 'utf8'
);

describe('Catálogo: atualização leve de campanhas', () => {
  it('mantém sintaxe TSX válida', () => {
    const result = ts.transpileModule(source, {
      fileName: 'Catalog.tsx',
      reportDiagnostics: true,
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext }
    });
    expect(result.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error) || [])
      .toEqual([]);
  });

  it('não recarrega a home nem contabiliza visita a cada atualização', () => {
    expect(source).toContain('api.get(`/public/stores/${slug}/banners`');
    expect(source).toContain('setBanners(data.banners || [])');
    expect(source).toContain('window.setTimeout(() => refreshBanners(true), delay)');
    expect(source).toContain('setNextBannerTransitionAt(data.next_transition_at || null)');
    expect(source).not.toContain('window.setInterval(');
  });

  it('faz refresh ao retornar para a aba ou janela', () => {
    expect(source).toContain("document.addEventListener('visibilitychange', refreshOnFocus)");
    expect(source).toContain("window.addEventListener('focus', refreshOnFocus)");
    expect(source).toContain("document.visibilityState !== 'visible'");
  });

  it('evita requisições de atualização excessivas ao alternar foco', () => {
    expect(source).toContain('Date.now() - lastRefresh < 5000');
    expect(source).toContain('if (!force && Date.now() - lastRefresh < 5000) return');
    expect(source).toContain('controller?.abort()');
  });

  it('limpa listeners e intervalo ao sair ou mudar de loja', () => {
    expect(source).toContain('window.clearTimeout(transitionTimer)');
    expect(source).toContain("window.removeEventListener('focus', refreshOnFocus)");
    expect(source).toContain("document.removeEventListener('visibilitychange', refreshOnFocus)");
    expect(source).toContain('}, [slug, nextBannerTransitionAt])');
  });

  it('nunca estoura timeout de campanhas muito distantes', () => {
    expect(source).toContain('2_147_000_000');
    expect(source).toContain('Math.max(1000, Math.min(');
  });

  it('limpa banners quando o servidor informa que a loja não existe', () => {
    expect(source).toContain("error?.response?.status === 404");
    expect(source).toContain('setBanners([])');
  });
});
