import { describe, expect, it } from 'vitest';
import { createStoreSettingsPayload } from '../frontend/src/lib/storeSettingsPayload';

describe('Configurações: somente campos editáveis são enviados', () => {
  it('não transmite dados internos, plano, cotas e IDs', () => {
    const payload = createStoreSettingsPayload({
      id: 'a', store_id: 'a', status: 'active',
      plan: 'enterprise', ai_enabled: 1, ai_daily_limit: 1000,
      ai_monthly_limit: 9999, storage_used_mb: 500,
      storage_limit_mb: 50000, created_at: '2026-10-20',
      secret_key: 'not-to-be-sent', name: 'Loja Atualizada',
      whatsapp: '+55 73 99999-2222'
    });
    expect(payload).toEqual({
      name: 'Loja Atualizada', whatsapp: '+55 73 99999-2222'
    });
  });

  it('preserva null para remover logomarca e banner', () => {
    expect(createStoreSettingsPayload({
      logo_url: null, banner_url: null, name: 'Loja A'
    })).toEqual({
      logo_url: null, banner_url: null, name: 'Loja A'
    });
  });

  it('preserva string vazia quando o usuário limpa um campo', () => {
    expect(createStoreSettingsPayload({
      email: '', description: '', website: '', logo_url: ''
    })).toEqual({
      email: '', description: '', website: '', logo_url: ''
    });
  });

  it('não inclui campos ausentes ou undefined', () => {
    expect(createStoreSettingsPayload({
      slug: undefined, name: 'Loja A'
    })).toEqual({ name: 'Loja A' });
  });

  it('não permite herdar valores injetados pela cadeia de protótipos', () => {
    const injected = Object.create({ plan: 'enterprise', whatsapp: '9999999999' });
    injected.name = 'Loja A';
    expect(createStoreSettingsPayload(injected)).toEqual({ name: 'Loja A' });
  });

  it('não altera o objeto original de configurações', () => {
    const original = Object.freeze({ id: 'a', name: 'Loja', logo_url: null });
    const result = createStoreSettingsPayload(original);
    expect(result).toEqual({ name: 'Loja', logo_url: null });
    expect(original).toHaveProperty('id', 'a');
  });
});
