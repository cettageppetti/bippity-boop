import test from 'node:test';
import assert from 'node:assert/strict';
import { invariantFailures, sw, html, css } from './invariants.mjs';

test('UI and gameplay regression invariants hold', () => {
  assert.deepEqual(invariantFailures(), []);
});

test('service worker cache is bumped for this release', () => {
  assert.match(sw, /const CACHE = 'bippity-boop-v32';/);
});

test('score cards show the robot and retain matching label weight', () => {
  assert.match(html, /class="score-avatar" aria-hidden="true">🤖<\/span> BoopBot/);
  assert.match(css, /\.score-pill\s*\{[^}]*font-weight:\s*800;/);
  const avatarRule = css.match(/\.avatar-button\s*\{([^}]*)\}/)[1];
  assert.doesNotMatch(avatarRule, /font(?:-weight)?:/);
});

test('browser loads the app as a module and caches its engine dependency', () => {
  assert.match(html, /<script src="app.js" type="module"><\/script>/);
  assert.ok(sw.includes("'./game-engine.mjs'"));
});


test('mobile sound control shares the status row and reflects native checkbox state', () => {
  assert.match(html, /id="soundToggle" type="checkbox" aria-label="Sound" checked/);
  assert.match(css, /input:checked ~ \.sound-on\s*\{ display: inline;/);
  assert.match(css, /input:checked ~ \.sound-off\s*\{ display: none;/);
  assert.match(css, /\.sound-toggle\s*\{[^}]*width: 44px; height: 44px;/);
  assert.doesNotMatch(css, /\.status-wrap\s*\{[^}]*flex-direction: column/);
  assert.match(css, /100svh - 350px - env\(safe-area-inset-top\) - env\(safe-area-inset-bottom\)/);
});
