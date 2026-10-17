import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const html = read('public/index.html');
const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
const admin = read('public/admin/admin.js');
const worker = read('src/index.js');
const calculator = read('public/script.js');

test('homepage inline JavaScript parses', () => {
  assert.ok(inline.length > 0, 'homepage inline script exists');
  for (const source of inline) new vm.Script(source);
});
test('Admin, Worker and calculator scripts parse', () => {
  new vm.Script(admin);
  new vm.Script(worker.replace('export default {', 'const worker = {'));
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
  assert.match(admin, /replace\(/);
  assert.match(admin, /&lt;/);
  assert.match(worker, /Invalid save mode/);
});
test('unpublished blog articles are excluded from public routes and sitemap', () => {
  assert.match(worker, /p\.published===false\|\|p\.published==="false"/);
  assert.match(worker, /function serveSitemap/);
  assert.match(worker, /Disallow: \/admin\//);
});
test('homepage contains basic search metadata and private admin is noindex', () => {
  assert.match(html, /<title>[^<]+<\/title>/i);
  assert.match(html, /name=["']description["']/i);
  assert.match(html, /<link rel="canonical" href="https:\/\/calcusite\.avdheshkhutar24\.workers\.dev\/">/i);
  assert.match(html, /property="og:url" content="https:\/\/calcusite\.avdheshkhutar24\.workers\.dev\/">/i);
  assert.doesNotMatch(html, /https:\/\/calcusite\.com\//);
  assert.match(read('public/admin/index.html'), /noindex,nofollow/);
});

test('robots.txt and sitemap use the active Worker origin', async () => {
  const workerFactory = new Function(worker.replace('export default {', 'const worker = {') + '; return worker;');
  const app = workerFactory();
  const request = new Request('https://calcusite.avdheshkhutar24.workers.dev/robots.txt');
  const robots = await app.fetch(request, {});
  const robotsText = await robots.text();
  assert.equal(robots.status, 200);
  assert.match(robotsText, /Sitemap: https:\/\/calcusite\.avdheshkhutar24\.workers\.dev\/sitemap\.xml/);
  assert.doesNotMatch(robotsText, /https:\/\/calcusite\.com/);

  const sitemap = await app.fetch(new Request('https://calcusite.avdheshkhutar24.workers.dev/sitemap.xml'), {});
  const sitemapText = await sitemap.text();
  assert.equal(sitemap.status, 200);
  assert.match(sitemapText, /https:\/\/calcusite\.avdheshkhutar24\.workers\.dev\//);
  assert.doesNotMatch(sitemapText, /https:\/\/calcusite\.com/);
});

test('all registered calculators produce finite results with their default inputs', () => {
  const start = html.indexOf('const C=[');
  const end = html.indexOf('const CATS=', start);
  assert.ok(start >= 0 && end > start, 'calculator registry exists');
  const registry = html.slice(start, end);
  const harness = `
    const CURS = { INR: ['₹', 'en-IN'] };
    const CU = 'INR';
    const fmt = n => Number.isFinite(Number(n)) ? Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—';
    const rs = n => '₹' + fmt(Math.round(n));
    const emiF = (P,r,m) => { r/=1200; return r ? P*r*Math.pow(1+r,m)/(Math.pow(1+r,m)-1) : P/m; };
    function loan(P,r,m) {
      const e=emiF(P,r,m),tot=e*m,int=tot-P; let bal=P,rows=[],yp=0,yi=0;
      for(let k=1;k<=m;k++){const i=bal*r/1200,p=e-i;bal=Math.max(0,bal-p);yp+=p;yi+=i;if(k%12===0||k===m){rows.push([Math.ceil(k/12),rs(e),rs(yp),rs(yi),rs(bal)]);yp=yi=0}}
      return {main:['Monthly EMI',rs(e)],rows:[['Principal',rs(P)],['Total Interest',rs(int)],['Total Payment',rs(tot)]],donut:[['Principal',P,'#1d5de8'],['Interest',int,'#f5a524']],table:[['Year','EMI','Principal','Interest','Balance'],rows]};
    }
    ${registry}
    return C;
  `;
  const calculators = new Function(harness)();
  assert.ok(calculators.length >= 30, 'expected at least 30 registered calculators');
  const failures = [];
  for (const calculator of calculators) {
    const values = Object.fromEntries(calculator.f.map(field => [field[0], field[2]]));
    try {
      const result = calculator.run(values);
      assert.ok(result && Array.isArray(result.main) && result.main.length >= 2, 'main result exists');
      assert.doesNotMatch(JSON.stringify(result), /\\b(?:NaN|Infinity)\\b/, 'result must be finite');
    } catch (error) {
      failures.push(calculator.id + ': ' + error.message);
    }
  }
  assert.deepEqual(failures, [], 'calculator failures: ' + failures.join('; '));
});

test('Admin API rejects unauthenticated access and sets a secure session cookie', async () => {
  const app = new Function(worker.replace('export default {', 'const worker = {') + '; return worker;')();
  const missingConfig = await app.fetch(new Request('https://example.workers.dev/api/admin/login', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'anything' })
  }), {});
  assert.equal(missingConfig.status, 503);

  const unauthenticated = await app.fetch(new Request('https://example.workers.dev/api/admin/me'), {});
  assert.equal(unauthenticated.status, 401);

  const wrongPassword = await app.fetch(new Request('https://example.workers.dev/api/admin/login', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'wrong' })
  }), { ADMIN_PASSWORD: 'correct-password', SESSION_SECRET: 'test-session-secret' });
  assert.equal(wrongPassword.status, 401);

  const login = await app.fetch(new Request('https://example.workers.dev/api/admin/login', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: 'correct-password' })
  }), { ADMIN_PASSWORD: 'correct-password', SESSION_SECRET: 'test-session-secret' });
  assert.equal(login.status, 200);
  const cookie = login.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Strict/);
  const token = cookie.match(/calcusite_admin=([^;]+)/)[1];
  const authenticated = await app.fetch(new Request('https://example.workers.dev/api/admin/me', {
    headers: { Cookie: 'calcusite_admin=' + token }
  }), { SESSION_SECRET: 'test-session-secret' });
  assert.equal(authenticated.status, 200);
});

test('default inputs pass the same validation used by the calculator UI', () => {
  const registryStart = html.indexOf('const C=[');
  const registryEnd = html.indexOf('const CATS=', registryStart);
  const validationStart = html.indexOf('function validateInputs(c,v){');
  const validationEnd = html.indexOf('let cur,curC;', validationStart);
  assert.ok(registryStart >= 0 && registryEnd > registryStart && validationStart >= 0 && validationEnd > validationStart);
  const registry = html.slice(registryStart, registryEnd);
  const validator = html.slice(validationStart, validationEnd);
  const harness = `
    const CURS = { INR: ['₹', 'en-IN'] };
    const CU = 'INR';
    const fmt = n => Number.isFinite(Number(n)) ? Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—';
    const rs = n => '₹' + fmt(Math.round(n));
    const emiF = (P,r,m) => { r/=1200; return r ? P*r*Math.pow(1+r,m)/(Math.pow(1+r,m)-1) : P/m; };
    function loan(P,r,m) { const e=emiF(P,r,m),tot=e*m,int=tot-P; let bal=P,rows=[],yp=0,yi=0; for(let k=1;k<=m;k++){const i=bal*r/1200,p=e-i;bal=Math.max(0,bal-p);yp+=p;yi+=i;if(k%12===0||k===m){rows.push([Math.ceil(k/12),rs(e),rs(yp),rs(yi),rs(bal)]);yp=yi=0}} return {main:['Monthly EMI',rs(e)],rows:[],table:[[],rows]}; }
    ${registry}
    ${validator}
    return { calculators: C, validateInputs };
  `;
  const { calculators, validateInputs } = new Function(harness)();
  const failures = [];
  for (const calculator of calculators) {
    const values = Object.fromEntries(calculator.f.map(field => [field[0], field[2]]));
    const problem = validateInputs(calculator, values);
    if (problem) failures.push(calculator.id + ': ' + problem);
  }
  assert.deepEqual(failures, [], 'default inputs rejected: ' + failures.join('; '));
});
