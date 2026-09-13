import { percentile } from './percentile.js';
import assert from 'node:assert';
import { describe, it } from 'node:test';

describe('percentile', () => {
  it('50パーセンタイル', () => assert.strictEqual(percentile([1, 2, 3, 4, 5], 50), 3));
  it('0パーセンタイル', () => assert.strictEqual(percentile([5, 3, 1], 0), 1));
});
