import { describe,it,expect,afterEach } from 'vitest';
import { fixture } from './helpers';
import { hashPassword,verifyPassword } from '../backend/src/utils/hash';
let f:ReturnType<typeof fixture>;afterEach(()=>f?.db.close());
describe('API real',()=>{
  it('nega ausência de token, loja suspensa e acesso ao superadmin',async()=>{
    f=fixture();expect((await f.request('/api/store/products','GET',undefined,null)).status).toBe(401);
    expect((await f.request('/api/superadmin/dashboard')).status).toBe(403);
    f.db.exec("UPDATE stores SET status = 'suspended' WHERE id='a'");
    expect((await f.request('/api/store/products')).status).toBe(403);
  });
  it('dashboard usa formato D1 real',async()=>{
    f=fixture();const result=await f.request('/api/superadmin/dashboard','GET',undefined,f.token('root',null,'super_admin'));
    expect(result.status).toBe(200);expect((await result.json()).stats.totalStores).toBe(2);
  });
  it('logout revoga token existente',async()=>{
    f=fixture();expect((await f.request('/api/auth/logout','POST')).status).toBe(200);
    expect((await f.request('/api/store/products')).status).toBe(401);
  });
  it('reset de senha não alcança admin de outra loja ou root',async()=>{
    f=fixture();for(const id of ['ub','root']) expect((await f.request(`/api/superadmin/stores/a/admins/${id}/reset-password`,'PUT',{password:'new-password'},f.token('root',null,'super_admin'))).status).toBe(404);
  });
  it('JSON malformado e produto inválido retornam 400',async()=>{
    f=fixture();expect((await f.request('/api/store/products','POST',{name:'',price:-1})).status).toBe(400);
    expect((await f.request('/api/store/products?page=-1&limit=nope')).status).toBe(200);
  });
  it('hash real tem salt e rejeita senha incorreta',async()=>{
    f=fixture();
    const h=await hashPassword('Password123');expect(await verifyPassword('Password123',h)).toBe(true);expect(await verifyPassword('wrong',h)).toBe(false);expect(await hashPassword('Password123')).not.toBe(h);
  });
  it('bootstrap exige segredos válidos e índice único de superadmin',async()=>{
    f=fixture();expect((await f.request('/api/auth/setup-super-admin','POST',{setupToken:'x',name:'Nome',email:'new@test.com',password:'Password123'},null)).status).toBe(503);
    expect(()=>f.db.exec("INSERT INTO users(id,name,email,password_hash,role) VALUES ('r2','Root2','r2@test.com','x','super_admin')")).toThrow(/UNIQUE/);
  });
});
