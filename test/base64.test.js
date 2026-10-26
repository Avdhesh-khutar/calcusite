import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeUtf8Base64 } from '../src/index.js';

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
