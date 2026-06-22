import { average } from './average.js';
import assert from 'node:assert';
import { describe, it } from 'node:test';
describe('average', () => {
  it('正の数の平均', () => assert.strictEqual(average([1, 2, 3, 4, 5]), 3));
  it('単一要素', () => assert.strictEqual(average([10]), 10));
  it('空配列は NaN', () => assert.ok(Number.isNaN(average([]))));
});
