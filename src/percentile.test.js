import { percentile } from './percentile.js';
import assert from 'node:assert';
import { describe, it } from 'node:test';

describe('percentile', () => {
  it('50パーセンタイル', () => assert.strictEqual(percentile([1, 2, 3, 4, 5], 50), 3));
  it('0パーセンタイル', () => assert.strictEqual(percentile([5, 3, 1], 0), 1));
  it('100パーセンタイル', () => assert.strictEqual(percentile([1, 2, 3], 100), 3));
  it('空配列は NaN', () => assert.ok(Number.isNaN(percentile([], 50))));
  it('入力配列を変更しない', () => {
    const input = [3, 1, 2];
    percentile(input, 50);
    assert.deepStrictEqual(input, [3, 1, 2]);
  });
});
