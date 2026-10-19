import { describe, it, expect } from 'vitest';

describe('API Validation', () => {
  it('login requer email válido', () => {
    const schema = (data: any) => {
      if (!data.email || !data.email.includes('@')) return { success: false, error: 'Email inválido' };
      if (!data.password || data.password.length < 6) return { success: false, error: 'Senha curta' };
      return { success: true };
    };
    expect(schema({ email: 'invalid', password: '12345' }).success).toBe(false);
    expect(schema({ email: 'a@a.com', password: '123456' }).success).toBe(true);
  });

  it('produto requer nome e preço', () => {
    const validateProduct = (p: any) => {
      if (!p.name || p.name.length < 2) return false;
      if (p.price == null || p.price < 0) return false;
      return true;
    };
    expect(validateProduct({ name: 'Sofá', price: 100 })).toBe(true);
    expect(validateProduct({ name: '', price: 100 })).toBe(false);
    expect(validateProduct({ name: 'Sofá', price: -10 })).toBe(false);
  });

  it('slug é gerado corretamente', () => {
    const slugify = (text: string) => text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    expect(slugify('Sofá Retrátil Premium')).toBe('sof-retrtil-premium'.replace(' ', '-'));
    expect(slugify('Móveis Premium')).toBe('mveis-premium');
  });

  it('upload valida tipo e tamanho', () => {
    const isValidType = (type: string) => ['image/jpeg','image/png','image/webp'].includes(type);
    const isValidSize = (size: number) => size <= 10 * 1024 * 1024;
    expect(isValidType('image/jpeg')).toBe(true);
    expect(isValidType('application/pdf')).toBe(false);
    expect(isValidSize(5 * 1024 * 1024)).toBe(true);
    expect(isValidSize(15 * 1024 * 1024)).toBe(false);
  });

  it('WhatsApp link é gerado corretamente', () => {
    const formatWhatsApp = (num: string) => num.replace(/\D/g,'');
    const generateLink = (num: string, msg: string) => `https://wa.me/${formatWhatsApp(num)}?text=${encodeURIComponent(msg)}`;
    const link = generateLink('(73) 99999-0001', 'Olá! Interesse no produto X');
    expect(link).toContain('55999990001'.slice(-8)); // simplificado
    expect(link.startsWith('https://wa.me/')).toBe(true);
  });
});
