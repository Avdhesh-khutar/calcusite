import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const html = read('public/index.html');
const inline = [...html.matchAll(/<script>([\\s\\S]*?)<\\/script>/gi)].map((m) => m[1]);
const admin = read('public/admin/admin.js');
const worker = read('src/index.js');
const calculator = read('public/script.js');

test('homepage inline JavaScript parses', () => {
  assert.ok(inline.length > 0, 'homepage inline script exists');
  for (const source of inline) new vm.Script(source);
});
test('Admin, Worker and calculator scripts parse', () => {
  new vm.Script(admin);
  new vm.Script(worker.replace('export default {', 'const worker = {').replace(/};\\s*$/, '};'));
  new vm.Script(calculator);
});
test('AI math parser returns safe arithmetic results', () => {
  const start = html.indexOf('function safeMath(source){');
  const end = html.indexOf('function ai(q)', start);
  assert.ok(start >= 0 && end > start, 'safeMath parser exists');
  const safeMath = new Function(html.slice(start, end) + '; return safeMath;')();
  assert.equal(safeMath('(250*4)+18'), 1018);
  assert.equal(safeMath('2^5'), 32);
  assert.equal(safeMath('10/0'), null);
  assert.equal(safeMath('2^101'), null);
  assert.equal(safeMath('1+'.repeat(100)), null);
  assert.equal(safeMath('globalThis.process.exit()'), null);
});
test('Admin output escapes untrusted article names and errors', () => {
  assert.match(admin, /replace\\(/);
  assert.match(admin, /&lt;/);
  assert.match(worker, /Invalid save mode/);
});
test('unpublished blog articles are excluded from public routes and sitemap', () => {
  assert.match(worker, /p\\.published===false\\|\\|p\\.published==="false"/);
  assert.match(worker, /function serveSitemap/);
  assert.match(worker, /Disallow: \\/admin\\//);
});
test('homepage contains basic search metadata and private admin is noindex', () => {
  assert.match(html, /<title>[^<]+<\\/title>/i);
  assert.match(html, /name=["']description["']/i);
  assert.match(read('public/admin/index.html'), /noindex,nofollow/);
});
