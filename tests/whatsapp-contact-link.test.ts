import { describe, expect, it } from 'vitest';
import { getWhatsAppContactUrl } from '../frontend/src/lib/whatsapp';

describe('WhatsApp no cabeçalho do catálogo', () => {
  it.each([
    ['+55 (73) 99999-9999', 'https://wa.me/5573999999999'],
    ['55 73 99999-9999', 'https://wa.me/5573999999999'],
    ['5511999999999', 'https://wa.me/5511999999999'],
    ['1234567890', 'https://wa.me/1234567890'],
    ['+1 (415) 555-2671', 'https://wa.me/14155552671'],
  ])('normaliza %s', (input, expected) => {
    expect(getWhatsAppContactUrl(input)).toBe(expected);
  });

  it.each([
    undefined, null, 5511999999999, {}, [], '', '   ',
    '123456789', '1234567890123456', '0123456789',
    'javascript:5511999999999', 'https://wa.me/5511999999999',
    '5511999999999 ext 2', '5511\u200b999999999', '55/11/999999999',
  ])('não gera link inválido ou potencialmente enganoso: %s', input => {
    expect(getWhatsAppContactUrl(input)).toBeNull();
  });
});
