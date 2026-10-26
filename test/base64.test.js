import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
const start = source.indexOf('function encodeUtf8Base64(value) {');
const end = source.indexOf('\n}', start) + 2;
assert.ok(start >= 0 && end > start, 'Base64 helper should exist in src/index.js');
const context = { TextEncoder, btoa };
vm.createContext(context);
vm.runInContext(source.slice(start, end) + '\nthis.encodeUtf8Base64 = encodeUtf8Base64;', context);
const encodeUtf8Base64 = value => context.encodeUtf8Base64(value);

test('encodes Unicode text as UTF-8 Base64', () => {
  const source = 'Calcusite — हिंदी गणना ₹123';
  const decoded = Buffer.from(encodeUtf8Base64(source), 'base64').toString('utf8');
  assert.equal(decoded, source);
});

test('encodes a 100,000-character article without argument-limit errors', () => {
  const source = 'अ'.repeat(100000);
  const encoded = encodeUtf8Base64(source);
  const decoded = Buffer.from(encoded, 'base64').toString('utf8');
  assert.equal(decoded, source);
  assert.equal(encoded.length, Math.ceil(Buffer.byteLength(source, 'utf8') / 3) * 4);
});

test('encodes empty text', () => {
  assert.equal(encodeUtf8Base64(''), '');
});
