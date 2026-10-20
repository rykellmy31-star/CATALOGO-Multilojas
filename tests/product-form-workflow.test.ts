import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(
  new URL('../frontend/src/pages/StoreAdmin/ProductForm.tsx', import.meta.url), 'utf8'
);

function handler(name: string): string {
  const declaration = source.indexOf(`const ${name} = async (`) >= 0
    ? source.indexOf(`const ${name} = async (`)
    : source.indexOf(`const ${name} = (`);
  if (declaration === -1) throw new Error(`Função ${name} não encontrada`);
  const next = source.indexOf('\n  const ', declaration + 1);
  return source.slice(declaration, next === -1 ? undefined : next);
}

describe('Editor de produtos: regressões de concorrência e segurança', () => {
  it('arquivo TSX tem sintaxe válida', () => {
    const parsed = ts.createSourceFile('ProductForm.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const syntax = ts.transpileModule(source, {
      fileName: 'ProductForm.tsx',
      reportDiagnostics: true,
      compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX }
    });
    expect(parsed.parseDiagnostics).toHaveLength(0);
    expect(syntax.diagnostics?.filter(x => x.category === ts.DiagnosticCategory.Error)).toEqual([]);
  });

  it('impede salvar enquanto imagens ou IA estão em andamento', () => {
    const submit = handler('handleSubmit');
    expect(submit).toContain('savingRef.current');
    expect(submit).toContain('galleryUploadingRef.current');
    expect(submit).toContain('aiUploadRef.current.pending');
    expect(submit).toContain('aiGeneratingRef.current');
    expect(submit).toContain('productPending');
  });

  it('não converte preço inválido silenciosamente para zero', () => {
    const submit = handler('handleSubmit');
    expect(submit).toContain('parseProductAmount(form.price)');
    expect(submit).not.toContain('parseFloat(form.price) || 0');
    expect(submit).toContain('savingRef.current = true');
    expect(submit).toContain('savingRef.current = false');
  });

  it('bloqueia upload de galeria durante salvamento e valida URL confirmada', () => {
    const upload = handler('handleImageUpload');
    expect(upload).toContain('galleryUploadingRef.current = true');
    expect(upload).toContain('galleryUploadingRef.current = false');
    expect(upload).toContain('savingRef.current');
    expect(upload).toContain('controller.signal');
    expect(upload).toContain("typeof data?.url !== 'string'");
  });

  it('imagem para IA vem de upload autenticado, nunca de FileReader', () => {
    const upload = handler('handleAIImageUpload');
    expect(upload).toContain('aiUploadRef.current');
    expect(upload).toContain("data.url.startsWith('/api/storage/')");
    expect(upload).toContain('controller.signal');
    expect(source).not.toContain('new FileReader');
  });

  it('gera apenas uma operação de IA mesmo com cliques rápidos', () => {
    const generate = handler('handleGenerateAI');
    expect(generate).toContain('if (aiGeneratingRef.current) return');
    expect(generate).toContain('aiGeneratingRef.current = true');
    expect(generate).toContain('aiGeneratingRef.current = false');
    expect(generate).toContain('aiRequestEpochRef.current');
  });

  it('descarta resposta antiga depois de trocar de produto', () => {
    expect(source).toContain('aiRequestEpochRef.current++');
    expect(source).toContain('if (epoch !== aiRequestEpochRef.current) return');
    expect(source).toContain('return () => controller.abort()');
    expect(source).toContain('loadedProductId !== id');
  });

  it('aplica imagem gerada uma única vez antes de liberar o botão', () => {
    const apply = handler('applyAIResult');
    expect(apply).toContain('applyingAIRef.current = true');
    expect(apply).toContain('applyingAIRef.current = false');
    expect(apply).toContain("api.post('/store/ai/approve-image'");
  });
});
