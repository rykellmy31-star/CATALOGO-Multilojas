import { it, expect, afterEach } from 'vitest';
import { fixture } from './helpers';
import { getDisplayPrice } from '../frontend/src/lib/pricing';
let f: ReturnType<typeof fixture> | undefined;
afterEach(() => { f?.db.close(); f = undefined; });
it.each([{price:''},{price:null},{price:false},{price:-1},{original_price:-1},{promotional_price:-1},{stock_quantity:-1},{stock_quantity:1.5},{is_featured:'false'}])('rejeita dados de preço/estoque inválidos: %j',async invalid=>{
  f=fixture();expect((await f.request('/api/store/products','POST',{name:'Produto válido',price:10,...invalid})).status).toBe(400);
});
it.each(['minPrice=abc','maxPrice=Infinity','minPrice=-1','minPrice=60&maxPrice=20','minPrice=','minPrice=1bad'])('rejeita filtro malformado: %s',async query=>{
  f=fixture();expect((await f.request(`/api/public/stores/loja-a/products?${query}`,'GET',undefined,null)).status).toBe(400);
});
it('filtra, ordena e conta pelo preço promocional exibido',async()=>{
  f=fixture();f.db.exec("UPDATE stores SET whatsapp='5573999999999' WHERE id='a'; UPDATE products SET promotional_price=20 WHERE id='pa'; INSERT INTO products(id,store_id,name,slug,price,status) VALUES ('pa2','a','Outro','outro',30,'published');");
  const filtered=await (await f.request('/api/public/stores/loja-a/products?maxPrice=25','GET',undefined,null)).json();
  expect(filtered.products.map((p:any)=>p.id)).toEqual(['pa']);expect(filtered.pagination.total).toBe(1);
  const sorted=await (await f.request('/api/public/stores/loja-a/products?sort=price_asc','GET',undefined,null)).json();
  expect(sorted.products.map((p:any)=>p.id)).toEqual(['pa','pa2']);
  const detail=await (await f.request('/api/public/stores/loja-a/products/produto-a','GET',undefined,null)).json();
  expect(decodeURIComponent(detail.whatsappLink)).toContain('20.00');
  f.db.exec("UPDATE products SET promotional_price=0 WHERE id='pa'");
  const free=await (await f.request('/api/public/stores/loja-a/products?maxPrice=0','GET',undefined,null)).json();expect(free.products.map((p:any)=>p.id)).toEqual(['pa']);
});
it('preço promocional zero é exibido e preço ausente não vira promoção',()=>{
  expect(getDisplayPrice({price:50,promotional_price:0})).toBe(0);
  expect(getDisplayPrice({price:50,promotional_price:null})).toBe(50);
  expect(getDisplayPrice({price:50,promotional_price:60})).toBe(50);
});
