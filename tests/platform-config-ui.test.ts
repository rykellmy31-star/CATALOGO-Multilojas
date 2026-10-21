import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(
  new URL('../frontend/src/pages/SuperAdmin/Platform.tsx', import.meta.url), 'utf8'
);

describe('Configuração global: proteção do formulário', () => {
  it('mantém sintaxe TSX válida', () => {
    const result = ts.transpileModule(source, {
      fileName: 'Platform.tsx',
      reportDiagnostics: true,
      compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX }
    });
    expect(result.diagnostics?.filter(
      d => d.category === ts.DiagnosticCategory.Error
    ) || []).toEqual([]);
  });

  it('não substitui 0 pelos limites padrão no formulário', () => {
    expect(source).toContain('config.ai_daily_limit_default ?? 10');
    expect(source).toContain('config.ai_monthly_limit_default ?? 100');
    expect(source).toContain('config.storage_limit_per_store_mb ?? 1024');
    expect(source).not.toContain('config.ai_daily_limit_default || 10');
  });

  it('impede envio duplo antes de React renderizar o estado de loading', () => {
    expect(source).toContain('if (savingRef.current) return;');
    expect(source).toContain('savingRef.current = true;');
    expect(source).toContain('savingRef.current = false;');
    expect(source).toContain('disabled={saving}');
  });

  it('rejeita número fracionário ou fora de faixa antes da requisição', () => {
    expect(source).toContain('Number.isInteger(value)');
    expect(source).toContain('value < min || value > max');
    expect(source).toContain("return toast.error('Verifique os limites de IA e armazenamento')");
  });

  it('não converte o campo vazio para zero silenciosamente', () => {
    expect(source).toContain("e.target.value === '' ? '' : Number(e.target.value)");
    expect(source).not.toContain('parseInt(e.target.value)');
  });

  it('mantém mensagem do backend visível ao superadministrador', () => {
    expect(source).toContain("e?.response?.data?.error || 'Erro ao salvar'");
  });
});
