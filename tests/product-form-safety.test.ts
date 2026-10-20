import { describe, expect, it } from 'vitest';
import { parseProductAmount } from '../frontend/src/lib/productFormSafety';

describe('Validação de preços do editor de produtos', () => {
  it.each([
    ['0', 0], ['0.00', 0], ['0.01', 0.01],
    ['1', 1], ['.5', 0.5], ['10.50', 10.5],
    [' 10.5 ', 10.5], ['1000000', 1000000],
    [0, 0], [10, 10], [0.125, 0.125],
  ])('aceita valor financeiro válido %s', (input, expected) => {
    expect(parseProductAmount(input)).toBe(expected);
  });

  it.each([
    '1e2', '+1', '-1', '1,50', '1..5', '0x11', 'Infinity',
    '', ' ', '1.', null, undefined, NaN, Infinity, -1, true, {},
  ])('rejeita valor não monetário %s em vez de salvar como zero', input => {
    expect(() => parseProductAmount(input)).toThrow();
  });

  it.each([
    [null, null], [undefined, null], ['', null],
    [' ', null], ['0', 0], [0, 0], ['12.50', 12.5]
  ])('permite opcionais vazios sem descartar zero válido', (input, expected) => {
    expect(parseProductAmount(input, true)).toBe(expected);
  });
});
