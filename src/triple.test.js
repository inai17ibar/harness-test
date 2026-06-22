import { triple } from './triple.js';
import assert from 'node:assert';
import { describe, it } from 'node:test';
describe('triple', () => {
  it('正の数', () => assert.strictEqual(triple(3), 9));
  it('ゼロ', () => assert.strictEqual(triple(0), 0));
  it('負の数', () => assert.strictEqual(triple(-2), -6));
});
