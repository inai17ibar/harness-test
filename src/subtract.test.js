import { subtract } from './subtract.js';
import assert from 'node:assert';
import { describe, it } from 'node:test';

describe('subtract', () => {
  it('正の数の引き算', () => {
    assert.strictEqual(subtract(10, 3), 7);
  });
  it('負の結果になる引き算', () => {
    assert.strictEqual(subtract(3, 10), -7);
  });
  it('同じ数の引き算はゼロ', () => {
    assert.strictEqual(subtract(5, 5), 0);
  });
});
