import { describe, expect, it } from 'vitest';
import { normalizeInterestProducts, buildInterestListUrl, MAX_INTEREST_PRODUCTS } from '../frontend/src/lib/interestList';

const product = (id: string, name = 'Sofá', slug = 'sofa') => ({ id, name, slug });
const link = (items: unknown, phone: unknown = '+55 (73) 99999-8888', origin = 'https://catalogo.exemplo') =>
  buildInterestListUrl(phone, 'Loja de móveis', 'loja-a', items, origin);

describe('Lista de interesse do catálogo', () => {
  it('remove preços e campos privados das cópias antigas', () => {
    expect(normalizeInterestProducts([{ ...product('p1'), price: 123, secret: 'não enviar' }]))
      .toEqual([product('p1')]);
  });
  it('não aceita produtos falsos ou URLs arbitrárias', () => {
    expect(normalizeInterestProducts([
      product('p1', 'Sofá', '../privado'),
      product('p/1'),
      { id: 'p2', name: 'Produto', slug: 'produto', secret: 'x' }
    ])).toEqual([product('p2', 'Produto', 'produto')]);
  });
  it('deduplica e limita a 30 itens', () => {
    const many = Array.from({ length: 40 }, (_, i) => product('p' + i));
    expect(normalizeInterestProducts([...many, product('p1')])).toHaveLength(MAX_INTEREST_PRODUCTS);
  });
  it('gera link https exclusivamente para wa.me', () => {
    const result = link([product('p1')]);
    expect(result).not.toBeNull();
    const url = new URL(result!);
    expect(url.origin).toBe('https://wa.me');
    expect(url.pathname).toBe('/5573999998888');
    expect(url.searchParams.get('text')).toContain('https://catalogo.exemplo/loja/loja-a/produto/sofa');
  });
  it('não transmite valores financeiros desatualizados', () => {
    const result = link([{ ...product('p1'), price: 9799, cost_price: 1 }])!;
    const msg = new URL(result).searchParams.get('text') || '';
    expect(msg).not.toContain('9799');
    expect(msg).toContain('preços e a disponibilidade atualizados');
  });
  it.each([null, '', '12345', '1'.repeat(16), '+55 73 99999 8888 <script>', '00000000000', {}, undefined])
    ('recusa WhatsApp inválido: %s', phone => {
      expect(link([product('p1')], phone)).toBeNull();
    });
  it('desativa o envio com lista vazia', () => {
    expect(link([])).toBeNull();
  });
  it('não permite redirecionamento por protocolos inseguros', () => {
    expect(link([product('p1')], '+5573999998888', 'javascript:alert(1)')).toBeNull();
  });
});
