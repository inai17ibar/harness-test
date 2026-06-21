import { power } from './power.js';
import assert from 'node:assert';
import { describe, it } from 'node:test';

describe('power', () => {
  it('正の整数の累乗', () => {
    assert.strictEqual(power(2, 3), 8);
  });
  it('0乗は1', () => {
    assert.strictEqual(power(5, 0), 1);
  });
  it('1乗はそのまま', () => {
    assert.strictEqual(power(7, 1), 7);
  });
  it('負の指数', () => {
    assert.strictEqual(power(2, -2), 0.25);
  });
  it('底が0の場合', () => {
    assert.strictEqual(power(0, 5), 0);
  });
});
