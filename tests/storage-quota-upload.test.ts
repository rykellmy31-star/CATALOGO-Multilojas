import { afterEach, describe, expect, it, vi } from 'vitest';
import { fixture } from './helpers';

const PNG = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, ...Array(4096).fill(0)]);
let f: ReturnType<typeof fixture> | undefined;
afterEach(() => { f?.db.close(); f = undefined; });

function setup() {
  f = fixture();
  const put = vi.fn(async (key: string, _body: ArrayBuffer, _options: unknown) => ({ key }));
  const del = vi.fn(async (_key: string) => {});
  (f.env as any).STORAGE = { put, delete: del };
  return { put, del };
}
function send(data = PNG, productId?: string, storeId?: string, token?: string) {
  const form = new FormData();
  form.append('file', new Blob([data], { type: 'image/png' }), 'produto.png');
  if (productId) form.append('productId', productId);
  if (storeId) form.append('storeId', storeId);
  return f!.request('/api/upload', 'POST', form, token);
}
function used(store = 'a'): number {
  return (f!.db.prepare('SELECT storage_used_mb AS n FROM stores WHERE id = ?').get(store) as any).n;
}
const MB = 1024 * 1024;

describe('Limites de armazenamento por loja em uploads', () => {
  it('registra espaço apenas na loja autenticada', async () => {
    const { put } = setup();
    const response = await send();
    expect(response.status).toBe(200);
    expect(put).toHaveBeenCalledTimes(1);
    expect(used()).toBeCloseTo(PNG.byteLength / MB, 8);
    expect(used('b')).toBe(0);
  });

  it('bloqueia upload que excede o espaço restante antes do R2', async () => {
    const { put } = setup();
    f!.db.prepare("UPDATE stores SET storage_limit_mb = 0 WHERE id = 'a'").run();
    expect((await send()).status).toBe(413);
    expect(put).not.toHaveBeenCalled();
    expect(used()).toBe(0);
  });

  it('uploads simultâneos não reservam duas vezes o mesmo espaço livre', async () => {
    const { put } = setup();
    const sizeMb = PNG.byteLength / MB;
    f!.db.prepare("UPDATE stores SET storage_limit_mb = ? WHERE id = 'a'").run(sizeMb * 1.5);
    let entered!: () => void;
    let release!: () => void;
    const started = new Promise<void>(resolve => { entered = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    put.mockImplementationOnce(async (key: string) => {
      entered();
      await gate;
      return { key };
    });
    const first = send();
    await started;
    expect((await send()).status).toBe(413);
    release();
    expect((await first).status).toBe(200);
    expect(put).toHaveBeenCalledTimes(1);
  });

  it('devolve quota quando o R2 falha', async () => {
    const { put } = setup();
    put.mockRejectedValueOnce(new Error('falha simulada'));
    expect((await send()).status).toBe(503);
    expect(used()).toBeCloseTo(0, 8);
  });

  it('devolve quota e remove objeto quando o D1 não registra imagem', async () => {
    const { del } = setup();
    f!.db.exec(`CREATE TRIGGER fail_image BEFORE INSERT ON product_images
      BEGIN SELECT RAISE(ABORT, 'erro simulado'); END`);
    const response = await send(PNG, 'pa');
    expect(response.status).toBe(503);
    expect(del).toHaveBeenCalledTimes(1);
    expect(used()).toBeCloseTo(0, 8);
  });

  it('preserva quota quando não consegue excluir um objeto possivelmente órfão', async () => {
    const { del } = setup();
    del.mockRejectedValueOnce(new Error('R2 offline'));
    f!.db.exec(`CREATE TRIGGER fail_image BEFORE INSERT ON product_images
      BEGIN SELECT RAISE(ABORT, 'erro simulado'); END`);
    expect((await send(PNG, 'pa')).status).toBe(503);
    expect(used()).toBeCloseTo(PNG.byteLength / MB, 8);
  });

  it('não permite anexar upload ao produto da outra loja', async () => {
    const { put } = setup();
    expect((await send(PNG, 'pb')).status).toBe(404);
    expect(put).not.toHaveBeenCalled();
    expect(used()).toBe(0);
  });

  it('superadmin precisa indicar a loja ao enviar imagem geral', async () => {
    const { put } = setup();
    const root = f!.token('root', null, 'super_admin');
    expect((await send(PNG, undefined, undefined, root)).status).toBe(400);
    expect(put).not.toHaveBeenCalled();
    expect((await send(PNG, undefined, 'b', root)).status).toBe(200);
    expect(used('b')).toBeCloseTo(PNG.byteLength / MB, 8);
    expect(used('a')).toBe(0);
  });

  it('não permite superadmin ignorar limite da loja selecionada', async () => {
    const { put } = setup();
    f!.db.prepare("UPDATE stores SET storage_limit_mb = 0 WHERE id = 'b'").run();
    const root = f!.token('root', null, 'super_admin');
    expect((await send(PNG, undefined, 'b', root)).status).toBe(413);
    expect(put).not.toHaveBeenCalled();
  });

  it('não registra bytes de arquivo com assinatura inválida', async () => {
    const { put } = setup();
    expect((await send(new Uint8Array([137, 80, 78, 71]))).status).toBe(400);
    expect(put).not.toHaveBeenCalled();
    expect(used()).toBe(0);
  });
});
