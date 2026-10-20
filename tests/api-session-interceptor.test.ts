import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../frontend/src/lib/api.ts', import.meta.url), 'utf8');
// A importação de env do Vite não existe no ambiente CommonJS do teste isolado.
const compiled = ts.transpileModule(
  source.replace('(import.meta as any).env?.VITE_API_URL', 'undefined'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
).outputText;

function fixture(token?: string, pathname = '/admin') {
  const values = new Map<string, string>(token ? [['token', token], ['user', '{"id":"x"}']] : []);
  const storage = {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => values.set(k, v),
    removeItem: (k: string) => values.delete(k)
  };
  let onRequest!: (config: any) => any;
  let onResponse!: (res: any) => any;
  let onError!: (err: any) => Promise<any>;
  const axios = { create: () => ({ interceptors: {
    request: { use: (fn: any) => { onRequest = fn; } },
    response: { use: (ok: any, fail: any) => { onResponse = ok; onError = fail; } }
  } }) };
  const window = { location: { pathname, href: pathname } };
  const module = { exports: {} };
  runInNewContext(compiled, {
    module, exports: module.exports, storage, localStorage: storage, window, Intl, Date, Math, Promise,
    require: (name: string) => {
      if (name === 'axios') return { __esModule: true, default: axios };
      throw new Error(`Import inesperado: ${name}`);
    }
  });
  const request = (headers: any = {}, url = '/store/settings') => onRequest({ headers, url });
  const error = async (status: number, headers?: any, url = '/store/settings') => {
    const err = { response: { status }, config: { url, headers } };
    await assert.rejects(onError(err), (caught: unknown) => caught === err);
  };
  return { values, window, request, error, onResponse };
}
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

test('anexa token ativo somente quando não existe Authorization explícito', () => {
  const f = fixture('B');
  assert.equal(f.request().headers.Authorization, 'Bearer B');
  assert.equal(f.request(bearer('A'), '/auth/logout').headers.Authorization, 'Bearer A');
  assert.equal(f.request({ authorization: 'Bearer A' }).headers.Authorization, undefined);
  assert.equal(f.request({ Authorization: false }).headers.Authorization, false);
  assert.equal(f.request({ Authorization: null }).headers.Authorization, null);
});

test('mantém sessão anônima e identificador de analytics', () => {
  const f = fixture();
  const first = f.request();
  assert.equal(first.headers.Authorization, undefined);
  assert.ok(first.headers['X-Session-Id']);
  assert.equal(first.headers['X-Session-Id'], f.request().headers['X-Session-Id']);
});

test('401 de token antigo não remove novo login nem redireciona', async () => {
  const f = fixture('B');
  await f.error(401, bearer('A'));
  assert.equal(f.values.get('token'), 'B');
  assert.ok(f.values.has('user'));
  assert.equal(f.window.location.href, '/admin');
});

test('401 do logout anterior não revoga nova sessão', async () => {
  const f = fixture('B');
  await f.error(401, bearer('A'), '/auth/logout');
  assert.equal(f.values.get('token'), 'B');
});

test('401 da sessão atual limpa credenciais e encaminha ao login', async () => {
  const f = fixture('A');
  await f.error(401, bearer('A'));
  assert.equal(f.values.has('token'), false);
  assert.equal(f.values.has('user'), false);
  assert.equal(f.window.location.href, '/login');
});

test('401 de login inválido preserva sessão já autenticada', async () => {
  const f = fixture('B');
  await f.error(401, bearer('B'), '/auth/login');
  await f.error(401, bearer('B'), '/auth/setup-super-admin');
  assert.equal(f.values.get('token'), 'B');
});

test('401 sem bearer ou sem token atual não redireciona', async () => {
  const f = fixture('B');
  await f.error(401, {});
  await f.error(401, { Authorization: 'Basic B' });
  assert.equal(f.values.get('token'), 'B');
  const anonymous = fixture();
  await anonymous.error(401, bearer('A'));
  assert.equal(anonymous.window.location.href, '/admin');
});

test('403 e 500 não encerram sessão', async () => {
  const f = fixture('B');
  await f.error(403, bearer('B'));
  await f.error(500, bearer('B'));
  assert.equal(f.values.get('token'), 'B');
});

test('suporta AxiosHeaders.get e cabeçalho bearer em minúsculas', async () => {
  const f = fixture('B');
  await f.error(401, { get: () => 'bearer B' });
  assert.equal(f.values.has('token'), false);
});

test('na página de login, 401 atual limpa token sem redirecionamento adicional', async () => {
  const f = fixture('A', '/login');
  await f.error(401, bearer('A'));
  assert.equal(f.values.has('token'), false);
  assert.equal(f.window.location.href, '/login');
});
