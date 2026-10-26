import { abs } from './abs.js';
import assert from 'node:assert';
import { describe, it } from 'node:test';
describe('abs', () => {
  it('正の数', () => assert.strictEqual(abs(5), 5));
  it('負の数', () => assert.strictEqual(abs(-3), 3));
  it('ゼロ', () => assert.strictEqual(abs(0), 0));
  it('マイナスゼロは 0', () => assert.strictEqual(abs(-0), 0));
  it('小数', () => assert.strictEqual(abs(-1.5), 1.5));
  it('数値以外の文字列は NaN', () => assert.strictEqual(abs('abc'), NaN));
  it('空配列は 0', () => assert.strictEqual(abs([]), 0));
  it('オブジェクトは NaN', () => assert.strictEqual(abs({}), NaN));
  it('数値形式の文字列は数値に変換される', () => assert.strictEqual(abs('-7'), 7));
  it('Math.abs と同じ結果', () => {
    for (const v of [5, -3, 0, -0, -1.5, 'abc', [], {}, '-7', null, undefined, Infinity, -Infinity]) {
      assert.strictEqual(abs(v), Math.abs(v));
    }
  });
});
