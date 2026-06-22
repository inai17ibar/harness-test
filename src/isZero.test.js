import { isZero } from './isZero.js';
import assert from 'node:assert';
import { describe, it } from 'node:test';
describe('isZero', () => {
  it('ゼロ', () => assert.strictEqual(isZero(0), true));
  it('正の数', () => assert.strictEqual(isZero(5), false));
  it('負の数', () => assert.strictEqual(isZero(-3), false));
});
