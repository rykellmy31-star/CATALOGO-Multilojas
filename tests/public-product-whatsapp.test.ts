import { afterEach, describe, expect, it } from 'vitest';
import { fixture } from './helpers';

let fixtureState: ReturnType<typeof fixture> | undefined;
afterEach(() => {
  fixtureState?.db.close();
  fixtureState = undefined;
});

async function productContact(whatsapp: string | null) {
  fixtureState = fixture();
  fixtureState.db.prepare('UPDATE stores SET whatsapp = ? WHERE id = ?').run(whatsapp, 'a');
  const res = await fixtureState.request('/api/public/stores/loja-a/products/produto-a', 'GET', undefined, null);
  expect(res.status).toBe(200);
  return (await res.json() as { whatsappLink: string | null }).whatsappLink;
}

describe('API pública: contato WhatsApp com endereço completo', () => {
  it('inclui o link absoluto e codificado do produto publicado', async () => {
    const link = await productContact('+55 (73) 99999-8888');
    const url = new URL(link!);
    expect(url.origin).toBe('https://wa.me');
    expect(url.pathname).toBe('/5573999998888');
    const message = url.searchParams.get('text')!;
    expect(message).toContain('http://localhost/loja/loja-a/produto/produto-a');
    expect(message).toContain('preço e a disponibilidade atualizados');
    expect(message).not.toContain('Link: /loja/');
  });

  it.each(['12345', '', '00000000000', 'abc', null])
  ('retorna contato indisponível para número inválido: %s', async phone => {
    expect(await productContact(phone)).toBeNull();
  });

  it('inclui o contador real de visualizações do produto publicado', async () => {
    fixtureState = fixture();
    fixtureState.db.prepare("UPDATE products SET views = 37 WHERE id = 'pa'").run();
    const response = await fixtureState.request(
      '/api/public/stores/loja-a/products/produto-a', 'GET', undefined, null
    );
    expect(response.status).toBe(200);
    const payload = await response.json() as any;
    expect(payload.product.views).toBe(37);
  });

  it('não confunde preço antigo com informação atual da página', async () => {
    const link = await productContact('+5573999998888');
    const text = new URL(link!).searchParams.get('text')!;
    expect(text).not.toContain('Preço: R$');
    expect(text).toContain('/loja/loja-a/produto/produto-a');
  });
});
