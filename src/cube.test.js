import { cube } from './cube.js';
import assert from 'node:assert';
import { describe, it } from 'node:test';
describe('cube', () => {
  it('正の数', () => assert.strictEqual(cube(2), 8));
  it('ゼロ', () => assert.strictEqual(cube(0), 0));
  it('負の数', () => assert.strictEqual(cube(-3), -27));
});
