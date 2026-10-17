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
test('blog pages generate canonical and Open Graph metadata from the request origin', () => {
  assert.match(worker, /function blogHtml\(title, content, description="Calcusite guides and resources", canonicalUrl=""\)/);
  assert.match(worker, /new URL\("\/blog",url\.origin\)\.href/);
  assert.match(worker, /new URL\("\/blog\/"\+encodeURIComponent\(slug\),url\.origin\)\.href/);
  assert.match(worker, /property="og:url" content=/);
});

test('blog pages include structured data for search engines', () => {
  assert.match(worker, /"@context":"https:\/\/schema\.org"/);
  assert.match(worker, /"@type":"CollectionPage"/);
  assert.match(worker, /"@type":"BlogPosting"/);
  assert.match(worker, /type="application\/ld\+json"/);
});

test('homepage hints font connections early and keeps font display swappable', () => {
  assert.match(html, /rel="preconnect" href="https:\/\/fonts\.googleapis\.com"/);
  assert.match(html, /rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin/);
  assert.match(html, /family=Plus\+Jakarta\+Sans:[^"]*&display=swap/);
});

test('homepage contains basic search metadata and private admin is noindex', () => {
  assert.match(html, /<title>[^<]+<\/title>/i);
  assert.match(html, /name=["']description["']/i);
  assert.match(html, /<link rel="canonical" href="https:\/\/calcusite\.avdheshkhutar24\.workers\.dev\/">/i);
  assert.match(html, /property="og:url" content="https:\/\/calcusite\.avdheshkhutar24\.workers\.dev\/">/i);
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

  const sitemap = await app.fetch(new Request('https://calcusite.avdheshkhutar24.workers.dev/sitemap.xml'), {});
  const sitemapText = await sitemap.text();
  assert.equal(sitemap.status, 200);
  assert.match(sitemapText, /https:\/\/calcusite\.avdheshkhutar24\.workers\.dev\//);
});

test('sitemap lists published Markdown articles and excludes unpublished ones', async () => {
  const workerFactory = new Function(worker.replace('export default {', 'const worker = {') + '; return worker;');
  const app = workerFactory();
  const originalFetch = globalThis.fetch;
  const markdown = {
    'age-calculator-guide.md': '---\ntitle: "Age Calculator Guide"\ndescription: "Age calculator help"\npublished: true\nupdated: "2026-10-17"\n---\n# Age Calculator Guide\nLearn how age is calculated.',
    'sip-calculator-guide.md': '---\ntitle: "SIP Calculator Guide"\ndescription: "SIP calculator help"\npublished: true\nupdated: "2026-10-16"\n---\n# SIP Calculator Guide\nLearn how SIP works.',
    'draft-guide.md': '---\ntitle: "Draft Guide"\ndescription: "Not public"\npublished: false\nupdated: "2026-10-17"\n---\n# Draft Guide\nThis must stay private.'
  };
  globalThis.fetch = async (input) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    if (url.pathname.endsWith('/contents/content/blog')) {
      return new Response(JSON.stringify(Object.keys(markdown).map(name => ({
        type: 'file', name, path: 'content/blog/' + name
      }))), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    const name = decodeURIComponent(url.pathname.split('/').pop());
    if (markdown[name]) {
      return new Response(JSON.stringify({
        content: Buffer.from(markdown[name], 'utf8').toString('base64')
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({ message: 'Not found' }), { status: 404 });
  };
  try {
    const response = await app.fetch(
      new Request('https://calcusite.avdheshkhutar24.workers.dev/sitemap.xml'),
      { GITHUB_TOKEN: 'test-token' }
    );
    const xml = await response.text();
    assert.equal(response.status, 200);
    assert.match(xml, /https:\/\/calcusite\.avdheshkhutar24\.workers\.dev\/blog\/age-calculator-guide/);
    assert.match(xml, /https:\/\/calcusite\.avdheshkhutar24\.workers\.dev\/blog\/sip-calculator-guide/);
    assert.doesNotMatch(xml, /draft-guide/);
    assert.match(xml, /<lastmod>2026-10-17<\/lastmod>/);

    const articleResponse = await app.fetch(
      new Request('https://calcusite.avdheshkhutar24.workers.dev/blog/age-calculator-guide'),
      { GITHUB_TOKEN: 'test-token' }
    );
    const articleHtml = await articleResponse.text();
    assert.equal(articleResponse.status, 200);
    assert.match(articleHtml, /<link rel="canonical" href="https:\/\/calcusite\.avdheshkhutar24\.workers\.dev\/blog\/age-calculator-guide">/);
    assert.match(articleHtml, /property="og:url" content="https:\/\/calcusite\.avdheshkhutar24\.workers\.dev\/blog\/age-calculator-guide"/);
    assert.match(articleHtml, /"@type":"BlogPosting"/);
    assert.match(articleHtml, /type="application\/ld\+json"/);
  } finally {
    globalThis.fetch = originalFetch;
  }
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
      assert.doesNotMatch(JSON.stringify(result), /\b(?:NaN|Infinity)\b/, 'result must be finite');
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
  const quadratic = calculators.find(item => item.id === 'quad');
  assert.equal(validateInputs(quadratic, { a: 1, b: -3, c: 2 }), '');
  assert.match(validateInputs(quadratic, { a: 0, b: 0, c: 0 }), /non-zero/);
  const power = calculators.find(item => item.id === 'power');
  assert.equal(validateInputs(power, { b: -2, e: 3 }), '');
  assert.match(validateInputs(power, { b: -2, e: 0.5 }), /whole-number exponent/);
});

test('Admin article API validates saves and writes draft/published frontmatter correctly', async () => {
  const app = new Function(worker.replace('export default {', 'const worker = {') + '; return worker;')();
  const env = { ADMIN_PASSWORD: 'correct-password', SESSION_SECRET: 'test-session-secret', GITHUB_TOKEN: 'fake-test-token' };
  const login = await app.fetch(new Request('https://example.workers.dev/api/admin/login', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: env.ADMIN_PASSWORD })
  }), env);
  const token = login.headers.get('set-cookie').match(/calcusite_admin=([^;]+)/)[1];
  const headers = { 'content-type': 'application/json', Cookie: 'calcusite_admin=' + token };
  const originalFetch = globalThis.fetch;
  const calls = [];
  try {
    globalThis.fetch = async (url, options = {}) => {
      calls.push({ url: String(url), method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : null });
      if ((options.method || 'GET') === 'GET') return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 });
      return new Response(JSON.stringify({
        content: { path: 'content/blog/test-draft.md', html_url: 'https://github.com/Avdhesh-khutar/calcusite/blob/main/content/blog/test-draft.md' },
        commit: { sha: 'abcdef1234567890' }
      }), { status: 201, headers: { 'content-type': 'application/json' } });
    };

    const invalid = await app.fetch(new Request('https://example.workers.dev/api/admin/article', {
      method: 'POST', headers, body: JSON.stringify({ title: 'Bad save', slug: 'bad-save', content: 'This is enough article content for this test.' })
    }), env);
    assert.equal(invalid.status, 400);
    assert.match((await invalid.json()).error, /save mode/);
    assert.equal(calls.length, 0, 'invalid payload must not contact GitHub');

    const draft = await app.fetch(new Request('https://example.workers.dev/api/admin/article', {
      method: 'POST', headers, body: JSON.stringify({ mode: 'create', title: 'Draft Article', slug: 'test-draft', description: 'Draft test', content: 'This is enough article content for the draft test.', published: false })
    }), env);
    assert.equal(draft.status, 200);
    const draftData = await draft.json();
    assert.equal(draftData.published, false);
    const draftWrite = calls.find(call => call.method === 'PUT');
    assert.ok(draftWrite);
    assert.match(atob(draftWrite.body.content), /published: false/);

    calls.length = 0;
    globalThis.fetch = async (url, options = {}) => {
      calls.push({ url: String(url), method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : null });
      if ((options.method || 'GET') === 'GET') return new Response(JSON.stringify({ sha: 'old-file-sha', content: '', html_url: 'https://github.com/example/article' }), { status: 200, headers: { 'content-type': 'application/json' } });
      return new Response(JSON.stringify({
        content: { path: 'content/blog/test-draft.md', html_url: 'https://github.com/example/article' },
        commit: { sha: 'fedcba9876543210' }
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    };
    const update = await app.fetch(new Request('https://example.workers.dev/api/admin/article', {
      method: 'POST', headers, body: JSON.stringify({ mode: 'update', title: 'Updated Article', slug: 'test-draft', content: 'Updated article content with enough characters.', published: true })
    }), env);
    assert.equal(update.status, 200);
    const updateData = await update.json();
    assert.equal(updateData.updated, true);
    assert.equal(updateData.published, true);
    const updateWrite = calls.find(call => call.method === 'PUT');
    assert.equal(updateWrite.body.sha, 'old-file-sha');
    assert.match(atob(updateWrite.body.content), /published: true/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Admin article API prevents duplicate creates, missing updates, and oversized article writes', async () => {
  const app = new Function(worker.replace('export default {', 'const worker = {') + '; return worker;')();
  const env = { ADMIN_PASSWORD: 'correct-password', SESSION_SECRET: 'test-session-secret', GITHUB_TOKEN: 'fake-test-token' };
  const login = await app.fetch(new Request('https://example.workers.dev/api/admin/login', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: env.ADMIN_PASSWORD })
  }), env);
  const token = login.headers.get('set-cookie').match(/calcusite_admin=([^;]+)/)[1];
  const headers = { 'content-type': 'application/json', Cookie: 'calcusite_admin=' + token };
  const originalFetch = globalThis.fetch;
  const calls = [];
  try {
    globalThis.fetch = async (url, options = {}) => {
      const method = options.method || 'GET';
      calls.push({ url: String(url), method, body: options.body ? JSON.parse(options.body) : null });
      if (method === 'GET') return new Response(JSON.stringify({ sha: 'existing-sha', content: '', html_url: 'https://github.com/example/article' }), { status: 200, headers: { 'content-type': 'application/json' } });
      return new Response(JSON.stringify({}), { status: 200, headers: { 'content-type': 'application/json' } });
    };

    const duplicate = await app.fetch(new Request('https://example.workers.dev/api/admin/article', {
      method: 'POST', headers, body: JSON.stringify({ mode: 'create', title: 'Existing Article', slug: 'existing-article', content: 'This article has enough content for validation.' })
    }), env);
    assert.equal(duplicate.status, 409);
    assert.match((await duplicate.json()).error, /already exists/);
    assert.equal(calls.filter(call => call.method === 'PUT').length, 0, 'duplicate create must not overwrite the existing article');

    calls.length = 0;
    globalThis.fetch = async (url, options = {}) => {
      calls.push({ url: String(url), method: options.method || 'GET' });
      return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404, headers: { 'content-type': 'application/json' } });
    };
    const missing = await app.fetch(new Request('https://example.workers.dev/api/admin/article', {
      method: 'POST', headers, body: JSON.stringify({ mode: 'update', title: 'Missing Article', slug: 'missing-article', content: 'This article has enough content for validation.' })
    }), env);
    assert.equal(missing.status, 404);
    assert.match((await missing.json()).error, /no longer exists/);
    assert.equal(calls.filter(call => call.method === 'PUT').length, 0, 'missing update must not create a new article');

    calls.length = 0;
    const oversized = await app.fetch(new Request('https://example.workers.dev/api/admin/article', {
      method: 'POST', headers, body: JSON.stringify({ mode: 'create', title: 'Oversized Article', slug: 'oversized-article', content: 'x'.repeat(100001) })
    }), env);
    assert.equal(oversized.status, 413);
    assert.match((await oversized.json()).error, /100,000 character limit/);
    assert.equal(calls.length, 0, 'oversized payload must be rejected before contacting GitHub');
  } finally {
    globalThis.fetch = originalFetch;
  }
});



test('EMI, SIP, GST, BMI and age calculators return expected values and reject edge cases', () => {
  const registryStart = html.indexOf('const C=[');
  const registryEnd = html.indexOf('const CATS=', registryStart);
  const validationStart = html.indexOf('function validateInputs(c,v){');
  const validationEnd = html.indexOf('let cur,curC;', validationStart);
  assert.ok(registryStart >= 0 && registryEnd > registryStart);
  assert.ok(validationStart >= 0 && validationEnd > validationStart);
  const registry = html.slice(registryStart, registryEnd);
  const validator = html.slice(validationStart, validationEnd);
  const harness = `
    const CURS = { INR: ['₹', 'en-IN'] };
    const CU = 'INR';
    const fmt = n => Number.isFinite(Number(n)) ? Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—';
    const rs = n => '₹' + fmt(Math.round(n));
    const emiF = (P,r,m) => { r/=1200; return r ? P*r*Math.pow(1+r,m)/(Math.pow(1+r,m)-1) : P/m; };
    function loan(P,r,m) { const e=emiF(P,r,m),tot=e*m,int=tot-P; let bal=P,rows=[],yp=0,yi=0; r/=1200; for(let k=1;k<=m;k++){const i=bal*r,p=e-i;bal=Math.max(0,bal-(e-i));yp+=e-i;yi+=i;if(k%12===0||k===m){rows.push([Math.ceil(k/12),rs(e),rs(yp),rs(yi),rs(bal)]);yp=yi=0}} return {main:['Monthly EMI',rs(e)],rows:[['Principal',rs(P)],['Total Interest',rs(int)],['Total Payment',rs(tot)]],donut:[['Principal',P,'#1d5de8'],['Interest',int,'#f5a524']]}; }
    ${registry}
    ${validator}
    return { calculators: C, validateInputs };
  `;
  const { calculators, validateInputs } = new Function(harness)();
  const get = id => calculators.find(c => c.id === id);
  const rs = n => '₹' + Number(Math.round(n)).toLocaleString('en-IN');
  const values = (id, overrides) => ({ ...Object.fromEntries(get(id).f.map(f => [f[0], f[2]])), ...overrides });

  const emi = get('emi').run({ P: 1000000, r: 8.5, n: 5 });
  const expectedEmi = 1000000 * (0.085/12) * Math.pow(1+0.085/12,60) / (Math.pow(1+0.085/12,60)-1);
  assert.equal(emi.main[0], 'Monthly EMI');
  assert.equal(emi.main[1], rs(expectedEmi));
  assert.equal(emi.rows[2][1], rs(expectedEmi * 60));

  const sip = get('sip').run({ P: 5000, r: 12, n: 10 });
  const monthlyRate = 0.12/12, months = 120;
  const expectedSip = 5000 * ((Math.pow(1+monthlyRate,months)-1)/monthlyRate) * (1+monthlyRate);
  assert.equal(sip.main[1], rs(expectedSip));
  assert.equal(sip.rows[0][1], rs(5000*120));

  const gst = get('gst').run({ a: 25000, r: 2, m: 0 });
  assert.equal(gst.main[1], rs(29500));
  assert.equal(gst.rows[0][1], rs(4500));
  const gstRemoved = get('gst').run({ a: 11800, r: 2, m: 1 });
  assert.equal(gstRemoved.main[1], rs(10000));

  const bmi = get('bmi').run({ w: 70, h: 170 });
  assert.match(bmi.main[1], /^24\.2 · Normal$/);
  assert.match(bmi.rows[0][1], /kg/);

  const problem = validateInputs(get('age'), { dob: '2999-01-01' });
  assert.match(problem, /future/);
  assert.match(validateInputs(get('emi'), { P: 0, r: 8.5, n: 5 }), /greater than zero/);
  assert.match(validateInputs(get('sip'), { P: 5000, r: 12, n: 0 }), /greater than zero/);
  assert.match(validateInputs(get('bmi'), { w: 70, h: 0 }), /greater than zero/);

  for (const [id, input] of [
    ['emi', { P: 1000000, r: 8.5, n: 5 }],
    ['sip', { P: 5000, r: 12, n: 10 }],
    ['gst', { a: 25000, r: 2, m: 0 }],
    ['bmi', { w: 70, h: 170 }]
  ]) {
    const result = get(id).run(input);
    assert.doesNotMatch(JSON.stringify(result), /\\b(?:NaN|Infinity)\\b/, id + ' must remain finite');
  }
});

test('percentage, discount, date difference and car-loan edge cases are handled', () => {
  const registryStart = html.indexOf('const C=[');
  const registryEnd = html.indexOf('const CATS=', registryStart);
  const validationStart = html.indexOf('function validateInputs(c,v){');
  const validationEnd = html.indexOf('let cur,curC;', validationStart);
  assert.ok(registryStart >= 0 && registryEnd > registryStart);
  assert.ok(validationStart >= 0 && validationEnd > validationStart);
  const registry = html.slice(registryStart, registryEnd);
  const validator = html.slice(validationStart, validationEnd);
  const harness = `
    const CURS = { INR: ['₹', 'en-IN'] };
    const CU = 'INR';
    const fmt = n => Number.isFinite(Number(n)) ? Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—';
    const rs = n => '₹' + fmt(Math.round(n));
    const emiF = (P,r,m) => { r/=1200; return r ? P*r*Math.pow(1+r,m)/(Math.pow(1+r,m)-1) : P/m; };
    function loan(P,r,m) { const e=emiF(P,r,m),tot=e*m,int=tot-P; return {main:['Monthly EMI',rs(e)],rows:[['Principal',rs(P)],['Total Interest',rs(int)],['Total Payment',rs(tot)]]}; }
    ${registry}
    ${validator}
    return { calculators: C, validateInputs };
  `;
  const { calculators, validateInputs } = new Function(harness)();
  const get = id => calculators.find(c => c.id === id);

  const percentage = get('percent').run({ p: 15, x: 2000 });
  assert.equal(percentage.main[1], '300');
  assert.equal(percentage.rows[0][1], '2,300');
  assert.equal(percentage.rows[1][1], '1,700');

  const discount = get('discount').run({ p: 2999, d: 25 });
  assert.equal(discount.main[1], '₹2,249');
  assert.equal(discount.rows[0][1], '₹750');
  assert.match(validateInputs(get('discount'), { p: 2999, d: 101 }), /between 0 and 100/);

  const dateDifference = get('datediff').run({ a: '2026-01-01', b: '2026-01-11' });
  assert.equal(dateDifference.main[1], '10 days');
  assert.equal(get('datediff').run({ a: '2026-01-11', b: '2026-01-01' }).main[1], '10 days');

  const car = get('car');
  assert.equal(validateInputs(car, { p: 1200000, d: 200000, r: 9, n: 5 }), '');
  assert.match(validateInputs(car, { p: 1200000, d: 1200000, r: 9, n: 5 }), /less than the car price/);
  assert.match(validateInputs(car, { p: 1200000, d: 1300000, r: 9, n: 5 }), /less than the car price/);

  assert.match(validateInputs(get('pchange'), { o: 0, n: 250 }), /greater than zero|cannot be zero/);
  assert.match(validateInputs(get('speed'), { d: 120, t: 0 }), /greater than zero/);
  assert.match(validateInputs(get('pl'), { c: 0, s: 1000 }), /greater than zero/);
});
