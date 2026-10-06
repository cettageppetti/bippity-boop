import test from 'node:test';
import assert from 'node:assert/strict';
import { invariantFailures, sw } from './invariants.mjs';

test('UI and gameplay regression invariants hold', () => {
  assert.deepEqual(invariantFailures(), []);
});

test('service worker cache is bumped for this release', () => {
  assert.match(sw, /const CACHE = 'bippity-boop-v19';/);
});
