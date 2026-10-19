import { abs } from './abs.js';
import assert from 'node:assert';
import { describe, it } from 'node:test';
describe('abs', () => {
  it('正の数', () => assert.strictEqual(abs(5), 5));
  it('負の数', () => assert.strictEqual(abs(-3), 3));
  it('ゼロ', () => assert.strictEqual(abs(0), 0));
  it('マイナスゼロは 0', () => assert.strictEqual(abs(-0), 0));
  it('小数', () => assert.strictEqual(abs(-1.5), 1.5));
});
