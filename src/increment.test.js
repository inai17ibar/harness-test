import { increment } from './increment.js';
import assert from 'node:assert';
import { describe, it } from 'node:test';
describe('increment', () => {
  it('正の数', () => assert.strictEqual(increment(5), 6));
  it('ゼロ', () => assert.strictEqual(increment(0), 1));
  it('負の数', () => assert.strictEqual(increment(-3), -2));
});
