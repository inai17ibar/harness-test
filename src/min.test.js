import { min } from './min.js';
import assert from 'node:assert';
import { describe, it } from 'node:test';

describe('min', () => {
  it('複数の要素', () => assert.strictEqual(min([3, 1, 4, 1, 5]), 1));
  it('単一要素', () => assert.strictEqual(min([42]), 42));
  it('空配列は undefined', () => assert.strictEqual(min([]), undefined));
  it('負の数を含む', () => assert.strictEqual(min([-3, -1, -5]), -5));
});
