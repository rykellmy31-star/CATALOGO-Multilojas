import { test } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';

const file = resolve(process.cwd(), 'frontend/src/App.tsx');
const source = readFileSync(file, 'utf8');
const ast = ts.createSourceFile(file, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TSX);
function rootRoute() {
  let found: ts.JsxSelfClosingElement | undefined;
  function visit(node: ts.Node) {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === 'Route') {
      const path = node.attributes.properties.find(x => ts.isJsxAttribute(x) && x.name.text === 'path') as ts.JsxAttribute | undefined;
      if (path?.initializer && ts.isStringLiteral(path.initializer) && path.initializer.text === '/') found = node;
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(found, 'Rota raiz deve existir');
  return found;
}
function rootElement() {
  const attr = rootRoute().attributes.properties.find(x => ts.isJsxAttribute(x) && x.name.text === 'element') as ts.JsxAttribute | undefined;
  assert.ok(attr?.initializer && ts.isJsxExpression(attr.initializer));
  assert.ok(attr.initializer.expression && ts.isConditionalExpression(attr.initializer.expression));
  return attr.initializer.expression;
}

test('App.tsx possui JSX válido sem erro de sintaxe', () => {
  assert.equal(ast.parseDiagnostics.length, 0, ast.parseDiagnostics.map(x => x.messageText).join('\n'));
});

test('rota raiz prioriza estado loading antes de qualquer redirecionamento', () => {
  const expr = rootElement();
  assert.equal(expr.condition.getText(ast), 'loading');
  assert.ok(ts.isJsxElement(expr.whenTrue));
  assert.ok(ts.isConditionalExpression(expr.whenFalse));
});

test('rota raiz redireciona somente após validação e mantém login como fallback', () => {
  const expr = rootElement();
  const authenticated = expr.whenFalse as ts.ConditionalExpression;
  assert.equal(authenticated.condition.getText(ast), 'user');
  assert.ok(authenticated.whenFalse.getText(ast).includes('to="/login"'));
  assert.ok(authenticated.whenTrue.getText(ast).includes('to="/admin"'));
  assert.ok(authenticated.whenTrue.getText(ast).includes('to="/super-admin"'));
});

test('AppRoutes consome loading e user do mesmo contexto', () => {
  assert.ok(/function AppRoutes\(\)\s*\{\s*const \{ user, loading \} = useAuth\(\)/.test(source));
});
