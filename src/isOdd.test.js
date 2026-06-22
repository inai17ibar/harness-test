import { isOdd } from './isOdd.js';
import assert from 'node:assert';
import { describe, it } from 'node:test';
describe('isOdd', () => {
  it('奇数', () => assert.strictEqual(isOdd(3), true));
  it('偶数', () => assert.strictEqual(isOdd(4), false));
  it('ゼロ', () => assert.strictEqual(isOdd(0), false));
});
