import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const page = readFileSync(new URL(
  '../frontend/src/pages/StoreAdmin/Settings.tsx', import.meta.url
), 'utf8');

describe('Configurações: integração do formulário com a API', () => {
  it('mantém TSX sem erros de sintaxe', () => {
    const result = ts.transpileModule(page, {
      fileName: 'Settings.tsx',
      reportDiagnostics: true,
      compilerOptions: {
        module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX
      }
    });
    expect(result.diagnostics?.filter(
      d => d.category === ts.DiagnosticCategory.Error
    ) || []).toEqual([]);
  });

  it('envia somente campos de configurações, não o registro inteiro da loja', () => {
    expect(page).toContain('createStoreSettingsPayload(store)');
    expect(page).not.toContain('const submittedStore = { ...store }');
  });

  it('impede upload de arquivos inválidos ou vazios no frontend', () => {
    expect(page).toContain('file.size === 0');
    expect(page).toContain('file.size > 10 * 1024 * 1024');
    expect(page).toContain("['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']");
    expect(page).toContain('accept="image/jpeg,image/png,image/webp,image/gif"');
    expect(page).not.toContain('accept="image/*"');
  });

  it('não permite salvar enquanto a logomarca está sendo enviada', () => {
    expect(page).toContain('if (uploadingLogoRef.current)');
    expect(page).toContain('disabled={uploadingLogo || saving}');
  });

  it('exibe imagens privadas com prévia autenticada', () => {
    expect(page).toContain('<AdminImage url={store.logo_url}');
  });
});
