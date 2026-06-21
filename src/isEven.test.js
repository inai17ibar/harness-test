import { isEven } from './isEven.js';
import assert from 'node:assert';
import { describe, it } from 'node:test';

describe('isEven', () => {
  it('偶数はtrue', () => {
    assert.strictEqual(isEven(2), true);
  });
  it('奇数はfalse', () => {
    assert.strictEqual(isEven(3), false);
  });
  it('ゼロは偶数', () => {
    assert.strictEqual(isEven(0), true);
  });
  it('負の偶数はtrue', () => {
    assert.strictEqual(isEven(-4), true);
  });
  it('負の奇数はfalse', () => {
    assert.strictEqual(isEven(-7), false);
  });
});
