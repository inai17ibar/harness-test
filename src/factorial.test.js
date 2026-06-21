import { factorial } from './factorial.js';
import assert from 'node:assert';
import { describe, it } from 'node:test';

describe('factorial', () => {
  it('0! は 1', () => {
    assert.strictEqual(factorial(0), 1);
  });
  it('1! は 1', () => {
    assert.strictEqual(factorial(1), 1);
  });
  it('5! は 120', () => {
    assert.strictEqual(factorial(5), 120);
  });
  it('10! は 3628800', () => {
    assert.strictEqual(factorial(10), 3628800);
  });
  it('負の数はエラー', () => {
    assert.throws(() => factorial(-1), RangeError);
  });
  it('整数以外はエラー', () => {
    assert.throws(() => factorial(1.5), RangeError);
  });
});
