import { broken } from './broken.js';
import assert from 'node:assert';
import { describe, it } from 'node:test';

describe('broken', () => {
  it('2倍を返す', () => assert.strictEqual(broken(5), 10));
});
