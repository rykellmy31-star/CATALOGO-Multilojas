import { describe, expect, it } from 'vitest';
import { publicLinkSchema } from '../backend/src/utils/validation';

describe('Links comerciais e imagens externas', () => {
  it.each([
    '/loja/minha-loja',
    '/api/storage/' + encodeURIComponent('stores/a/products/general/foto.png'),
    'https://example.com/categorias?tipo=sofa',
    'https://cdn.example.com/produto.webp?largura=400',
    'http://localhost:5173/loja/loja-a',
    ''
  ])('aceita link legítimo e legado: %s', url => {
    expect(publicLinkSchema.safeParse(url).success).toBe(true);
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>',
    'file:///etc/passwd',
    '//attacker.example/path',
    'https://usuario:senha@example.com/foto.png',
    'https://usuario@example.com/foto.png',
    'http://admin:pass@localhost/private',
    'https://example.com/path\nSet-Cookie: hi',
    'https://example.com/path\u007fcontrole',
    '/rota\\maliciosa'
  ])('rejeita endereço inseguro: %s', url => {
    expect(publicLinkSchema.safeParse(url).success).toBe(false);
  });

  it('impede credenciais embutidas nos banners e nas imagens de produtos', async () => {
    const { fixture } = await import('./helpers');
    const f = fixture();
    try {
      const result = await f.request('/api/store/products', 'POST', {
        name: 'Produto com URL insegura',
        price: 100,
        images: ['https://usuario:senha@example.com/img.jpg']
      });
      expect(result.status).toBe(400);
      const banner = await f.request('/api/store/banners', 'POST', {
        image_url: 'https://usuario:senha@example.com/banner.jpg'
      });
      expect(banner.status).toBe(400);
      expect((f.db.prepare("SELECT COUNT(*) AS n FROM products WHERE store_id = 'a'").get() as any).n).toBe(1);
    } finally {
      f.db.close();
    }
  });
});
