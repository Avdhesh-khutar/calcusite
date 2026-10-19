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
test('AI assistant uses a keyboard-editable text input and handles form submission', () => {
  assert.match(html, /<form class="ask" id="aiForm" autocomplete="off">/);
  assert.match(html, /<input id="aq" type="text" name="question"[^>]*tabindex="0">/);
  assert.match(html, /#aiForm\{position:relative;z-index:1\}#aq\{position:relative;z-index:2;display:block\}/);
  assert.match(html, /form\.addEventListener\('submit',e=>\{e\.preventDefault\(\);send\(input\.value\)\}\)/);
  assert.match(html, /input\.addEventListener\('keydown',e=>\{if\(e\.key==='Enter'/);
});
test('currency converter fetches live reference rates and labels fallback estimates honestly', () => {
  assert.match(html, /https:\/\/open-er-api\.com\/v6\/latest\/USD/);
  assert.match(html, /async function loadLiveFX\(\)/);
  assert.match(html, /fxUpdatedAt=data\.time_last_update_utc/);
  assert.match(html, /Offline fallback estimate · live rate unavailable/);
  assert.match(html, /Market reference rate only; bank\/remittance fees and spreads may differ/);
  assert.match(html, /if\(id==='currency'\)loadLiveFX\(\)/);
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
  assert.match(worker, /Promise\.all\(files\.filter/);
  assert.match(worker, /sitemapMemoryCache\.expiresAt > Date\.now\(\)/);
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

test('homepage uses a fast system font stack without blocking external font requests', () => {
  assert.match(html, /font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif/);
  assert.doesNotMatch(html, /fonts\.googleapis\.com|fonts\.gstatic\.com/);
});

test('homepage advertises Calcusite as a free WebApplication with structured data', () => {
  assert.match(html, /type="application\/ld\+json"/);
  const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(match, 'homepage WebApplication JSON-LD exists');
  const data = JSON.parse(match[1]);
  assert.equal(data['@type'], 'WebApplication');
  assert.equal(data.name, 'Calcusite AI');
  assert.equal(data.isAccessibleForFree, true);
  assert.equal(data.offers.price, '0');
  assert.ok(data.featureList.includes('EMI and loan calculators'));
});

test('homepage contains basic search metadata and private admin is noindex', () => {
  assert.match(html, /<title>[^<]+<\/title>/i);
  assert.match(html, /name=["']description["']/i);
  assert.match(html, /<link rel="canonical" href="https:\/\/calcusite\.avdheshkhutar24\.workers\.dev\/">/i);
  assert.match(html, /property="og:url" content="https:\/\/calcusite\.avdheshkhutar24\.workers\.dev\/">/i);
  assert.match(read('public/admin/index.html'), /noindex,nofollow/);
});

test('Cloudflare sends dynamic SEO routes to the Worker before static asset fallback', () => {
  const config = JSON.parse(read('wrangler.jsonc'));
  assert.ok(config.assets.run_worker_first.includes('/robots.txt'), 'robots.txt must reach the Worker route');
  assert.ok(config.assets.run_worker_first.includes('/sitemap.xml'), 'sitemap.xml must reach the Worker route');
  assert.ok(config.assets.run_worker_first.includes('/blog'), 'blog index must reach the Worker route');
  assert.ok(config.assets.run_worker_first.includes('/blog/*'), 'blog articles must reach the Worker route');
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

test('production EMI calculation reconciles totals with the amortization schedule', () => {
  const start = html.indexOf('function loan(P,r,m){');
  const end = html.indexOf('\nconst C=[', start);
  assert.ok(start >= 0 && end > start, 'production loan function exists');
  const source = html.slice(start, end);
  const fmt = n => Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  const rs = n => '₹' + fmt(Math.round(n));
  const emiF = (P, r, m) => {
    r /= 1200;
    return r ? P * r * Math.pow(1 + r, m) / (Math.pow(1 + r, m) - 1) : P / m;
  };
  const loan = new Function('emiF', 'rs', source + '; return loan;')(emiF, rs);
  const result = loan(1000000, 8.5, 60);
  const amount = value => Number(value.replace(/[₹,]/g, ''));
  const principal = amount(result.rows[0][1]);
  const interest = amount(result.rows[1][1]);
  const total = amount(result.rows[2][1]);
  assert.equal(principal, 1000000);
  assert.equal(total, principal + interest, 'total payment must equal principal plus interest');
  assert.equal(result.table[1].length, 5, 'five-year loan should have five yearly schedule rows');
  assert.equal(amount(result.table[1][4][4]), 0, 'loan balance should be zero after the final payment');
  assert.doesNotMatch(JSON.stringify(result), /\b(?:NaN|Infinity)\b/);
});

test('all registered calculators produce finite results with their default inputs', () => {
  const start = html.indexOf('const C=[');
  const end = html.indexOf('const CATS=', start);
  assert.ok(start >= 0 && end > start, 'calculator registry exists');
  const registry = html.slice(start, end);
  const harness = `
    const CURS = { INR: ['₹', 'en-IN'] };
    let fxLive = false, fxUpdatedAt = 'test';
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
  const dateHelperStart = html.indexOf('function isValidCalendarDate(');
  const dateHelper = html.slice(dateHelperStart, validationStart);
  const harness = `
    const CURS = { INR: ['₹', 'en-IN'] };
    const CU = 'INR';
    const fmt = n => Number.isFinite(Number(n)) ? Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—';
    const rs = n => '₹' + fmt(Math.round(n));
    const emiF = (P,r,m) => { r/=1200; return r ? P*r*Math.pow(1+r,m)/(Math.pow(1+r,m)-1) : P/m; };
    function loan(P,r,m) { const e=emiF(P,r,m),tot=e*m,int=tot-P; let bal=P,rows=[],yp=0,yi=0; for(let k=1;k<=m;k++){const i=bal*r/1200,p=e-i;bal=Math.max(0,bal-p);yp+=p;yi+=i;if(k%12===0||k===m){rows.push([Math.ceil(k/12),rs(e),rs(yp),rs(yi),rs(bal)]);yp=yi=0}} return {main:['Monthly EMI',rs(e)],rows:[],table:[[],rows]}; }
    ${dateHelper}
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

test('financial calculators match independent reference calculations', () => {
  const registryStart = html.indexOf('const C=[');
  const registryEnd = html.indexOf('const CATS=', registryStart);
  const registry = html.slice(registryStart, registryEnd);
  const harness = `
    const CURS = { INR: ['₹', 'en-IN'] };
    const CU = 'INR';
    const fmt = n => Number.isFinite(Number(n)) ? Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—';
    const rs = n => '₹' + Number(Math.round(n)).toLocaleString('en-IN');
    const emiF = (P,r,m) => { r/=1200; return r ? P*r*Math.pow(1+r,m)/(Math.pow(1+r,m)-1) : P/m; };
    function loan(P,r,m) { const e=emiF(P,r,m),tot=e*m,int=tot-P; return {main:['Monthly EMI',rs(e)],rows:[['Principal',rs(P)],['Total Interest',rs(int)],['Total Payment',rs(tot)]]}; }
    ${registry}
    return C;
  `;
  const calculators = new Function(harness)();
  const get = id => calculators.find(c => c.id === id);
  const amount = (id, input) => {
    const result = get(id).run(input);
    return Number(result.main[1].replace(/[₹,]/g, ''));
  };
  assert.equal(amount('fd', { P: 100000, r: 8, n: 2 }), Math.round(100000 * Math.pow(1 + 0.08 / 4, 8)));
  assert.equal(amount('interest', { P: 100000, r: 8, n: 3, t: 0 }), 124000);
  assert.equal(amount('interest', { P: 100000, r: 8, n: 3, t: 1 }), Math.round(100000 * Math.pow(1.08, 3)));
  assert.equal(amount('lumpsum', { P: 100000, r: 10, n: 2 }), 121000);
  assert.equal(amount('vat', { a: 1000, r: 20, m: 0 }), 1200);
  assert.equal(amount('vat', { a: 1200, r: 20, m: 1 }), 1000);
  assert.equal(amount('tds', { a: 100000, r: 10 }), 10000);
  assert.equal(get('roi').run({ i: 100000, f: 150000, y: 3 }).main[1], '50.00%');
});

test('zero-interest and zero-return financial scenarios match principal-only references', () => {
  const registryStart = html.indexOf('const C=[');
  const registryEnd = html.indexOf('const CATS=', registryStart);
  const registry = html.slice(registryStart, registryEnd);
  const harness = `
    const CURS = { INR: ['₹', 'en-IN'] };
    const CU = 'INR';
    const fmt = n => Number.isFinite(Number(n)) ? Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—';
    const rs = n => '₹' + Number(Math.round(n)).toLocaleString('en-IN');
    const emiF = (P,r,m) => { r/=1200; return r ? P*r*Math.pow(1+r,m)/(Math.pow(1+r,m)-1) : P/m; };
    function loan(P,r,m) { const e=emiF(P,r,m),tot=e*m,int=tot-P; return {main:['Monthly EMI',rs(e)],rows:[['Principal',rs(P)],['Total Interest',rs(int)],['Total Payment',rs(tot)]]}; }
    ${registry}
    return C;
  `;
  const calculators = new Function(harness)();
  const get = id => calculators.find(c => c.id === id);
  const amount = (id, input) => {
    const result = get(id).run(input);
    return Number(result.main[1].replace(/[₹,]/g, ''));
  };
  assert.equal(amount('emi', { P: 120000, r: 0, n: 2 }), 5000);
  assert.equal(amount('sip', { P: 5000, r: 0, n: 10 }), 600000);
  assert.equal(amount('fd', { P: 100000, r: 0, n: 5 }), 100000);
  assert.equal(amount('rd', { P: 1000, r: 0, n: 2 }), 24000);
  assert.equal(amount('lumpsum', { P: 100000, r: 0, n: 10 }), 100000);
  assert.equal(amount('ppf', { P: 1000, r: 0, n: 15 }), 15000);
  assert.equal(amount('goal', { t: 120000, y: 10, r: 0 }), 1000);
  assert.equal(amount('nps', { P: 5000, a: 30, r: 0, p: 40, q: 6 }), 1800000);
});

test('all calculators remain safe for negative numeric boundaries when validation permits them', () => {
  const registryStart = html.indexOf('const C=[');
  const registryEnd = html.indexOf('const CATS=', registryStart);
  const validationStart = html.indexOf('function validateInputs(c,v){');
  const validationEnd = html.indexOf('let cur,curC;', validationStart);
  const dateHelperStart = html.indexOf('function isValidCalendarDate(');
  const registry = html.slice(registryStart, registryEnd);
  const validator = html.slice(validationStart, validationEnd);
  const dateHelper = html.slice(dateHelperStart, validationStart);
  const harness = `
    const CURS = { INR: ['₹', 'en-IN'] };
    const CU = 'INR';
    const fmt = n => Number.isFinite(Number(n)) ? Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—';
    const rs = n => '₹' + fmt(Math.round(n));
    const emiF = (P,r,m) => { r/=1200; return r ? P*r*Math.pow(1+r,m)/(Math.pow(1+r,m)-1) : P/m; };
    function loan(P,r,m) { const e=emiF(P,r,m);let bal=P,rows=[],yp=0,yi=0,totalPaid=0,totalInterest=0;for(let k=1;k<=m;k++){const i=bal*r/1200,p=Math.min(bal,Math.max(0,e-i)),payment=p+i;bal=Math.max(0,bal-p);totalPaid+=payment;totalInterest+=i;yp+=p;yi+=i;if(k%12===0||k===m){rows.push([Math.ceil(k/12),rs(e),rs(yp),rs(yi),rs(bal)]);yp=yi=0}}return{main:['Monthly EMI',rs(e)],rows:[['Principal',rs(P)],['Total Interest',rs(totalInterest)],['Total Payment',rs(totalPaid)]],donut:[['Principal',P,'#1d5de8'],['Interest',totalInterest,'#f5a524']],table:[['Year','EMI','Principal','Interest','Balance'],rows]}; }
    ${dateHelper}
    ${registry}
    ${validator}
    return { calculators: C, validateInputs };
  `;
  const { calculators, validateInputs } = new Function(harness)();
  const failures = [];
  let checked = 0;
  let attempted = 0;
  let rejected = 0;
  for (const calculator of calculators) {
    for (const field of calculator.f) {
      if (typeof field[2] !== 'number' || field[3]) continue;
      attempted++;
      const values = Object.fromEntries(calculator.f.map(item => [item[0], item[2]]));
      values[field[0]] = -1;
      if (validateInputs(calculator, values)) { rejected++; continue; }
      checked++;
      try {
        const result = calculator.run(values);
        assert.ok(result && Array.isArray(result.main), 'main result exists');
        assert.doesNotMatch(JSON.stringify(result), /\\b(?:NaN|Infinity)\\b/, 'result must be finite');
      } catch (error) {
        failures.push(calculator.id + '.' + field[0] + ': ' + error.message);
      }
    }
  }
  assert.ok(attempted > 30, 'should attempt negative boundaries across many numeric fields');
  assert.ok(rejected > 10, 'validation should reject negative values for many constrained fields');
  assert.deepEqual(failures, [], 'negative-boundary failures: ' + failures.join('; '));
});

test('all calculators handle zero-valued numeric boundaries without non-finite results', () => {
  const registryStart = html.indexOf('const C=[');
  const registryEnd = html.indexOf('const CATS=', registryStart);
  const validationStart = html.indexOf('function validateInputs(c,v){');
  const validationEnd = html.indexOf('let cur,curC;', validationStart);
  const dateHelperStart = html.indexOf('function isValidCalendarDate(');
  const registry = html.slice(registryStart, registryEnd);
  const validator = html.slice(validationStart, validationEnd);
  const dateHelper = html.slice(dateHelperStart, validationStart);
  const harness = `
    const CURS = { INR: ['₹', 'en-IN'] };
    const CU = 'INR';
    const fmt = n => Number.isFinite(Number(n)) ? Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—';
    const rs = n => '₹' + fmt(Math.round(n));
    const emiF = (P,r,m) => { r/=1200; return r ? P*r*Math.pow(1+r,m)/(Math.pow(1+r,m)-1) : P/m; };
    function loan(P,r,m) {
      const e=emiF(P,r,m);let bal=P,rows=[],yp=0,yi=0,totalPaid=0,totalInterest=0;
      for(let k=1;k<=m;k++){const i=bal*r/1200,p=Math.min(bal,Math.max(0,e-i)),payment=p+i;bal=Math.max(0,bal-p);totalPaid+=payment;totalInterest+=i;yp+=p;yi+=i;if(k%12===0||k===m){rows.push([Math.ceil(k/12),rs(e),rs(yp),rs(yi),rs(bal)]);yp=yi=0}}
      return {main:['Monthly EMI',rs(e)],rows:[['Principal',rs(P)],['Total Interest',rs(totalInterest)],['Total Payment',rs(totalPaid)]],donut:[['Principal',P,'#1d5de8'],['Interest',totalInterest,'#f5a524']],table:[['Year','EMI','Principal','Interest','Balance'],rows]};
    }
    ${dateHelper}
    ${registry}
    ${validator}
    return { calculators: C, validateInputs };
  `;
  const { calculators, validateInputs } = new Function(harness)();
  const failures = [];
  let checked = 0;
  for (const calculator of calculators) {
    for (const field of calculator.f) {
      if (typeof field[2] !== 'number' || field[3]) continue;
      const values = Object.fromEntries(calculator.f.map(item => [item[0], item[2]]));
      values[field[0]] = 0;
      if (validateInputs(calculator, values)) continue;
      checked++;
      try {
        const result = calculator.run(values);
        assert.ok(result && Array.isArray(result.main), 'main result exists');
        assert.doesNotMatch(JSON.stringify(result), /\\b(?:NaN|Infinity)\\b/, 'result must be finite');
      } catch (error) {
        failures.push(calculator.id + '.' + field[0] + ': ' + error.message);
      }
    }
  }
  assert.ok(checked > 20, 'should exercise many zero-value boundaries');
  assert.deepEqual(failures, [], 'zero-boundary failures: ' + failures.join('; '));
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
  const dateHelperStart = html.indexOf('function isValidCalendarDate(');
  const dateHelper = html.slice(dateHelperStart, validationStart);
  const harness = `
    const CURS = { INR: ['₹', 'en-IN'] };
    const CU = 'INR';
    const fmt = n => Number.isFinite(Number(n)) ? Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—';
    const rs = n => '₹' + fmt(Math.round(n));
    const emiF = (P,r,m) => { r/=1200; return r ? P*r*Math.pow(1+r,m)/(Math.pow(1+r,m)-1) : P/m; };
    function loan(P,r,m) { const e=emiF(P,r,m),tot=e*m,int=tot-P; let bal=P,rows=[],yp=0,yi=0; r/=1200; for(let k=1;k<=m;k++){const i=bal*r,p=e-i;bal=Math.max(0,bal-(e-i));yp+=e-i;yi+=i;if(k%12===0||k===m){rows.push([Math.ceil(k/12),rs(e),rs(yp),rs(yi),rs(bal)]);yp=yi=0}} return {main:['Monthly EMI',rs(e)],rows:[['Principal',rs(P)],['Total Interest',rs(int)],['Total Payment',rs(tot)]],donut:[['Principal',P,'#1d5de8'],['Interest',int,'#f5a524']]}; }
    ${dateHelper}
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
  const dateHelperStart = html.indexOf('function isValidCalendarDate(');
  const dateHelper = html.slice(dateHelperStart, validationStart);
  const harness = `
    const CURS = { INR: ['₹', 'en-IN'] };
    const CU = 'INR';
    const fmt = n => Number.isFinite(Number(n)) ? Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—';
    const rs = n => '₹' + fmt(Math.round(n));
    const emiF = (P,r,m) => { r/=1200; return r ? P*r*Math.pow(1+r,m)/(Math.pow(1+r,m)-1) : P/m; };
    function loan(P,r,m) { const e=emiF(P,r,m),tot=e*m,int=tot-P; return {main:['Monthly EMI',rs(e)],rows:[['Principal',rs(P)],['Total Interest',rs(int)],['Total Payment',rs(tot)]]}; }
    ${dateHelper}
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
  assert.match(validateInputs(get('datediff'), { a: '2026-02-31', b: '2026-03-10' }), /valid date/);
  assert.match(validateInputs(get('age'), { dob: '2024-02-30' }), /valid date/);
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

test('mobile layout and core calculator controls have responsive rules and handlers', () => {
  const styles = read('public/style.css');
  const app = read('public/script.js');
  assert.match(styles, /@media\s*\(max-width:\s*800px\)/, 'tablet/mobile breakpoint exists');
  assert.match(styles, /@media\s*\(max-width:\s*480px\)/, 'small-phone breakpoint exists');
  assert.match(styles, /\.sidebar\.open/, 'mobile navigation has an open state');
  assert.match(app, /menu\.addEventListener\('click'/, 'mobile menu button is wired');
  assert.match(app, /sidebar\.classList\.remove\('open'\)/, 'mobile menu can close after navigation/outside click');
  assert.match(app, /\$\('pCalculate'\)\.onclick=calc/, 'EMI calculate button is wired');
  assert.match(app, /\$\('pReset'\)\.onclick/, 'EMI reset button is wired');
  assert.match(app, /\$\('modalClose'\).*addEventListener\('click',close\)/, 'calculator modal close control is wired');
  assert.match(app, /\$\('searchInput'\).*addEventListener\('input'/, 'calculator search reacts to typing');
  assert.match(html, /@media\s*\(max-width:\s*820px\)/, 'the active homepage has its own mobile layout rules');
  assert.match(html, /\$\('#burger'\)\.onclick=/, 'the active homepage menu button is wired');
  assert.match(html, /\$\('#ov'\)\.onclick=closeSb/, 'the active homepage overlay closes mobile navigation');
  assert.match(html, /\$\('#calc'\)\.onclick=/, 'the active homepage calculator button is wired');
  assert.match(html, /const closeSb=/, 'the active homepage defines the mobile sidebar close handler');
});

test('calculators reject zero divisors and impossible dimensions before calculation', () => {
  const registryStart = html.indexOf('const C=[');
  const registryEnd = html.indexOf('const CATS=', registryStart);
  const validationStart = html.indexOf('function validateInputs(c,v){');
  const validationEnd = html.indexOf('let cur,curC;', validationStart);
  const registry = html.slice(registryStart, registryEnd);
  const validator = html.slice(validationStart, validationEnd);
  const dateHelperStart = html.indexOf('function isValidCalendarDate(');
  const dateHelper = html.slice(dateHelperStart, validationStart);
  const harness = `
    const CURS = { INR: ['₹', 'en-IN'] };
    const CU = 'INR';
    const fmt = n => Number.isFinite(Number(n)) ? Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—';
    const rs = n => '₹' + fmt(Math.round(n));
    const emiF = (P,r,m) => { r/=1200; return r ? P*r*Math.pow(1+r,m)/(Math.pow(1+r,m)-1) : P/m; };
    function loan(P,r,m) { const e=emiF(P,r,m),tot=e*m,int=tot-P; return {main:['Monthly EMI',rs(e)],rows:[['Principal',rs(P)],['Total Interest',rs(int)],['Total Payment',rs(tot)]]}; }
    ${dateHelper}
    ${registry}
    ${validator}
    return { calculators: C, validateInputs };
  `;
  const { calculators, validateInputs } = new Function(harness)();
  const get = id => calculators.find(c => c.id === id);
  const rejectsZero = [
    ['tile', { l: 12, w: 10, t: 0 }],
    ['paint', { l: 12, w: 10, h: 10, x: 40, c: 2, v: 0 }],
    ['tip', { b: 2000, t: 10, p: 0 }],
    ['bmr', { w: 0, h: 172, a: 28, s: 0 }],
    ['bsa', { w: 70, h: 0 }],
    ['goal', { t: 1000000, y: 0, r: 7 }],
    ['stepsip', { P: 5000, s: 10, r: 12, n: 0 }],
    ['margin', { c: 800, p: 0 }]
  ];
  for (const [id, input] of rejectsZero) {
    assert.match(validateInputs(get(id), input), /greater than zero/, id + ' should reject zero divisor');
  }
});

test('weighted average rejects zero total weight and calculates valid weights', () => {
  const registryStart = html.indexOf('const C=[');
  const registryEnd = html.indexOf('const CATS=', registryStart);
  const validationStart = html.indexOf('function validateInputs(c,v){');
  const validationEnd = html.indexOf('let cur,curC;', validationStart);
  const dateHelperStart = html.indexOf('function isValidCalendarDate(');
  const dateHelper = html.slice(dateHelperStart, validationStart);
  const registry = html.slice(registryStart, registryEnd);
  const validator = html.slice(validationStart, validationEnd);
  const harness = `
    const CURS = { INR: ['₹', 'en-IN'] };
    const CU = 'INR';
    const fmt = n => Number.isFinite(Number(n)) ? Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—';
    const rs = n => '₹' + fmt(Math.round(n));
    const emiF = (P,r,m) => { r/=1200; return r ? P*r*Math.pow(1+r,m)/(Math.pow(1+r,m)-1) : P/m; };
    function loan(P,r,m) { const e=emiF(P,r,m),tot=e*m,int=tot-P; return {main:['Monthly EMI',rs(e)],rows:[['Principal',rs(P)],['Total Interest',rs(int)],['Total Payment',rs(tot)]]}; }
    ${dateHelper}
    ${registry}
    ${validator}
    return { calculators: C, validateInputs };
  `;
  const { calculators, validateInputs } = new Function(harness)();
  const calculator = calculators.find(c => c.id === 'wavg');
  const zeroWeights = { a: 80, x: 0, b: 70, y: 0, c: 90, z: 0 };
  assert.match(validateInputs(calculator, zeroWeights), /weight must be greater than zero/);
  const valid = { a: 80, x: 30, b: 70, y: 30, c: 90, z: 40 };
  assert.equal(validateInputs(calculator, valid), '');
  assert.equal(calculator.run(valid).main[1], '81.00');
});


test('temperature, tax rates and weighted grade inputs respect realistic boundaries', () => {
  const registryStart = html.indexOf('const C=[');
  const registryEnd = html.indexOf('const CATS=', registryStart);
  const validationStart = html.indexOf('function validateInputs(c,v){');
  const validationEnd = html.indexOf('let cur,curC;', validationStart);
  const dateHelperStart = html.indexOf('function isValidCalendarDate(');
  const dateHelper = html.slice(dateHelperStart, validationStart);
  const registry = html.slice(registryStart, registryEnd);
  const validator = html.slice(validationStart, validationEnd);
  const harness = `
    const CURS = { INR: ['₹', 'en-IN'] };
    const CU = 'INR';
    const fmt = n => Number.isFinite(Number(n)) ? Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—';
    const rs = n => '₹' + fmt(Math.round(n));
    const emiF = (P,r,m) => { r/=1200; return r ? P*r*Math.pow(1+r,m)/(Math.pow(1+r,m)-1) : P/m; };
    function loan(P,r,m) { const e=emiF(P,r,m),tot=e*m,int=tot-P; return {main:['Monthly EMI',rs(e)],rows:[['Principal',rs(P)],['Total Interest',rs(int)],['Total Payment',rs(tot)]]}; }
    ${dateHelper}
    ${registry}
    ${validator}
    return { calculators: C, validateInputs };
  `;
  const { calculators, validateInputs } = new Function(harness)();
  const get = id => calculators.find(c => c.id === id);
  assert.equal(validateInputs(get('temp'), { x: -10, a: 0, b: 1 }), '', 'negative Celsius is valid');
  assert.match(validateInputs(get('temp'), { x: -300, a: 0, b: 1 }), /absolute zero/);
  assert.match(validateInputs(get('temp'), { x: -1, a: 2, b: 0 }), /absolute zero/, 'Kelvin cannot be negative');
  assert.match(validateInputs(get('vat'), { a: 1000, r: 101, m: 0 }), /between 0 and 100/);
  assert.match(validateInputs(get('tds'), { a: 1000, r: 101 }), /between 0 and 100/);
  assert.match(validateInputs(get('takehome'), { g: 50000, t: 10, d: 60000 }), /deductions cannot exceed gross/);
  assert.match(validateInputs(get('sgpa'), { g1: 8, c1: 0, g2: 9, c2: 0, g3: 7, c3: 0, g4: 8, c4: 0 }), /credit must be greater than zero/);
  const sgpaValid = { g1: 8, c1: 4, g2: 9, c2: 3, g3: 7, c3: 3, g4: 8, c4: 2 };
  assert.equal(validateInputs(get('sgpa'), sgpaValid), '');
  assert.equal(get('sgpa').run(sgpaValid).main[1], '8.00');
});



test('all calculators handle high but plausible values without non-finite results', () => {
  const registryStart = html.indexOf('const C=[');
  const registryEnd = html.indexOf('const CATS=', registryStart);
  const validationStart = html.indexOf('function validateInputs(c,v){');
  const validationEnd = html.indexOf('let cur,curC;', validationStart);
  const dateHelperStart = html.indexOf('function isValidCalendarDate(');
  const dateHelper = html.slice(dateHelperStart, validationStart);
  const registry = html.slice(registryStart, registryEnd);
  const validator = html.slice(validationStart, validationEnd);
  const harness = `
    const CURS = { INR: ['₹', 'en-IN'] };
    const CU = 'INR';
    const fmt = n => Number.isFinite(Number(n)) ? Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '—';
    const rs = n => '₹' + fmt(Math.round(n));
    const emiF = (P,r,m) => { r/=1200; return r ? P*r*Math.pow(1+r,m)/(Math.pow(1+r,m)-1) : P/m; };
    function loan(P,r,m) { const e=emiF(P,r,m),tot=e*m,int=tot-P; return {main:['Monthly EMI',rs(e)],rows:[['Principal',rs(P)],['Total Interest',rs(int)],['Total Payment',rs(tot)]]}; }
    ${dateHelper}
    ${registry}
    ${validator}
    return { calculators: C, validateInputs };
  `;
  const { calculators, validateInputs } = new Function(harness)();
  const failures = [];
  let checked = 0;
  for (const calculator of calculators) {
    const base = Object.fromEntries(calculator.f.map(field => [field[0], field[2]]));
    for (const field of calculator.f) {
      if (field[4] === 'date' || field[3]) continue;
      const label = field[1].toLowerCase();
      let high = 1000;
      if (/year|tenure|period|month|age|cycle|duration/.test(label)) high = 50;
      else if (/rate|percent|discount|return|tax|interest|hike|step-up/.test(label)) high = 100;
      else if (/height|weight|waist|neck|hip|distance|salary|amount|price|principal|investment|deposit|marks|value|cost|income|budget|loan|saving|target|bill|bill|area|length|width|volume|water|calorie|protein|score|rank|total|classes|attended|credit|grade|speed|time|daily|monthly|weekly|yearly|payment|premium|expense|fuel|mileage/.test(label)) high = 1000000;
      const input = { ...base, [field[0]]: high };
      const issue = validateInputs(calculator, input);
      if (issue) continue;
      try {
        const result = calculator.run(input);
        assert.ok(result && Array.isArray(result.main), 'main result exists');
        assert.doesNotMatch(JSON.stringify(result), /\\b(?:NaN|Infinity)\\b/, 'high-value result must be finite');
        checked++;
      } catch (error) {
        failures.push(calculator.id + '.' + field[0] + ': ' + error.message);
      }
    }
  }
  assert.ok(checked >= calculators.length, 'must exercise high-value cases across the calculator set');
  assert.deepEqual(failures, [], 'high-value failures: ' + failures.join('; '));
});


test('homepage declares installable web app metadata and a local SVG favicon', () => {
  assert.match(html, /rel="manifest" href="\/manifest\.webmanifest"/);
  assert.match(html, /rel="icon" type="image\/svg\+xml" href="\/favicon\.svg"/);
  const manifest = JSON.parse(read('public/manifest.webmanifest'));
  assert.equal(manifest.name, 'Calcusite AI');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.icons.some(icon => icon.src === '/favicon.svg' && icon.type === 'image/svg+xml'));
});


test('public Worker responses apply baseline browser security headers', () => {
  assert.match(worker, /X-Content-Type-Options", "nosniff"/);
  assert.match(worker, /Referrer-Policy", "strict-origin-when-cross-origin"/);
  assert.match(worker, /X-Frame-Options", "DENY"/);
  assert.match(worker, /Permissions-Policy", "camera=\(\), microphone=\(\), geolocation=\(\)"/);
  assert.match(worker, /return withSecurityHeaders\(response\)/);
});

test('privacy policy does not claim an unconfigured Google Fonts dependency', () => {
  assert.match(html, /<h2>Privacy Policy<\/h2>/);
  assert.match(html, /externally hosted services or links/);
  assert.doesNotMatch(html, /Pages load fonts from Google Fonts/);
});


test('currency converter starts at one and displays money with two decimal places', () => {
  assert.match(html, /T\('currency','Currency Converter','Unit & Conversion','Latest reference rates[^']*',[^\n]*\[\['x','Amount',1\]/);
  assert.match(html, /minimumFractionDigits:2,maximumFractionDigits:2/);
  assert.match(html, /Latest reference rate/);
});

test('theme toggle matches the CSS data-theme contract and persists safely', () => {
  assert.match(read('public/index.html'), /:root\[data-theme="dark"\]/);
  assert.match(calculator, /root\.setAttribute\('data-theme',next\)/);
  assert.match(calculator, /localStorage\.setItem\('calcTheme',next\)/);
  assert.match(calculator, /localStorage\.getItem\('calcTheme'\)/);
  assert.doesNotMatch(calculator, /classList\.toggle\('dark'\)/);
});
