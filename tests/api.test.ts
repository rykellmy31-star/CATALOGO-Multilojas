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
    expect((await f.request('/api/store/products?page=-1&limit=nope')).status).toBe(400);
  });
  it('hash real tem salt e rejeita senha incorreta',async()=>{
    f=fixture();
    const h=await hashPassword('Password123');expect(await verifyPassword('Password123',h)).toBe(true);expect(await verifyPassword('wrong',h)).toBe(false);expect(await hashPassword('Password123')).not.toBe(h);
  });
  it('limita tentativas de login com contador persistente',async()=>{
    f=fixture();
    for(let i=0;i<20;i++) expect((await f.request('/api/auth/login','POST',{email:'missing@test.com',password:'Password123'},null)).status).toBe(401);
    const result=await f.request('/api/auth/login','POST',{email:'missing@test.com',password:'Password123'},null);
    expect(result.status).toBe(429);expect(result.headers.get('Retry-After')).toBeTruthy();
  });
  it('CRUD completo preserva imagens e exclusão',async()=>{
    f=fixture();
    const result=await f.request('/api/store/products','POST',{name:'Novo produto',price:0,images:['https://example.com/a.png','https://example.com/b.png'],category_id:'ca'});
    expect(result.status).toBe(201);const {product}=await result.json();
    expect((await f.request(`/api/store/products/${product.id}`,'PUT',{name:'Atualizado',images:['https://example.com/b.png']})).status).toBe(200);
    const data=await (await f.request(`/api/store/products/${product.id}`)).json();expect(data.images.map((x:any)=>x.url)).toEqual(['https://example.com/b.png']);
    expect((await f.request(`/api/store/products/${product.id}`,'DELETE')).status).toBe(200);
    expect((await f.request(`/api/store/products/${product.id}`)).status).toBe(404);
  });
  it('login real e reset invalidam sessão anterior',async()=>{
    f=fixture();f.db.prepare("UPDATE users SET password_hash = ? WHERE id = 'ua'").run(await hashPassword('Password123'));
    const login=await f.request('/api/auth/login','POST',{email:'a@test.com',password:'Password123'},null);expect(login.status).toBe(200);
    const {token}=await login.json();expect((await f.request('/api/auth/me','GET',undefined,token)).status).toBe(200);
    expect((await f.request('/api/superadmin/stores/a/admins/ua/reset-password','PUT',{password:'NewPassword123'},f.token('root',null,'super_admin'))).status).toBe(200);
    expect((await f.request('/api/auth/me','GET',undefined,token)).status).toBe(401);
  });
  it('rejeita URLs executáveis ou redirecionamentos de protocolo',async()=>{
    f=fixture();
    for (const link_url of ['javascript:alert(1)', '//evil.test/path', '\\evil.test']) expect((await f.request('/api/store/banners','POST',{image_url:'https://example.com/banner.png',link_url})).status).toBe(400);
    expect((await f.request('/api/store/settings','PUT',{website:'javascript:alert(1)'})).status).toBe(400);
  });
  it('SKU opcional vazio não impede edição de vários produtos',async()=>{
    f=fixture();const result=await f.request('/api/store/products','POST',{name:'Produto dois',price:10});const {product}=await result.json();
    expect((await f.request('/api/store/products/pa','PUT',{sku:''})).status).toBe(200);
    expect((await f.request(`/api/store/products/${product.id}`,'PUT',{sku:''})).status).toBe(200);
    expect(f.db.prepare("SELECT sku FROM products WHERE id='pa'").get()?.sku).toBe(null);
  });
  it('SKU repetido retorna conflito sem expor detalhes do banco',async()=>{
    f=fixture();expect((await f.request('/api/store/products/pa','PUT',{sku:'COD-1'})).status).toBe(200);
    const response=await f.request('/api/store/products','POST',{name:'Outro',price:20,sku:'COD-1'});
    expect(response.status).toBe(409);expect(JSON.stringify(await response.json())).not.toContain('UNIQUE');
  });
  it('bootstrap exige segredos válidos e índice único de superadmin',async()=>{
    f=fixture();expect((await f.request('/api/auth/setup-super-admin','POST',{setupToken:'x',name:'Nome',email:'new@test.com',password:'Password123'},null)).status).toBe(503);
    expect(()=>f.db.exec("INSERT INTO users(id,name,email,password_hash,role) VALUES ('r2','Root2','r2@test.com','x','super_admin')")).toThrow(/UNIQUE/);
  });
});
