import test from 'node:test';
import assert from 'node:assert/strict';
import { invariantFailures, html, app, sw, css } from './invariants.mjs';

const mutants = [
  {
    name: 'avatar picker disappears',
    htmlSource: html.replace('id="avatarPicker"', 'id="removedPicker"')
  },
  {
    name: 'board ignores selected avatar',
    appSource: app.replace("cell.textContent = player === HUMAN ? selectedAvatar.emoji : '🤖';", "cell.textContent = player;")
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
    appSource: app.replace("{ latencyHint: 'interactive' }", '{}'),
    swSource: sw, cssSource: css
  },
  {
    name: 'iOS touch unlock disappears',
    htmlSource: html,
    appSource: app.replace("document.addEventListener('touchstart', unlockAudioFromUserGesture, { passive: true, capture: true });", ''),
    swSource: sw, cssSource: css
  },
  {
    name: 'resume is no longer awaited',
    htmlSource: html,
    appSource: app.replaceAll('await audioContext.resume();', 'audioContext.resume();'),
    swSource: sw, cssSource: css
  },
  {
    name: 'background no longer resets audio context',
    htmlSource: html,
    appSource: app.replace("if (document.visibilityState === 'hidden') void resetAudioContext();", ''),
    swSource: sw, cssSource: css
  },
  {
    name: 'Web Audio node cleanup disappears',
    htmlSource: html,
    appSource: app.replace('    oscillator.disconnect();\n    gainNode.disconnect();', ''),
    swSource: sw, cssSource: css
  },
  {
    name: 'HTMLAudio latency path returns',
    htmlSource: html,
    appSource: app.replace('let audioContext = null;', 'let audioContext = null;\nconst fallbackAudio = new Audio();'),
    swSource: sw, cssSource: css
  },
  {
    name: 'gameplay forcibly turns sound off',
    htmlSource: html,
    appSource: app.replace('function humanMove(index) {', 'function humanMove(index) {\n  soundToggle.checked = false;'),
    swSource: sw, cssSource: css
  },
  {
    name: 'human victory stops launching confetti',
    htmlSource: html,
    appSource: app.replace('      launchConfetti();', ''),
    swSource: sw, cssSource: css
  },
  {
    name: 'button wording regresses to New round',
    htmlSource: html.replace('>New game</button>', '>New round</button>'),
    appSource: app, swSource: sw, cssSource: css
  },
  {
    name: 'progressive bot regresses to pure random play',
    htmlSource: html,
    appSource: app.replace('const index = chooseLearningMove(board);', 'const index = randomChoice(emptySquares(board));'),
    swSource: sw, cssSource: css
  },
  {
    name: 'smart bot regresses to per-move random blunders',
    htmlSource: html,
    appSource: app.replace('  if (level >= 12) return chooseSmartMove(state);', '  if (level >= 12) return Math.random() < 0.15 ? randomChoice(emptySquares(state)) : chooseSmartMove(state);'),
    swSource: sw, cssSource: css
  },
  {
    name: 'smart bot can use multiple intentional blunders',
    htmlSource: html,
    appSource: app.replace('if (smartBotImperfectMovePending && !smartBotImperfectMoveUsed)', 'if (smartBotImperfectMovePending)'),
    swSource: sw, cssSource: css
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
