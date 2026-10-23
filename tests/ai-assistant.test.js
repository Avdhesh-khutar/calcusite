import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const start = html.indexOf("function ai(q,context='')");
const end = html.indexOf('\nfunction bindAI()', start);
assert.ok(start >= 0 && end > start, 'AI parser function boundaries exist');
const source = html.slice(start, end);

function makeAssistant() {
  const calls = [];
  const context = {
    fmt: n => Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }),
    rs: n => '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }),
    safeMath: () => null,
    byId: id => ({ n: id, run: args => { calls.push({ id, args }); return { main: ['Result', id === 'bmi' ? '23.4' : '₹123'], rows: [['Invested', '₹60,000'], ['Interest', '₹10,000']] }; } }),
    loan: (...args) => { calls.push({ id: 'loan', args }); return { main: ['EMI', '₹20,000'], rows: [['Payment', '₹20,000'], ['Interest', '₹2,00,000']] }; }
  };
  vm.createContext(context);
  vm.runInContext(source + '\nthis.__ai = ai;', context);
  return { ai: context.__ai, calls };
}

test('Hindi/English division returns a deterministic answer', () => {
  const { ai } = makeAssistant();
  assert.match(ai('(1250*12)/4'), /3,750|3750/);
  assert.match(ai('10 divide by 0'), /Zero se divide/);
});

test('BMI intent recognizes weight and decimal feet', () => {
  const { ai, calls } = makeAssistant();
  assert.match(ai('BMI for 70 kg and 5.8 ft'), /BMI/);
  assert.equal(calls[0].id, 'bmi');
  assert.equal(calls[0].args.w, 70);
  assert.ok(Math.abs(calls[0].args.h - 172.72) < 0.01);
});

test('SIP amount is extracted and calculator is invoked', () => {
  const { ai, calls } = makeAssistant();
  assert.match(ai('SIP 5000 per month'), /SIP/);
  assert.equal(calls[0].id, 'sip');
  assert.equal(calls[0].args.P, 5000);
});

test('EMI amount and duration are extracted', () => {
  const { ai, calls } = makeAssistant();
  assert.match(ai('10 lakh loan EMI for 5 years'), /EMI/);
  assert.equal(calls[0].id, 'loan');
  assert.equal(calls[0].args[0], 1_000_000);
  assert.equal(calls[0].args[2], 60);
});

test('interest asks for monthly/yearly basis instead of silently assuming', () => {
  const { ai } = makeAssistant();
  assert.match(ai('246656 par 2% 8 month byaj'), /monthly hai ya yearly/);
  assert.match(ai('246656 par 2% monthly 8 month byaj'), /simple interest/);
});

test('unknown question uses a clear fallback', () => {
  const { ai } = makeAssistant();
  assert.match(ai('tell me a joke'), /could not understand/i);
});
