import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../frontend/src/contexts/AuthContext.tsx'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 }
}).outputText;

function deferred() {
  let resolve!: (value: any) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<any>((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}
function mount(initial: Record<string, string> = {}) {
  const storage = new Map(Object.entries(initial));
  const localStorage = {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => storage.set(k, v),
    removeItem: (k: string) => storage.delete(k)
  };
  const calls: any[] = [];
  const api = {
    get: (url: string, config: any) => { const d = deferred(); calls.push({ url, config, ...d }); return d.promise; },
    post: (url: string, body: any, config?: any) => { const d = deferred(); calls.push({ url, body, config, ...d }); return d.promise; }
  };
  const states: any[] = [], refs: any[] = [], effects: Array<() => any> = [];
  let index = 0, mounted = false, value: any;
  const React = {
    createContext: () => ({ Provider: 'Provider' }),
    useContext: () => value,
    useState: (init: any) => {
      const i = index++;
      if (!(i in states)) states[i] = typeof init === 'function' ? init() : init;
      return [states[i], (next: any) => { states[i] = typeof next === 'function' ? next(states[i]) : next; }];
    },
    useRef: (init: any) => { const i = index++; if (!(i in refs)) refs[i] = { current: init }; return refs[i]; },
    useEffect: (fn: () => any) => { if (!mounted) effects.push(fn); },
    createElement: (type: string, props: any) => { if (type === 'Provider') value = props.value; return null; }
  };
  const module = { exports: {} as any };
  runInNewContext(compiled, {
    module, exports: module.exports, localStorage, AbortController,
    require: (name: string) => {
      if (name === 'react') return { ...React, default: React };
      if (name === '../lib/api') return { __esModule: true, default: api };
      throw Error(`Unexpected import: ${name}`);
    }
  });
  const { AuthProvider } = module.exports;
  const render = () => { index = 0; AuthProvider({ children: null }); return value; };
  render();
  mounted = true;
  const cleanups = effects.map(fn => fn()).filter(Boolean);
  render();
  return { calls, storage, get auth() { return render(); }, unmount: () => cleanups.forEach(fn => fn()) };
}
const user = (id: string) => ({ id, name: id, email: `${id}@exemplo.test`, role: 'store_admin', store_id: `loja-${id}` });
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

test('descarta usuário em cache quando não existe token', () => {
  const f = mount({ user: JSON.stringify(user('antigo')) });
  expect(f.auth.user).toBeNull();
  expect(f.storage.has('user')).toBe(false);
  expect(f.auth.loading).toBe(false);
});

test('logout cancela /auth/me e não restaura sessão antiga', async () => {
  const f = mount({ token: 'A' });
  const req = f.calls[0];
  f.auth.logout();
  expect(req.config.signal.aborted).toBe(true);
  req.resolve({ data: { user: user('antigo') } });
  await flush();
  expect(f.auth.user).toBeNull();
  expect(f.storage.has('token')).toBe(false);
});

test('login novo prevalece sobre validação antiga', async () => {
  const f = mount({ token: 'A' });
  const old = f.calls[0];
  const login = f.auth.login('novo', 'senha');
  const request = f.calls.find(c => c.url === '/auth/login');
  request.resolve({ data: { token: 'B', user: user('novo') } });
  await login;
  old.resolve({ data: { user: user('antigo') } });
  await flush();
  expect(f.auth.user.id).toBe('novo');
  expect(f.auth.user.storeId).toBe('loja-novo');
  expect(f.storage.get('token')).toBe('B');
});

test('login tardio após logout não restaura credenciais', async () => {
  const f = mount();
  const login = f.auth.login('novo', 'senha');
  f.auth.logout();
  f.calls[0].resolve({ data: { token: 'A', user: user('novo') } });
  await expect(login).rejects.toThrow('substituída');
  expect(f.storage.has('token')).toBe(false);
  expect(f.auth.user).toBeNull();
});

test('login simultâneo usa somente a resposta mais recente', async () => {
  const f = mount();
  const first = f.auth.login('A', 'senha');
  const second = f.auth.login('B', 'senha');
  f.calls[1].resolve({ data: { token: 'B', user: user('B') } });
  await second;
  f.calls[0].resolve({ data: { token: 'A', user: user('A') } });
  await expect(first).rejects.toThrow('substituída');
  expect(f.auth.user.id).toBe('B');
});
