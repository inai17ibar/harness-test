import { isPositive } from './isPositive.js';
import assert from 'node:assert';
import { describe, it } from 'node:test';
describe('isPositive', () => {
  it('正の数', () => assert.strictEqual(isPositive(5), true));
  it('負の数', () => assert.strictEqual(isPositive(-5), false));
  it('ゼロ', () => assert.strictEqual(isPositive(0), false));
});
