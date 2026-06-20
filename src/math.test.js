import { add, multiply } from './math.js';
import assert from 'node:assert';
import { describe, it } from 'node:test';

describe('math utils', () => {
  it('add: 基本的な足し算', () => {
    assert.strictEqual(add(2, 3), 5);
  });
  it('multiply: 基本的な掛け算', () => {
    assert.strictEqual(multiply(3, 4), 12);
  });
});
