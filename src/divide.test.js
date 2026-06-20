import { divide } from './divide.js';
import assert from 'node:assert';
import { describe, it } from 'node:test';

describe('divide', () => {
  it('正常な割り算', () => {
    assert.strictEqual(divide(10, 2), 5);
  });
  it('割り切れない場合は小数を返す', () => {
    assert.strictEqual(divide(7, 2), 3.5);
  });
  it('ゼロ除算はエラーを投げる', () => {
    assert.throws(() => divide(10, 0), /division by zero/i);
  });
});
