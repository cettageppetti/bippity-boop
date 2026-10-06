import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

function invariantFailures({ htmlSource = html, appSource = app, swSource = sw, cssSource = css } = {}) {
  const failures = [];
  if (!htmlSource.includes('Play as the <strong>🦄 unicorn</strong> against <strong>🤖 BoopBot</strong>.')) failures.push('subtitle must show unicorn and robot icons');
  if (/You’re\s*<strong>X<\/strong>|computer is\s*<strong>O<\/strong>/i.test(htmlSource)) failures.push('subtitle must not regress to X/O wording');
  if (!htmlSource.includes('>New game</button>')) failures.push('primary action button must say New game');
  if (htmlSource.includes('>New round</button>')) failures.push('New round wording must not return');
  if (!appSource.includes("const DISPLAY_PIECES = { [HUMAN]: '🦄', [COMPUTER]: '🤖' };")) failures.push('display pieces must remain unicorn and robot');

  if (!appSource.includes("let audioContext = null;")) failures.push('Web Audio context must be lazily created and replaceable');
  if (!appSource.includes("latencyHint: 'interactive'")) failures.push('Web Audio must request interactive latency');
  if (!appSource.includes('async function ensureAudioContext()')) failures.push('audio must have a central context recovery path');

  if (!appSource.includes('const boop = [320, 360, 400, 440];')) failures.push('boop tone range must stay in the raised midrange');
  if (!appSource.includes('slideTo: isBip ? base * 1.2 : base * 0.9')) failures.push('boop downward pitch slide must remain gentle');
  if (!appSource.includes('await audioContext.resume();')) failures.push('suspended audio context must be resumed');
  if (!appSource.includes("if (audioContext.state !== 'running')")) failures.push('audio must verify resume actually returned the context to running');
  if (!appSource.includes('async function resetAudioContext()')) failures.push('audio context must be replaceable after lifecycle failures');
  if (!appSource.includes("document.addEventListener('pointerdown', unlockAudioFromUserGesture")) failures.push('audio must unlock from pointer gestures');
  if (!appSource.includes("document.addEventListener('touchstart', unlockAudioFromUserGesture")) failures.push('audio must unlock from iOS touch gestures');
  if (!appSource.includes("document.visibilityState === 'hidden') void resetAudioContext()")) failures.push('backgrounding must discard the Web Audio context');
  if (!appSource.includes("window.addEventListener('pagehide'")) failures.push('pagehide must discard the Web Audio context');
  if (!appSource.includes('const oscillator = context.createOscillator();')) failures.push('tones must use low-latency oscillators');
  if (!appSource.includes('oscillator.disconnect();') || !appSource.includes('gainNode.disconnect();')) failures.push('finished Web Audio nodes must be disconnected');
  if (/new Audio\(|toneDataUrl|data:audio\/wav;base64|toneVoices|audioPrimer/.test(appSource)) failures.push('gameplay audio must not use HTMLAudio/WAV playback');

  if (/soundToggle\.checked\s*=\s*false/.test(appSource)) failures.push('gameplay must never programmatically turn sound off');

  if (!appSource.includes('index = basicMove(board);')) failures.push('basic bot must use its tactical strategy instead of pure random play');
  if (!appSource.includes('const winningMove = findImmediateMove(state, COMPUTER);')) failures.push('basic bot must take immediate winning moves');
  if (!appSource.includes('const blockingMove = findImmediateMove(state, HUMAN);')) failures.push('basic bot must block immediate human wins');
  if (!appSource.includes('if (!state[4]) return 4;')) failures.push('basic bot should prefer the center when no tactic is urgent');
  if (!appSource.includes('if (Math.random() < 0.2) return randomChoice(available);')) failures.push('basic bot must retain a small imperfection rate');

  if (!appSource.includes('const SMART_BOT_IMPERFECTION_RATE = 0.12;')) failures.push('smart bot must keep a per-game imperfection rate');
  if (!appSource.includes('function armSmartBotImperfectMove()')) failures.push('smart bot must arm its imperfection state per game');
  if (!appSource.includes('smartBotImperfectMovePending = Math.random() < SMART_BOT_IMPERFECTION_RATE;')) failures.push('smart bot imperfection must be scheduled per game');
  if (!appSource.includes('if (smartBotImperfectMovePending && !smartBotImperfectMoveUsed)')) failures.push('smart bot must allow at most one intentional imperfect move per game');
  if (!appSource.includes('smartBotImperfectMoveUsed = true;')) failures.push('smart bot must mark its single imperfect move as consumed');
  if (!appSource.includes('index = chooseSmartMove(board);')) failures.push('smart bot must route move selection through chooseSmartMove');
  if (/Math\.random\(\)\s*<\s*0\.15\s*\?\s*randomChoice\(available\)\s*:\s*bestMove\(board\)/.test(appSource)) failures.push('smart bot must not use per-move random blunders');

  const finishStart = appSource.indexOf('function finishRound(result)');
  const finishEnd = appSource.indexOf('function startNewRound()', finishStart);
  const finishSource = finishStart >= 0 && finishEnd > finishStart ? appSource.slice(finishStart, finishEnd) : '';
  const humanStart = finishSource.indexOf('if (result.player === HUMAN)');
  const botStart = finishSource.indexOf('} else {', humanStart);
  const humanWinSource = humanStart >= 0 && botStart > humanStart ? finishSource.slice(humanStart, botStart) : '';
  const botWinSource = botStart >= 0 ? finishSource.slice(botStart) : '';
  if (!humanWinSource.includes('launchConfetti();')) failures.push('human wins must launch confetti');
  if (botWinSource.includes('launchConfetti();')) failures.push('computer wins must not launch confetti');

  if (/\.cell::before\s*\{/.test(cssSource) || /\.cell::after\s*\{/.test(cssSource)) failures.push('blank tiles must not have highlight overlay pseudo-elements');
  if (!cssSource.includes('.cell.x::before') || !cssSource.includes('.cell.o::before') || !cssSource.includes('.cell.x::after') || !cssSource.includes('.cell.o::after')) failures.push('occupied tiles must retain their highlight treatment');
  for (const asset of ['./index.html', './styles.css', './app.js', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png']) {
    if (!swSource.includes(`'${asset}'`)) failures.push(`service worker must cache ${asset}`);
  }
  return failures;
}

test('UI and gameplay regression invariants hold', () => {
  assert.deepEqual(invariantFailures(), []);
});

test('service worker cache is bumped for this release', () => {
  assert.match(sw, /const CACHE = 'bippity-boop-v18';/);
});

export { invariantFailures, html, app, sw, css };
