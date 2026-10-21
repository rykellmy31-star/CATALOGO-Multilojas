import { afterEach, describe, expect, it } from 'vitest';
import { fixture } from './helpers';

let f: ReturnType<typeof fixture> | undefined;
afterEach(() => { f?.db.close(); f = undefined; });

function setup() {
  f = fixture();
  const rootToken = f.token('root', null, 'super_admin');
  const deleteStore = (id: string) =>
    f!.request(`/api/superadmin/stores/${id}`, 'DELETE', undefined, rootToken);
  const addAdmin = (storeId: string, email: string) =>
    f!.request(`/api/superadmin/stores/${storeId}/admins`, 'POST', {
      name: 'Novo gestor', email, password: 'SenhA_forte_2026!'
    }, rootToken);
  const audits = () => (f!.db.prepare(
    "SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'delete_store'"
  ).get() as { n: number }).n;
  return { deleteStore, addAdmin, audits };
}

describe('Super Admin: exclusão lógica e ciclo de vida dos gestores', () => {
  it('exclui loja apenas uma vez e registra uma única auditoria', async () => {
    const { deleteStore, audits } = setup();
    expect((await deleteStore('b')).status).toBe(200);
    expect((await deleteStore('b')).status).toBe(404);
    expect(audits()).toBe(1);
    expect(f!.db.prepare("SELECT status FROM stores WHERE id = 'b'").get())
      .toMatchObject({ status: 'deleted' });
    // Soft-delete mantém os registros até que haja uma política explícita de retenção.
    expect(f!.db.prepare("SELECT id FROM products WHERE id = 'pb'").get())
      .toMatchObject({ id: 'pb' });
  });

  it('exclusão de loja inexistente não gera auditoria fictícia', async () => {
    const { deleteStore, audits } = setup();
    const before = audits();
    expect((await deleteStore('missing-store')).status).toBe(404);
    expect(audits()).toBe(before);
  });

  it('uma loja suspensa pode ser removida uma única vez', async () => {
    const { deleteStore } = setup();
    f!.db.prepare("UPDATE stores SET status = 'suspended' WHERE id = 'b'").run();
    expect((await deleteStore('b')).status).toBe(200);
    expect((await deleteStore('b')).status).toBe(404);
  });

  it('administrador comum não pode apagar outra loja', async () => {
    setup();
    const response = await f!.request(
      '/api/superadmin/stores/b', 'DELETE', undefined, f!.token()
    );
    expect(response.status).toBe(403);
    expect(f!.db.prepare("SELECT status FROM stores WHERE id = 'b'").get())
      .toMatchObject({ status: 'active' });
  });

  it('não cria gestor para loja excluída', async () => {
    const { deleteStore, addAdmin } = setup();
    expect((await deleteStore('b')).status).toBe(200);
    expect((await addAdmin('b', 'deleted-admin@example.com')).status).toBe(404);
    expect(f!.db.prepare("SELECT id FROM users WHERE email = 'deleted-admin@example.com'").get())
      .toBeUndefined();
  });

  it('não cria gestor para loja inexistente', async () => {
    const { addAdmin } = setup();
    expect((await addAdmin('not-found', 'new-admin@example.com')).status).toBe(404);
  });

  it('não permite e-mail já cadastrado na plataforma', async () => {
    const { addAdmin } = setup();
    expect((await addAdmin('b', 'a@test.com')).status).toBe(409);
    expect(f!.db.prepare("SELECT COUNT(*) AS n FROM users WHERE email = 'a@test.com'").get())
      .toMatchObject({ n: 1 });
  });

  it('duas criações simultâneas com mesmo e-mail retornam 201 e 409', async () => {
    const { addAdmin } = setup();
    const [a, b] = await Promise.all([
      addAdmin('b', 'duplicado@example.com'),
      addAdmin('b', 'duplicado@example.com')
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect(f!.db.prepare("SELECT COUNT(*) AS n FROM users WHERE email = 'duplicado@example.com'").get())
      .toMatchObject({ n: 1 });
  });

  it('gestor criado tem vínculo correto e senha protegida por hash', async () => {
    const { addAdmin } = setup();
    const res = await addAdmin('b', 'gestor-b@example.com');
    expect(res.status).toBe(201);
    const user = f!.db.prepare(
      "SELECT role,store_id,password_hash FROM users WHERE email = 'gestor-b@example.com'"
    ).get() as any;
    expect(user.role).toBe('store_admin');
    expect(user.store_id).toBe('b');
    expect(user.password_hash).not.toContain('SenhA_forte_2026!');
  });

  it('uma loja excluída deixa de autenticar seu antigo gestor', async () => {
    const { deleteStore } = setup();
    expect((await deleteStore('b')).status).toBe(200);
    const response = await f!.request(
      '/api/store/dashboard', 'GET', undefined, f!.token('ub', 'b', 'store_admin')
    );
    expect(response.status).toBe(403);
  });
});
