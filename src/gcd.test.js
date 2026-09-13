import { gcd } from './gcd.js';
import assert from 'node:assert';
import { describe, it } from 'node:test';

describe('gcd', () => {
  it('基本', () => assert.strictEqual(gcd(12, 18), 6));
  it('互いに素', () => assert.strictEqual(gcd(7, 13), 1));
  it('片方が倍数', () => assert.strictEqual(gcd(9, 27), 9));
  it('順序を入れ替えても同じ', () => assert.strictEqual(gcd(18, 12), 6));
  it('ゼロとの組み合わせは他方を返す', () => {
    assert.strictEqual(gcd(0, 5), 5);
    assert.strictEqual(gcd(5, 0), 5);
  });
  it('両方ゼロは 0', () => assert.strictEqual(gcd(0, 0), 0));
  it('負の数は絶対値で扱う', () => {
    assert.strictEqual(gcd(-12, 18), 6);
    assert.strictEqual(gcd(12, -18), 6);
    assert.strictEqual(gcd(-12, -18), 6);
  });
});
