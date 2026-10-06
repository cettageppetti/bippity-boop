import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', 'deploy');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const audio = fs.readFileSync(path.join(root, 'audio.mjs'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

function invariantFailures({ htmlSource = html, appSource = app, audioSource = audio, swSource = sw, cssSource = css } = {}) {
  const failures = [];
  if (!htmlSource.includes('Play as the <strong id="subtitleAvatar">🦄 unicorn</strong> against <strong>🤖 BoopBot</strong>.')) failures.push('subtitle must show unicorn and robot icons');
  if (/You’re\s*<strong>X<\/strong>|computer is\s*<strong>O<\/strong>/i.test(htmlSource)) failures.push('subtitle must not regress to X/O wording');
  if (!htmlSource.includes('>New game</button>')) failures.push('primary action button must say New game');
  if (htmlSource.includes('>New round</button>')) failures.push('New round wording must not return');
  if (!appSource.includes("cell.textContent = player === HUMAN ? selectedAvatar.emoji : '🤖';")) failures.push('board must show selected avatar and stable robot');
  if (!htmlSource.includes('id="avatarButton"') || !htmlSource.includes('id="avatarPicker"')) failures.push('score card avatar picker must remain');

  if (!audioSource.includes("let audioContext = null;")) failures.push('Web Audio context must be lazily created and replaceable');
  if (!audioSource.includes("latencyHint: 'interactive'")) failures.push('Web Audio must request interactive latency');
  if (!audioSource.includes('async function ensureAudioContext()')) failures.push('audio must have a central context recovery path');

  if (!audioSource.includes('const boop = [320, 360, 400, 440];')) failures.push('boop tone range must stay in the raised midrange');
  if (!audioSource.includes('slideTo: isBip ? base * 1.2 : base * 0.9')) failures.push('boop downward pitch slide must remain gentle');
  if (!audioSource.includes('await audioContext.resume();')) failures.push('suspended audio context must be resumed');
  if (!audioSource.includes("if (audioContext.state !== 'running')")) failures.push('audio must verify resume actually returned the context to running');
  if (!audioSource.includes('async function resetAudioContext()')) failures.push('audio context must be replaceable after lifecycle failures');
  if (!audioSource.includes("document.addEventListener('pointerdown', unlockAudioFromUserGesture")) failures.push('audio must unlock from pointer gestures');
  if (!audioSource.includes("document.addEventListener('touchstart', unlockAudioFromUserGesture")) failures.push('audio must unlock from iOS touch gestures');
  if (!audioSource.includes("document.visibilityState === 'hidden') void resetAudioContext()")) failures.push('backgrounding must discard the Web Audio context');
  if (!audioSource.includes("window.addEventListener('pagehide'")) failures.push('pagehide must discard the Web Audio context');
  if (!audioSource.includes('const oscillator = context.createOscillator();')) failures.push('tones must use low-latency oscillators');
  if (!audioSource.includes('oscillator.disconnect();') || !audioSource.includes('gainNode.disconnect();')) failures.push('finished Web Audio nodes must be disconnected');
  if (/new Audio\(|toneDataUrl|data:audio\/wav;base64|toneVoices|audioPrimer/.test(audioSource)) failures.push('gameplay audio must not use HTMLAudio/WAV playback');

  if (/soundToggle\.checked\s*=\s*false/.test(audioSource + appSource)) failures.push('gameplay must never programmatically turn sound off');

  if (htmlSource.includes('id="smartToggle"')) failures.push('fixed difficulty toggle must be replaced');
  if (!htmlSource.includes('id="soundToggle"')) failures.push('Sound control must remain');
  if (!htmlSource.includes('role="progressbar"') || !htmlSource.includes('BoopBot Brainpower')) failures.push('brainpower meter must be accessible');
  if (!htmlSource.includes('><span class="bonk-icon" aria-hidden="true">🥊</span> Bonk BoopBot</button>')) failures.push('Bonk reset must remain');
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
  for (const asset of ['./index.html', './styles.css', './app.js', './game-engine.mjs', './profile.mjs', './confetti.mjs', './pwa.mjs', './audio.mjs', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png']) {
    if (!swSource.includes(`'${asset}'`)) failures.push(`service worker must cache ${asset}`);
  }
  return failures;
}

export { invariantFailures, html, app, audio, sw, css };
