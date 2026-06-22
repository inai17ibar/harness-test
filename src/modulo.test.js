import { modulo } from './modulo.js';
import assert from 'node:assert';
import { describe, it } from 'node:test';

describe('modulo', () => {
  it('正の数の余り', () => assert.strictEqual(modulo(10, 3), 1));
  it('割り切れる', () => assert.strictEqual(modulo(10, 5), 0));
  it('a が b より小さい', () => assert.strictEqual(modulo(3, 10), 3));
});
