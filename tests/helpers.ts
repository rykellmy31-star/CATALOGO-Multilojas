import { createRequire } from 'node:module';
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite');
import { readFileSync, readdirSync } from 'node:fs';
import { app } from '../backend/src/index';
import { signToken } from '../backend/src/utils/jwt';

export function fixture() {
  const db = new DatabaseSync(':memory:');
  for (const file of readdirSync('database/migrations').filter(x => x.endsWith('.sql')).sort()) db.exec(readFileSync(`database/migrations/${file}`, 'utf8'));
  db.exec(`INSERT INTO stores (id,name,slug) VALUES ('a','Loja A','loja-a'),('b','Loja B','loja-b');
    INSERT INTO users (id,name,email,password_hash,role,store_id) VALUES ('ua','Admin A','a@test.com','x','store_admin','a'),('ub','Admin B','b@test.com','x','store_admin','b'),('root','Root','root@test.com','x','super_admin',NULL);
    INSERT INTO categories (id,store_id,name,slug) VALUES ('ca','a','Cat A','cat-a'),('cb','b','Cat B','cat-b');
    INSERT INTO products (id,store_id,name,slug,price,status,cost_price,category_id) VALUES ('pa','a','Produto A','produto-a',50,'published',10,'ca'),('pb','b','Produto B','produto-b',80,'published',15,'cb');
    INSERT INTO banners (id,store_id,image_url) VALUES ('bb','b','https://example.com/b.png');
    INSERT INTO brands (id,store_id,name,slug) VALUES ('brand-b','b','Marca B','marca-b');`);
  const DB = { prepare(sql: string) {
    let args: any[] = [];
    return { bind(...values: any[]) { args = values; return this; },
      async first() { return db.prepare(sql).get(...args) || null; },
      async all() { return { results: db.prepare(sql).all(...args), success: true }; },
      async run() { const meta = db.prepare(sql).run(...args); return { success: true, meta }; },
      // D1.batch é transacional. O teste replica a operação usando SQLite local.
      runSync() { const meta = db.prepare(sql).run(...args); return { success: true, meta }; }
    };
  }, async batch(statements: any[]) {
    db.exec('BEGIN');
    try {
      const results = statements.map(statement => statement.runSync());
      db.exec('COMMIT');
      return results;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }};
  const secret = 'test-secret-with-at-least-thirty-two-characters';
  const token = (id='ua', storeId: string | null='a', role: 'store_admin' | 'super_admin'='store_admin') => signToken({ userId:id, email:id==='root'?'root@test.com':`${storeId}@test.com`, role, storeId },secret);
  const env = { DB, JWT_SECRET: secret, STORAGE: { put: async () => {}, get: async () => null } };
  const request = (path: string, method='GET', body?: any, auth: string | null=token()) => app.request(path,{ method, headers:{ ...(auth ? { Authorization:`Bearer ${auth}` }:{}), ...(body instanceof FormData ? {} : {'Content-Type':'application/json'}) }, body:body===undefined?undefined:body instanceof FormData?body:JSON.stringify(body) },env as any);
  return { db, request, token, env };
}
