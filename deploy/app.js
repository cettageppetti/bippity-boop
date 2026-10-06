import { HUMAN, COMPUTER, LEARNING, learningLevel, earnedLearning, getResult, emptySquares, createBot } from './game-engine.mjs';
import { findAvatar, createProfileStore } from './profile.mjs';
import { createConfetti } from './confetti.mjs';
import { setupPWA } from './pwa.mjs';
import { createAudio } from './audio.mjs';
import { createGameView } from './ui.mjs';

const view = createGameView({ document, window,
  getState: () => ({ round, score, selectedAvatar, learningPoints }),
  onAvatarSelect: selectAvatar
});
const { cells, statusEl, newRoundButton, resetScoreButton, soundToggle, installButton, confettiCanvas } = view.elements;
const confetti = createConfetti(confettiCanvas, {
  viewport: window, random: () => Math.random(),
  requestFrame: callback => requestAnimationFrame(callback),
  cancelFrame: frame => cancelAnimationFrame(frame),
  reducedMotion: () => matchMedia('(prefers-reduced-motion: reduce)').matches
});
const pwa = setupPWA({ window, navigator, installButton });

const profile = createProfileStore(() => localStorage);
let selectedAvatar = profile.loadAvatar();

const audio = createAudio({ window, document, soundToggle, random: () => Math.random() });
let score = profile.loadScore();
let learningPoints = profile.loadLearning();
let round = createRound(learningPoints);
const bot = createBot({ random: () => Math.random() });

view.renderScore();
view.renderAvatar();
view.renderBrainpower();
confetti.resize();
window.addEventListener('resize', confetti.resize);
bot.startGame();

cells.forEach(cell => cell.addEventListener('click', () => humanMove(Number(cell.dataset.cell))));
newRoundButton.addEventListener('click', startNewRound);
resetScoreButton.addEventListener('click', () => {
  score = { human: 0, computer: 0, draws: 0 };
  learningPoints = 0;
  profile.saveScore(score);
  profile.saveLearning(learningPoints);
  view.renderScore();
  view.renderBrainpower();
  startNewRound();
  statusEl.textContent = "BONK! BoopBot forgot everything. Your move.";
});

function createRound(points) {
  return {
    board: Array(9).fill(''), over: false, winner: null,
    computerThinking: false, computerMoveTimer: null,
    learningLevel: learningLevel(points)
  };
}

function humanMove(index) {
  if (round.over || round.computerThinking || round.board[index]) return;
  placePiece(index, HUMAN);

  const result = getResult(round.board);
  if (result) return finishRound(result);

  round.computerThinking = true;
  view.setBoardDisabled(true);
  statusEl.textContent = randomChoice([
    'BoopBot is plotting…',
    'Tiny robot thoughts happening…',
    'Calculating maximum boop…'
  ]);

  const delay = 350 + Math.random() * 450;
  round.computerMoveTimer = window.setTimeout(computerMove, delay);
}

function computerMove() {
  round.computerMoveTimer = null;
  if (round.over || !round.computerThinking) return;
  const available = emptySquares(round.board);
  if (!available.length) return finishRound({ type: 'draw' });

  const index = bot.chooseMove(round.board, round.learningLevel);

  placePiece(index, COMPUTER);
  round.computerThinking = false;

  const result = getResult(round.board);
  if (result) return finishRound(result);

  view.setBoardDisabled(false);
  statusEl.textContent = randomChoice([
    'Your move. Make it bippity.',
    'Your turn. Choose wisely-ish.',
    'Okay, human. Show me what you’ve got.'
  ]);
}

function placePiece(index, player) {
  round.board[index] = player;
  view.placePiece(index, player);
  audio.playMove(player);
}

function finishRound(result) {
  if (round.over) return;
  round.over = true;
  round.winner = result.type === 'win' ? result.player : null;
  round.computerThinking = false;
  view.setBoardDisabled(true);

  if (result.type === 'win') {
    view.highlightWin(result.line);
    if (result.player === HUMAN) {
      score.human += 1;
      statusEl.textContent = view.humanVictoryMessage();
      launchConfetti();
      audio.victory();
    } else {
      score.computer += 1;
      statusEl.textContent = randomChoice(['BOOP! BoopBot wins.', 'The machine has booped.', 'BoopBot takes this one.']);
      audio.defeat();
    }
  } else {
    score.draws += 1;
    statusEl.textContent = 'A perfectly respectable bippity-boop draw.';
    audio.draw();
  }

  learningPoints = Math.min(LEARNING.maxPoints, learningPoints + earnedLearning(result));
  profile.saveScore(score);
  profile.saveLearning(learningPoints);
  view.renderScore();
  view.renderBrainpower();
}

function startNewRound() {
  audio.cancel();
  window.clearTimeout(round.computerMoveTimer);
  round = createRound(learningPoints);
  view.closeAvatarPicker(false);
  bot.startGame();
  view.resetBoard();
  statusEl.textContent = 'Your move. Pick a square.';
}

function randomChoice(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function selectAvatar(emoji) {
  const avatar = findAvatar(emoji);
  if (!avatar) return;
  selectedAvatar = avatar;
  profile.saveAvatar(avatar);
  view.renderAvatar();
  view.closeAvatarPicker();
}

function launchConfetti() { confetti.launch(); }
