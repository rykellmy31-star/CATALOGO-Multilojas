import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require('typescript') as typeof import('typescript');

const source = readFileSync(new URL('../frontend/src/pages/PublicCatalog/ProductDetail.tsx', import.meta.url), 'utf8');
const excerpt = source.split('  const handleWhatsApp = () => {')[0] +
  '  return { data, loading, selectedImage, showShare, routeKey };\n}\n';
const compiled = ts.transpileModule(excerpt, {
  fileName: 'ProductDetail.tsx', reportDiagnostics: true,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX }
});
if (compiled.diagnostics?.some(d => d.category === ts.DiagnosticCategory.Error)) {
  throw new Error('Produto não transpila: ' + compiled.diagnostics?.map(d => ts.flattenDiagnosticMessageText(d.messageText, ' ')));
}

function harness() {
  let params = { slug: 'loja-a', productSlug: 'produto-a' };
  const state: any[] = [], effects: any[] = [], calls: any[] = [];
  let index = 0, effectIndex = 0;
  function useState(initial: any) {
    const i = index++;
    if (!(i in state)) state[i] = initial;
    return [state[i], (v: any) => { state[i] = v; }];
  }
  function useEffect(callback: () => (() => void) | void, deps: any[]) {
    const i = effectIndex++;
    const previous = effects[i];
    if (!previous || deps.some((d: any, j: number) => d !== previous.deps[j])) {
      previous?.cleanup?.();
      effects[i] = { deps, cleanup: callback() };
    }
  }
  const api = { get(url: string, opts: unknown) {
    let resolve!: (value: unknown) => void, reject!: (value: unknown) => void;
    const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
    calls.push({ url, opts, resolve, reject });
    return promise;
  }};
  const module = { exports: {} as any };
  new Function('exports', 'require', compiled.outputText)(module.exports, (name: string) => {
    if (name === 'react') return { useState, useEffect };
    if (name === 'react-router-dom') return { useParams: () => params };
    if (name.endsWith('/api')) return { default: api };
    return {};
  });
  return {
    render: () => { index = 0; effectIndex = 0; return module.exports.default(); },
    calls, state,
    navigate: (next: typeof params) => { params = next; },
    unmount: () => { for (const effect of effects) effect.cleanup?.(); }
  };
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

describe('Navegação entre produtos sem dados anteriores', () => {
  it('carregamento inicial não mostra dados desconhecidos', () => {
    const h = harness(); expect(h.render()).toMatchObject({ loading: true, data: null });
  });
  it('requisições enviam sinal de cancelamento', () => {
    const h = harness(); h.render();
    expect(h.calls[0].url).toBe('/public/stores/loja-a/products/produto-a');
    expect(h.calls[0].opts.signal).toBeInstanceOf(AbortSignal);
  });
  it('trocar rota apaga imediatamente o produto antigo', async () => {
    const h = harness(); h.render();
    h.calls[0].resolve({ data: { product: { id: 'a' } } }); await flush();
    expect(h.render().data.product.id).toBe('a');
    h.navigate({ slug: 'loja-b', productSlug: 'produto-b' });
    expect(h.render()).toMatchObject({ loading: true, data: null });
    expect(h.calls[0].opts.signal.aborted).toBe(true);
  });
  it('resposta atrasada não sobrescreve produto atual', async () => {
    const h = harness(); h.render();
    h.navigate({ slug: 'loja-b', productSlug: 'produto-b' }); h.render();
    h.calls[1].resolve({ data: { product: { id: 'b' } } }); await flush();
    expect(h.render().data.product.id).toBe('b');
    h.calls[0].resolve({ data: { product: { id: 'a' } } }); await flush();
    expect(h.render().data.product.id).toBe('b');
  });
  it('ao desmontar, aborta o carregamento e ignora resposta tardia', async () => {
    const h = harness(); h.render(); h.unmount();
    expect(h.calls[0].opts.signal.aborted).toBe(true);
    h.calls[0].resolve({ data: { product: { id: 'a' } } }); await flush();
    expect(h.render().data).toBeNull();
  });
});
