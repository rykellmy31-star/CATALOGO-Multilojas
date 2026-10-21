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
  const storageListeners = new Set<(event: any) => void>();
  const window = {
    addEventListener: (type: string, fn: (event: any) => void) => { if (type === 'storage') storageListeners.add(fn); },
    removeEventListener: (type: string, fn: (event: any) => void) => { if (type === 'storage') storageListeners.delete(fn); }
  };
  runInNewContext(compiled, {
    module, exports: module.exports, localStorage, window, AbortController,
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
  const externalToken = (nextToken: string | null) => {
    if (nextToken === null) localStorage.removeItem('token');
    else localStorage.setItem('token', nextToken);
    for (const listener of storageListeners) listener({ key: 'token', storageArea: localStorage, newValue: nextToken });
  };
  return { calls, storage, externalToken, get auth() { return render(); }, unmount: () => cleanups.forEach(fn => fn()) };
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


test('logout em outra aba limpa imediatamente identidade e cache', () => {
  const f = mount({ token: 'A', user: JSON.stringify(user('antigo')) });
  f.externalToken(null);
  expect(f.auth.user).toBeNull();
  expect(f.auth.token).toBeNull();
  expect(f.auth.loading).toBe(false);
  expect(f.storage.has('user')).toBe(false);
});

test('login em outra aba valida token novo com credencial explícita', async () => {
  const f = mount({ token: 'A', user: JSON.stringify(user('antigo')) });
  const old = f.calls[0];
  f.externalToken('B');
  expect(old.config.signal.aborted).toBe(true);
  expect(f.auth.user).toBeNull();
  expect(f.auth.loading).toBe(true);
  const current = f.calls[1];
  expect(current.config.headers.Authorization).toBe('Bearer B');
  current.resolve({ data: { user: user('novo') } });
  await flush();
  expect(f.auth.user.id).toBe('novo');
  expect(f.auth.token).toBe('B');
  expect(f.auth.loading).toBe(false);
});

test('resposta da aba anterior não restaura usuário antigo', async () => {
  const f = mount({ token: 'A' });
  const old = f.calls[0];
  f.externalToken('B');
  f.calls[1].resolve({ data: { user: user('novo') } });
  await flush();
  old.resolve({ data: { user: user('antigo') } });
  await flush();
  expect(f.auth.user.id).toBe('novo');
});

test('troca rápida de token cancela consulta anterior', async () => {
  const f = mount();
  f.externalToken('B');
  const previous = f.calls[0];
  f.externalToken('C');
  expect(previous.config.signal.aborted).toBe(true);
  f.calls[1].resolve({ data: { user: user('C') } });
  await flush();
  previous.reject(new Error('401 antigo'));
  await flush();
  expect(f.auth.user.id).toBe('C');
  expect(f.storage.get('token')).toBe('C');
});

test('falha de token recebido de outra aba descarta credenciais', async () => {
  const f = mount();
  f.externalToken('invalido');
  f.calls[0].reject(new Error('401'));
  await flush();
  expect(f.auth.user).toBeNull();
  expect(f.auth.token).toBeNull();
  expect(f.storage.has('token')).toBe(false);
});

test('logout de outra aba durante login local invalida resposta antiga', async () => {
  const f = mount();
  const pending = f.auth.login('A', 'senha');
  f.externalToken('B');
  f.calls[0].resolve({ data: { token: 'A', user: user('antigo') } });
  await expect(pending).rejects.toThrow('substituída');
  expect(f.storage.get('token')).toBe('B');
});


test('usuário em cache não aparece antes da validação de /auth/me', () => {
  const f = mount({ token: 'A', user: JSON.stringify(user('antigo')) });
  expect(f.auth.user).toBeNull();
  expect(f.auth.loading).toBe(true);
  expect(f.auth.token).toBe('A');
  expect(f.calls[0].url).toBe('/auth/me');
});

test('usuário válido aparece apenas após validação inicial', async () => {
  const f = mount({ token: 'A', user: JSON.stringify(user('antigo')) });
  f.calls[0].resolve({ data: { user: user('novo') } });
  await flush();
  expect(f.auth.user.id).toBe('novo');
  expect(f.auth.loading).toBe(false);
  expect(JSON.parse(f.storage.get('user')!).id).toBe('novo');
});

test('falha de autenticação inicial apaga cache e sessão', async () => {
  const f = mount({ token: 'A', user: JSON.stringify(user('antigo')) });
  f.calls[0].reject(new Error('401'));
  await flush();
  expect(f.auth.user).toBeNull();
  expect(f.auth.token).toBeNull();
  expect(f.auth.loading).toBe(false);
  expect(f.storage.has('token')).toBe(false);
  expect(f.storage.has('user')).toBe(false);
});

test('novo evento com token revogado anteriormente exige revalidação', async () => {
  const f = mount({ token: 'A' });
  f.calls[0].reject(new Error('401'));
  await flush();
  f.externalToken('A');
  expect(f.calls.length).toBe(2);
  expect(f.auth.user).toBeNull();
  expect(f.auth.loading).toBe(true);
  f.calls[1].resolve({ data: { user: user('novo') } });
  await flush();
  expect(f.auth.user.id).toBe('novo');
});

test('ausência de token mantém painel bloqueado e limpa cache', () => {
  const f = mount({ user: JSON.stringify(user('antigo')) });
  expect(f.auth.user).toBeNull();
  expect(f.auth.loading).toBe(false);
  expect(f.storage.has('user')).toBe(false);
  expect(f.calls.length).toBe(0);
});
