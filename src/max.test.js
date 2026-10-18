import { max } from './max.js';
import assert from 'node:assert';
import { describe, it } from 'node:test';

describe('max', () => {
  it('複数の要素', () => assert.strictEqual(max([3, 1, 4, 1, 5]), 5));
  it('単一要素', () => assert.strictEqual(max([42]), 42));
  it('空配列は undefined', () => assert.strictEqual(max([]), undefined));
  it('負の数のみ', () => assert.strictEqual(max([-3, -1, -5]), -1));
  it('小数を含む', () => assert.strictEqual(max([1.5, 2.25, 0.5]), 2.25));
});
