import { describe, expect, it } from 'vitest';
import { buildProductContactUrl } from '../frontend/src/lib/productContact';

const make = (whatsapp: unknown = '+55 (73) 99999-8888',
  name: unknown = 'Sofá 3 lugares', store: unknown = 'loja-a',
  slug: unknown = 'sofa-3', origin = 'https://catalogo.exemplo') =>
  buildProductContactUrl(whatsapp, name, store, slug, origin);

describe('Contato comercial por WhatsApp no produto', () => {
  it('abre apenas wa.me com número internacional válido', () => {
    const contact = make();
    expect(contact).not.toBeNull();
    const url = new URL(contact!);
    expect(url.origin).toBe('https://wa.me');
    expect(url.pathname).toBe('/5573999998888');
  });

  it('inclui link completo no domínio do catálogo atual', () => {
    const message = new URL(make()!).searchParams.get('text')!;
    expect(message).toContain('https://catalogo.exemplo/loja/loja-a/produto/sofa-3');
    expect(message).toContain('preço e a disponibilidade atualizados');
  });

  it('escapa nome e caracteres reservados da mensagem', () => {
    const url = new URL(make('+5573999998888', 'Mesa & Cadeira #2')!);
    expect(url.searchParams.get('text')).toContain('Mesa & Cadeira #2');
    expect(url.origin).toBe('https://wa.me');
  });

  it.each([null, '', '1234', '123abc', '+55 73 99999 8888 <script>'])
  ('recusa telefone inválido %s', invalid => {
    expect(make(invalid)).toBeNull();
  });

  it.each(['../b', '/loja-b', 'a%2fb', '', 'a b'])
  ('recusa slug inseguro de loja %s', invalid => {
    expect(make('+5573999998888', 'Sofá', invalid)).toBeNull();
  });

  it.each(['../b', '/produto', '%2e%2e', ''])
  ('recusa slug inseguro de produto %s', invalid => {
    expect(make('+5573999998888', 'Sofá', 'loja-a', invalid)).toBeNull();
  });

  it.each(['javascript:alert(1)', 'data:text/html,hello', 'https://u:p@example.com', '', 'file:///tmp/'])
  ('recusa origem não confiável %s', invalid => {
    expect(make('+5573999998888', 'Sofá', 'loja-a', 'sofa', invalid)).toBeNull();
  });

  it('permite origem HTTP no desenvolvimento local', () => {
    const result = make('+5573999998888', 'Sofá', 'loja-a', 'sofa', 'http://localhost:5173');
    expect(new URL(result!).searchParams.get('text')).toContain('http://localhost:5173');
  });

  it('não cria link para nome de produto vazio', () => {
    expect(make('+5573999998888', '')).toBeNull();
  });
});
