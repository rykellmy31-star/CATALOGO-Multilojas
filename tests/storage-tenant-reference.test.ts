import { afterEach, describe, expect, it } from 'vitest';
import { fixture } from './helpers';
import { isOwnedStorageImageUrl, areOwnedStorageImages } from '../backend/src/utils/imageOwnership';

let f: ReturnType<typeof fixture> | undefined;
afterEach(() => { f?.db.close(); f = undefined; });
const stored = (store: string, name = 'photo.jpg') =>
  '/api/storage/' + encodeURIComponent(`stores/${store}/products/general/${name}`);
const own = stored('a');
const foreign = stored('b');
const countOwnImages = () =>
  (f!.db.prepare("SELECT COUNT(*) AS n FROM product_images WHERE store_id = 'a'").get() as any).n;

describe('Isolamento de referências de imagens R2', () => {
  it('aceita o formato de armazenamento da loja atual', () => {
    expect(isOwnedStorageImageUrl(own, 'a')).toBe(true);
    expect(areOwnedStorageImages([own], 'a')).toBe(true);
  });

  it.each([
    [foreign, 'outra loja'],
    ['/api/storage/%ZZ', 'codificação inválida'],
    [stored('a', '../outside.jpg'), 'travessia de diretórios'],
    [own + '?download=1', 'parâmetros ocultos'],
    ['/api/storage/stores/a/products/general/photo.jpg', 'chave não codificada'],
    [stored('a', 'inject.svg'), 'formato inseguro']
  ])('rejeita %s (%s)', (url) => {
    expect(isOwnedStorageImageUrl(url, 'a')).toBe(false);
  });

  it.each([
    'https://catalogo.example/api/storage/' + encodeURIComponent('stores/b/products/general/photo.jpg'),
    'http://catalogo.example/api/storage/' + encodeURIComponent('stores/b/products/general/photo.jpg'),
    'https://outro.example/api/storage/' + encodeURIComponent('stores/b/products/general/photo.jpg'),
    'https://catalogo.example/api/storage',
    'https://usuario:senha@example.com/foto.png',
    'javascript:alert(1)',
    'data:image/svg+xml,%3Csvg%3E',
    '//outro.example/api/storage/stores/b/products/general/photo.jpg',
    '/api/storage2/stores/b/products/general/photo.jpg',
    '/qualquer/caminho/local',
    'https://example.com/foto.jpg\\nX-Injected: 1'
  ])('impede contornar o isolamento com URL absoluta ou esquema inseguro: %s', invalid => {
    expect(isOwnedStorageImageUrl(invalid, 'a')).toBe(false);
    expect(areOwnedStorageImages([invalid], 'a')).toBe(false);
  });

  it.each([
    'https://example.com/legacy.jpg',
    'http://example.com/legacy.png',
    'https://cdn.example.com/assets/foto.webp?width=1024'
  ])('mantém compatibilidade com imagens externas legadas: %s', valid => {
    expect(isOwnedStorageImageUrl(valid, 'a')).toBe(true);
  });

  it('preserva suporte a imagens externas importadas anteriormente', () => {
    expect(areOwnedStorageImages(['https://example.com/legacy.jpg'], 'a')).toBe(true);
  });

  it('impede cadastro de produto com fotografia privada de outra loja', async () => {
    f = fixture();
    const before = (f.db.prepare('SELECT COUNT(*) AS n FROM products').get() as any).n;
    const res = await f.request('/api/store/products', 'POST', {
      name: 'Produto inseguro', price: 19, images: [foreign]
    });
    expect(res.status).toBe(400);
    expect((f.db.prepare('SELECT COUNT(*) AS n FROM products').get() as any).n).toBe(before);
  });

  it('aceita produto com foto própria', async () => {
    f = fixture();
    const res = await f.request('/api/store/products', 'POST', {
      name: 'Produto próprio', price: 19, images: [own]
    });
    expect(res.status).toBe(201);
    expect(countOwnImages()).toBe(1);
  });

  it('impede edição de produto com foto privada alheia sem apagar a original', async () => {
    f = fixture();
    f.db.prepare("INSERT INTO product_images (id, product_id, store_id, url) VALUES ('own-img','pa','a',?)")
      .run(own);
    const res = await f.request('/api/store/products/pa', 'PUT', {
      price: 100, images: [foreign]
    });
    expect(res.status).toBe(400);
    expect(countOwnImages()).toBe(1);
    expect((f.db.prepare("SELECT price FROM products WHERE id = 'pa'").get() as any).price).toBe(50);
  });

  it('rejeita criação de banner com foto R2 de outra loja', async () => {
    f = fixture();
    const res = await f.request('/api/store/banners', 'POST', { image_url: foreign });
    expect(res.status).toBe(400);
    expect((f.db.prepare("SELECT COUNT(*) AS n FROM banners WHERE store_id = 'a'").get() as any).n).toBe(0);
  });

  it('rejeita alteração de logo por imagem de outra loja', async () => {
    f = fixture();
    const res = await f.request('/api/store/settings', 'PUT', { logo_url: foreign });
    expect(res.status).toBe(400);
  });

  it('rejeita alteração de banner principal por imagem de outra loja', async () => {
    f = fixture();
    const res = await f.request('/api/store/settings', 'PUT', { banner_url: foreign });
    expect(res.status).toBe(400);
  });
});
