import { sum } from './sum.js';
import assert from 'node:assert';
import { describe, it } from 'node:test';

describe('sum', () => {
  it('正の数の合計', () => assert.strictEqual(sum([1, 2, 3, 4]), 10));
  it('空配列は0', () => assert.strictEqual(sum([]), 0));
  it('負の数を含む', () => assert.strictEqual(sum([-1, 2, -3, 4]), 2));
});
