import { double } from './double.js';
import assert from 'node:assert';
import { describe, it } from 'node:test';
describe('double', () => {
  it('正の数', () => assert.strictEqual(double(3), 6));
  it('ゼロ', () => assert.strictEqual(double(0), 0));
  it('負の数', () => assert.strictEqual(double(-4), -8));
});
