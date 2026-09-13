import { median } from './median.js';
import assert from 'node:assert';
import { describe, it } from 'node:test';

describe('median', () => {
  it('奇数個', () => assert.strictEqual(median([3, 1, 2]), 2));
  it('偶数個', () => assert.strictEqual(median([4, 1, 3, 2]), 2.5));
  it('1個', () => assert.strictEqual(median([7]), 7));
  it('負の数', () => assert.strictEqual(median([-5, -1, -3]), -3));
});
