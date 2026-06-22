import { square } from './square.js';
import assert from 'node:assert';
import { describe, it } from 'node:test';
describe('square', () => {
  it('正の数', () => assert.strictEqual(square(4), 16));
  it('負の数', () => assert.strictEqual(square(-3), 9));
  it('ゼロ', () => assert.strictEqual(square(0), 0));
});
