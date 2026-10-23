import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const start = html.indexOf('function ai(');
const end = html.indexOf('function bindAI()', start);
assert.ok(start >= 0 && end > start, 'AI function should exist in public/index.html');
const aiSource = html.slice(start, end);
const context = {
  fmt: n => Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 }),
  rs: n => '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 }),
  safeMath: () => null,
  byId: () => ({ n: 'Test calculator', run: () => ({ main: ['', '0'], rows: [['', '0']] }) })
};
vm.createContext(context);
vm.runInContext(aiSource + '\nthis.testAI = ai;', context);
const ai = (q, previous = '') => context.testAI(q, previous);

test('Hindi/Hinglish division returns correct answer', () => {
  assert.match(ai('15 ko 5 se bhaag karo'), /Answer: <b>3<\/b>/);
});

test('simple interest with monthly rate calculates correctly', () => {
  const answer = ai('246656 par 2 percent monthly, 8 month byaj');
  assert.match(answer, /8 mahine ka simple interest/);
  assert.match(answer, /₹39,464\.96/);
  assert.match(answer, /₹2,86,120\.96/);
});

test('monthly follow-up uses previous interest question', () => {
  const answer = ai('Monthly', 'Ek baat batao 246656 ka 2 percent 8 month byaj batao');
  assert.match(answer, /8 mahine ka simple interest/);
  assert.match(answer, /₹39,464\.96/);
});

test('interest question asks for missing rate period instead of guessing', () => {
  assert.match(ai('246656 par 2 percent, 8 month byaj'), /Rate monthly hai ya yearly\?/);
});

test('division by zero is handled safely', () => {
  assert.match(ai('15 ko 0 se bhaag karo'), /Zero se divide nahi kar sakte/);
});

test('Hindi question asking for half returns a deterministic answer', () => {
  assert.match(ai('Mujhe ek baat batao 10 ka aadha kitna hua'), /Aadha = <b>5<\/b>/);
  assert.match(ai('20 ka aadha batao'), /Aadha = <b>10<\/b>/);
  assert.match(ai('100 ka half'), /Aadha = <b>50<\/b>/);
});
