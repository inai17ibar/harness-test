import { half } from './half.js';
import assert from 'node:assert';
import { describe, it } from 'node:test';
describe('half', () => {
  it('偶数', () => assert.strictEqual(half(10), 5));
  it('奇数', () => assert.strictEqual(half(7), 3.5));
  it('ゼロ', () => assert.strictEqual(half(0), 0));
});
