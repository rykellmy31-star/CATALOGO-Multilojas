import { afterEach, describe, expect, it } from 'vitest';
import { fixture } from './helpers';

let f: ReturnType<typeof fixture> | undefined;
afterEach(() => { f?.db.close(); f = undefined; });

const send = (body: unknown) => f!.request('/api/store/settings', 'PUT', body);
const current = () => f!.db.prepare('SELECT * FROM stores WHERE id = ?').get('a') as any;
const storedImage = (store: string) =>
  '/api/storage/' + encodeURIComponent(`stores/${store}/products/general/logo.png`);

describe('Configurações da loja: gravação a partir do painel administrativo', () => {
  it('salva registro completo quando não existe logo ou banner', async () => {
    f = fixture();
    const original = current();
    expect(original.logo_url).toBeNull();
    expect(original.banner_url).toBeNull();
    const response = await send({
      ...original, name: 'Loja A Atualizada',
      whatsapp: '+55 (73) 99999-1111', description: 'Nova descrição'
    });
    expect(response.status).toBe(200);
    expect((await response.json() as any).store).toMatchObject({
      name: 'Loja A Atualizada', whatsapp: '+55 (73) 99999-1111',
      description: 'Nova descrição', logo_url: null, banner_url: null
    });
    expect(current().slug).toBe('loja-a');
  });

  it('permite remover logo e banner existentes enviando null', async () => {
    f = fixture();
    f.db.prepare('UPDATE stores SET logo_url = ?, banner_url = ? WHERE id = ?')
      .run(storedImage('a'), storedImage('a'), 'a');
    const response = await send({ logo_url: null, banner_url: null });
    expect(response.status).toBe(200);
    expect(current().logo_url).toBeNull();
    expect(current().banner_url).toBeNull();
  });

  it('aceita a própria logomarca armazenada na loja', async () => {
    f = fixture();
    const response = await send({ logo_url: storedImage('a') });
    expect(response.status).toBe(200);
    expect(current().logo_url).toBe(storedImage('a'));
  });

  it('recusa logomarca de outra loja sem alterar outros campos', async () => {
    f = fixture();
    const response = await send({ name: 'Não alterar', logo_url: storedImage('b') });
    expect(response.status).toBe(400);
    expect(current().name).toBe('Loja A');
  });

  it('rejeita banner de outra loja sem salvar alterações parciais', async () => {
    f = fixture();
    const response = await send({ name: 'Não alterar', banner_url: storedImage('b') });
    expect(response.status).toBe(400);
    expect(current().name).toBe('Loja A');
  });

  it('slug duplicado retorna 409 e mantém configurações antigas', async () => {
    f = fixture();
    const response = await send({ slug: 'loja-b', name: 'Não alterar' });
    expect(response.status).toBe(409);
    expect(current().slug).toBe('loja-a');
    expect(current().name).toBe('Loja A');
  });

  it('normaliza slug novo e permite manter o próprio slug existente', async () => {
    f = fixture();
    expect((await send({ slug: 'loja-a', name: 'Loja Atual' })).status).toBe(200);
    const response = await send({ slug: 'Loja Nova' });
    expect(response.status).toBe(200);
    expect(current().slug).toBe('loja-nova');
  });

  it('não cria slug vazio após normalização', async () => {
    f = fixture();
    const response = await send({ slug: '🚀🚀', name: 'Não alterar' });
    expect(response.status).toBe(400);
    expect(current().name).toBe('Loja A');
  });

  it.each([null, [], 'texto', 123])
    ('rejeita formato de payload não objeto: %s', async data => {
      f = fixture();
      const response = await send(data);
      expect(response.status).toBe(400);
      expect(current().name).toBe('Loja A');
    });

  it('rejeita campos de texto com tipo inválido antes de gravar no D1', async () => {
    f = fixture();
    const response = await send({ name: { unexpected: 'objeto' }, whatsapp: ['invalido'] });
    expect(response.status).toBe(400);
    expect(current().name).toBe('Loja A');
  });

  it('recusa URL malformada e mantém alterações anteriores', async () => {
    f = fixture();
    const response = await send({ name: 'Não alterar', website: 'javascript:alert(1)' });
    expect(response.status).toBe(400);
    expect(current().name).toBe('Loja A');
  });

  it('não permite alterar plano, cotas ou identificação pelo formulário da loja', async () => {
    f = fixture();
    const before = current();
    const response = await send({
      name: 'Nome editável', id: 'b', store_id: 'b',
      plan: 'enterprise', storage_limit_mb: 99999,
      ai_enabled: false, ai_daily_limit: 5000
    });
    expect(response.status).toBe(200);
    expect(current()).toMatchObject({
      id: 'a', name: 'Nome editável', plan: before.plan,
      storage_limit_mb: before.storage_limit_mb,
      ai_enabled: before.ai_enabled, ai_daily_limit: before.ai_daily_limit
    });
    expect(f!.db.prepare("SELECT name FROM stores WHERE id='b'").get()).toMatchObject({
      name: 'Loja B'
    });
  });

  it('administrador A não altera marca ou nome da loja B', async () => {
    f = fixture();
    const before = f.db.prepare("SELECT name,logo_url FROM stores WHERE id='b'").get();
    expect((await send({ name: 'Alterada apenas a loja A' })).status).toBe(200);
    expect(f.db.prepare("SELECT name,logo_url FROM stores WHERE id='b'").get()).toEqual(before);
  });
});
