import { clamp } from './clamp.js';
import assert from 'node:assert';
import { describe, it } from 'node:test';

describe('clamp', () => {
  it('範囲内の値はそのまま返す', () => {
    assert.strictEqual(clamp(5, 0, 10), 5);
  });
  it('最小値を下回る場合は最小値を返す', () => {
    assert.strictEqual(clamp(-5, 0, 10), 0);
  });
  it('最大値を上回る場合は最大値を返す', () => {
    assert.strictEqual(clamp(15, 0, 10), 10);
  });
  it('境界値: 最小値ちょうど', () => {
    assert.strictEqual(clamp(0, 0, 10), 0);
  });
  it('境界値: 最大値ちょうど', () => {
    assert.strictEqual(clamp(10, 0, 10), 10);
  });
});
