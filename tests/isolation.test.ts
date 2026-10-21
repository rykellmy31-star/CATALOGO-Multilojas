import { describe, it, expect, afterEach } from 'vitest';
import { fixture } from './helpers';
let f: ReturnType<typeof fixture>;
afterEach(()=>f?.db.close());
describe('Isolamento real das rotas e do banco',()=>{
  it('ignora storeId forjado e não lê produto de outra loja',async()=>{
    f=fixture();
    const list=await f.request('/api/store/products?storeId=b');
    expect((await list.json()).products.map((p:any)=>p.id)).toEqual(['pa']);
    expect((await f.request('/api/store/products/pb')).status).toBe(404);
  });
  it.each(['categories/cb','brands/brand-b','banners/bb'])('edição de %s não vaza resposta',async path=>{
    f=fixture(); const result=await f.request(`/api/store/${path}`,'PUT',{name:'Ataque',title:'Ataque'});
    expect(result.status).toBe(404); expect(JSON.stringify(await result.json())).not.toContain('Loja B');
  });
  it('bloqueia referências de categoria e marca de outra loja',async()=>{
    f=fixture();
    expect((await f.request('/api/store/products','POST',{name:'Invasão',price:10,category_id:'cb'})).status).toBe(400);
    expect(()=>f.db.prepare('UPDATE products SET category_id = ? WHERE id = ?').run('cb','pa')).toThrow(/tenant/);
    expect(()=>f.db.prepare("INSERT INTO product_images (id,product_id,store_id,url) VALUES ('x','pb','a','x')").run()).toThrow(/tenant/);
  });
  it('upload em produto alheio não grava arquivo nem imagem',async()=>{
    f=fixture();const form=new FormData();form.append('productId','pb');form.append('file',new Blob(['image'],{type:'image/png'}),'x.png');
    expect((await f.request('/api/upload','POST',form)).status).toBe(404);
    expect(f.db.prepare('SELECT COUNT(*) as n FROM product_images').get()?.n).toBe(0);
  });
  it('analytics não incrementa produto de outra loja',async()=>{
    f=fixture();expect((await f.request('/api/public/stores/loja-a/analytics','POST',{event_type:'whatsapp_click',product_id:'pb'},null)).status).toBe(404);
    expect(f.db.prepare("SELECT clicks FROM products WHERE id = 'pb'").get()?.clicks).toBe(0);
  });
  it('catálogo público exclui custo e rascunhos',async()=>{
    f=fixture(); f.db.prepare("UPDATE products SET status = 'draft' WHERE id = 'pb'").run();
    const result=await f.request('/api/public/stores/loja-a/products', 'GET',undefined,null); const data=await result.json();
    expect(data.products).toHaveLength(1);expect(data.products[0]).not.toHaveProperty('cost_price');
    expect((await f.request('/api/public/stores/loja-b/products/produto-b','GET',undefined,null)).status).toBe(404);
  });
});
