import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const page = readFileSync(
  new URL('../frontend/src/pages/StoreAdmin/Banners.tsx', import.meta.url), 'utf8'
);

describe('Painel de banners: programação e segurança', () => {
  it('a tela mantém TSX sintaticamente válido', () => {
    const check = ts.transpileModule(page, {
      fileName: 'Banners.tsx',
      reportDiagnostics: true,
      compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX }
    });
    expect(check.diagnostics?.filter(
      item => item.category === ts.DiagnosticCategory.Error
    ) || []).toEqual([]);
  });

  it('converte horários locais para ISO em UTC antes do envio', () => {
    expect(page).toContain('type="datetime-local"');
    expect(page).toContain('return timestamp.toISOString();');
    expect(page).toContain('starts_at: startsAt, ends_at: endsAt');
    expect(page).toContain('Date.parse(startsAt) >= Date.parse(endsAt)');
  });

  it('permite agendar uma única extremidade ou não programar datas', () => {
    expect(page).toContain('if (!value) return null');
    expect(page).toContain("starts_at: '', ends_at: ''");
    expect(page).toContain("ends_at:''");
  });

  it('bloqueia cliques repetidos durante o cadastro', () => {
    expect(page).toContain('if (createInFlight.current) return;');
    expect(page).toContain('createInFlight.current = true;');
    expect(page).toContain('createInFlight.current = false;');
    expect(page).toContain('disabled={uploading || creating}');
  });

  it('faz ativação sem apagar e protege contra duplo clique na mesma campanha', () => {
    expect(page).toContain('if (togglesInFlight.current.has(banner.id)) return;');
    expect(page).toContain('togglesInFlight.current.add(banner.id);');
    expect(page).toContain('togglesInFlight.current.delete(banner.id);');
    expect(page).toContain('is_active: !banner.is_active');
  });

  it('distingue banners agendados, ativos e expirados no painel', () => {
    expect(page).toContain('const bannerStatus = (banner: any) =>');
    expect(page).toContain("return 'Agendado'");
    expect(page).toContain("return 'Encerrado'");
    expect(page).toContain("return 'Em exibição'");
    expect(page).toContain('bannerStatus(b)');
  });

  it('interpreta data legada sem offset como UTC antes de exibir', () => {
    expect(page).toContain("value.replace(' ', 'T') + 'Z'");
    expect(page).toContain('toLocaleString(\'pt-BR\')');
  });

  it('exibe mensagens do backend ao cadastrar ou alternar uma campanha', () => {
    expect(page).toContain('error?.response?.data?.error');
    expect(page).toContain('O término deve ser posterior ao início');
  });
});
