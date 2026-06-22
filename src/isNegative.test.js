import { isNegative } from './isNegative.js';
import assert from 'node:assert';
import { describe, it } from 'node:test';
describe('isNegative', () => {
  it('負の数', () => assert.strictEqual(isNegative(-5), true));
  it('正の数', () => assert.strictEqual(isNegative(5), false));
  it('ゼロ', () => assert.strictEqual(isNegative(0), false));
});
