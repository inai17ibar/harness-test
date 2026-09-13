import { lcm } from './lcm.js';
import assert from 'node:assert';
import { describe, it } from 'node:test';

describe('lcm', () => {
  it('基本', () => assert.strictEqual(lcm(4, 6), 12));
  it('互いに素', () => assert.strictEqual(lcm(3, 5), 15));
  it('片方が倍数', () => assert.strictEqual(lcm(6, 3), 6));
  it('順序を入れ替えても同じ', () => assert.strictEqual(lcm(6, 4), 12));
  it('ゼロを含むと 0', () => {
    assert.strictEqual(lcm(0, 5), 0);
    assert.strictEqual(lcm(5, 0), 0);
    assert.strictEqual(lcm(0, 0), 0);
  });
  it('負の数は絶対値で扱う', () => {
    assert.strictEqual(lcm(-4, 6), 12);
    assert.strictEqual(lcm(4, -6), 12);
    assert.strictEqual(lcm(-4, -6), 12);
  });
});
