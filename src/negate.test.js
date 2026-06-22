import { negate } from './negate.js';
import assert from 'node:assert';
import { describe, it } from 'node:test';
describe('negate', () => {
  it('正→負', () => assert.strictEqual(negate(5), -5));
  it('負→正', () => assert.strictEqual(negate(-3), 3));
  it('ゼロ', () => assert.strictEqual(negate(0), -0));
});
