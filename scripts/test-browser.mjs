import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, openSync } from 'node:fs';
import assert from 'node:assert/strict';

// Isolated local bindings and synthetic credentials; never contacts a remote D1/R2.
mkdirSync('test-results', { recursive: true });
const port = 8790;
const base = `http://127.0.0.1:${port}`;
const password = 'LocalTesting123!';
const log = openSync('test-results/worker.log', 'w');
const server = spawn(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port), '--var', 'JWT_SECRET:synthetic-local-test-secret-with-at-least-32-characters', '--var', 'SUPER_ADMIN_SETUP_TOKEN:synthetic-local-bootstrap-token-with-at-least-32-characters'], { stdio: ['ignore', log, log], env: { ...process.env, WRANGLER_SEND_METRICS: 'false' }, detached: true });
let browser;
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`${base}/api/health`)).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert(ready, 'Worker local não iniciou; consulte test-results/worker.log');
  async function api(path, method = 'GET', body, token) {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await response.json();
    assert(response.ok, `${path}: ${response.status} ${JSON.stringify(data)}`);
    return data;
  }
  const setup = await api('/api/auth/check-setup');
  const root = setup.needsSetup
    ? await api('/api/auth/setup-super-admin', 'POST', { setupToken: 'synthetic-local-bootstrap-token-with-at-least-32-characters', name: 'Admin Teste', email: 'root@browser.test', password })
    : await api('/api/auth/login', 'POST', { email: 'root@browser.test', password });
  const { store } = await api('/api/superadmin/stores', 'POST', { name: 'Loja de Teste', slug: `teste-${Date.now()}` }, root.token);
  const email = `loja-${store.id}@browser.test`;
  await api(`/api/superadmin/stores/${store.id}/admins`, 'POST', { name: 'Lojista Teste', email, password }, root.token);
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(20000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/login`);
  assert.equal(await page.getByText('Acesso rápido (demo)').count(), 0);
  await page.getByPlaceholder('seu@email.com').fill(email);
  await page.locator('input[type=password]').fill(password);
  await page.getByRole('button', { name: 'Entrar na Plataforma' }).click();
  await page.waitForURL('**/admin');
  await page.goto(`${base}/admin/produtos/novo`);
  await page.getByPlaceholder('Ex: Sofá Retrátil 2,30m Premium').fill('Produto de Teste');
  await page.getByPlaceholder('2899.00').fill('99.90');
  await page.locator('select').filter({ has: page.locator('option[value="published"]') }).selectOption('published');
  await page.getByRole('button', { name: 'Criar Produto' }).click();
  await page.waitForURL('**/editar');
  await page.getByRole('button', { name: 'Pré-visualizar' }).click();
  assert(await page.getByRole('dialog').isVisible());
  await page.getByRole('button', { name: 'Fechar prévia' }).click();
  await page.screenshot({ path: 'test-results/admin-desktop.png', fullPage: true });
  const token = await page.evaluate(() => localStorage.getItem('token'));
  const productId = new URL(page.url()).pathname.split('/')[3];
  const form = new FormData();
  form.append('productId', productId);
  form.append('file', new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64')], { type: 'image/png' }), 'teste.png');
  const upload = await fetch(`${base}/api/upload`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  assert.equal(upload.status, 200, await upload.clone().text());
  const { url } = await upload.json();
  const publicImage = await fetch(base + url);
  assert.equal(publicImage.status, 200);
  assert.equal(publicImage.headers.get('Content-Type'), 'image/png');
  await page.goto(`${base}/loja/${store.slug}`);
  await page.getByRole('heading', { name: 'Produto de Teste' }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/catalogo-mobile.png', fullPage: true });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Catálogo com rolagem horizontal no celular');
  await page.getByRole('heading', { name: 'Produto de Teste' }).click();
  await page.waitForURL('**/produto/**');
  assert.equal(errors.length, 0, JSON.stringify(errors));
  console.log('Aprovado: login, produto, prévia, R2 local, imagem pública, catálogo móvel e detalhe, sem erros JavaScript.');
} finally {
  if (browser) await browser.close();
  try { process.kill(-server.pid, 'SIGTERM'); } catch {}
}
