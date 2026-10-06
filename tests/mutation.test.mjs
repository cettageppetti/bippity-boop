import test from 'node:test';
import assert from 'node:assert/strict';
import { invariantFailures, html, app, audio, sw, css } from './invariants.mjs';

const mutants = [
  {
    name: 'long sound explanation returns to subtitle',
    htmlSource: html.replace('</strong>.</p>', '</strong>. Every move gets a tiny synthesized bip or boop.</p>')
  },
  {
    name: 'speaker control loses accessible name',
    htmlSource: html.replace('aria-label="Sound"', '')
  },
  {
    name: 'muted speaker state disappears',
    htmlSource: html.replace('class="sound-off"', 'class="removed"')
  },
  {
    name: 'avatar picker disappears',
    htmlSource: html.replace('id="avatarPicker"', 'id="removedPicker"')
  },
  {
    name: 'Sound control disappears',
    htmlSource: html.replace('id="soundToggle"', 'id="removedSound"')
  },
  {
    name: 'brainpower meter loses accessibility',
    htmlSource: html.replace('role="progressbar"', '')
  },
  {
    name: 'Bonk action reverts to score-only wording',
    htmlSource: html.replace('><span class="bonk-icon" aria-hidden="true">🥊</span> Bonk BoopBot</button>', '>Reset score</button>')
  },
  {
    name: 'subtitle loses its emoji icons',
    htmlSource: html.replace('Play as the <strong id="subtitleAvatar">🦄 unicorn</strong> against <strong>🤖 BoopBot</strong>.', 'Play as the <strong>unicorn</strong> against <strong>BoopBot</strong>.'),
    appSource: app, swSource: sw, cssSource: css
  },
  {
    name: 'interactive latency hint disappears',
    htmlSource: html,
    audioSource: audio.replace("{ latencyHint: 'interactive' }", '{}'),
    swSource: sw, cssSource: css
  },
  {
    name: 'iOS touch unlock disappears',
    htmlSource: html,
    audioSource: audio.replace("document.addEventListener('touchstart', unlockAudioFromUserGesture, { passive: true, capture: true });", ''),
    swSource: sw, cssSource: css
  },
  {
    name: 'resume is no longer awaited',
    htmlSource: html,
    audioSource: audio.replace('Promise.resolve(context.resume())', 'Promise.resolve()'),
    swSource: sw, cssSource: css
  },
  {
    name: 'background no longer resets audio context',
    htmlSource: html,
    audioSource: audio.replace("if (document.visibilityState === 'hidden') void resetAudioContext();", ''),
    swSource: sw, cssSource: css
  },
  {
    name: 'Web Audio node cleanup disappears',
    htmlSource: html,
    audioSource: audio.replace(/oscillator\?\.disconnect\(\);/, ''),
    swSource: sw, cssSource: css
  },
  {
    name: 'HTMLAudio latency path returns',
    htmlSource: html,
    audioSource: audio.replace('let audioContext = null;', 'let audioContext = null;\nconst fallbackAudio = new Audio();'),
    swSource: sw, cssSource: css
  },
  {
    name: 'gameplay forcibly turns sound off',
    htmlSource: html,
    appSource: app.replace('function humanMove(index) {', 'function humanMove(index) {\n  soundToggle.checked = false;'),
    swSource: sw, cssSource: css
  },
  {
    name: 'button wording regresses to New round',
    htmlSource: html.replace('>New game</button>', '>New round</button>'),
    appSource: app, swSource: sw, cssSource: css
  },
  {
    name: 'blank tile highlight overlay returns',
    htmlSource: html,
    appSource: app, swSource: sw,
    cssSource: css.replace('.cell.x::before,\n.cell.o::before {', '.cell::before {')
  }
];

for (const mutant of mutants) {
  test(`mutation is killed: ${mutant.name}`, () => {
    assert.ok(invariantFailures(mutant).length > 0, `surviving mutant: ${mutant.name}`);
  });
}
