import test from 'node:test';
import assert from 'node:assert/strict';
import { invariantFailures, sw, html, css } from './invariants.mjs';

test('UI and gameplay regression invariants hold', () => {
  assert.deepEqual(invariantFailures(), []);
});

test('service worker cache is bumped for this release', () => {
  assert.match(sw, /const CACHE = 'bippity-boop-v24';/);
});

test('score cards show the robot and retain matching label weight', () => {
  assert.match(html, /class="score-avatar" aria-hidden="true">🤖<\/span> BoopBot/);
  assert.match(css, /\.score-pill\s*\{[^}]*font-weight:\s*800;/);
  const avatarRule = css.match(/\.avatar-button\s*\{([^}]*)\}/)[1];
  assert.doesNotMatch(avatarRule, /font(?:-weight)?:/);
});
