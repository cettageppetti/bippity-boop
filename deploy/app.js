import { HUMAN, COMPUTER, LEARNING, learningLevel, earnedLearning, getResult, emptySquares, createBot } from './game-engine.mjs';
import { findAvatar, createProfileStore } from './profile.mjs';
import { createConfetti } from './confetti.mjs';
import { setupPWA } from './pwa.mjs';
import { createAudio } from './audio.mjs';
const CELL_NAMES = ['Top left', 'Top center', 'Top right', 'Middle left', 'Center', 'Middle right', 'Bottom left', 'Bottom center', 'Bottom right'];
const cells = [...document.querySelectorAll('.cell')];
const statusEl = document.querySelector('#status');
const avatarButton = document.querySelector('#avatarButton');
const avatarPicker = document.querySelector('#avatarPicker');
const avatarOptions = [...document.querySelectorAll('.avatar-option')];
const playerAvatarEl = document.querySelector('#playerAvatar');
const subtitleAvatarEl = document.querySelector('#subtitleAvatar');
const playerScoreEl = document.querySelector('#playerScore');
const computerScoreEl = document.querySelector('#computerScore');
const drawScoreEl = document.querySelector('#drawScore');
const newRoundButton = document.querySelector('#newRoundButton');
const resetScoreButton = document.querySelector('#resetScoreButton');
const soundToggle = document.querySelector('#soundToggle');
const brainpowerMeter = document.querySelector('#brainpowerMeter');
const brainpowerValue = document.querySelector('#brainpowerValue');
const brainpowerFill = document.querySelector('#brainpowerFill');
const brainpowerFlavor = document.querySelector('#brainpowerFlavor');
const installButton = document.querySelector('#installButton');
const confettiCanvas = document.querySelector('#confetti');
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

renderScore();
renderAvatar();
renderBrainpower();
confetti.resize();
window.addEventListener('resize', confetti.resize);
bot.startGame();

avatarButton?.addEventListener('click', () => {
  if (!avatarPicker) return;
  if (avatarPicker.hidden) {
    avatarPicker.hidden = false;
    avatarButton.setAttribute('aria-expanded', 'true');
    avatarOptions.find(option => option.dataset.avatar === selectedAvatar.emoji)?.focus();
  } else {
    closeAvatarPicker();
  }
});
avatarOptions.forEach(option => option.addEventListener('click', () => selectAvatar(option.dataset.avatar)));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && avatarPicker && !avatarPicker.hidden) closeAvatarPicker();
});
document.addEventListener('click', event => {
  if (avatarPicker && !avatarPicker.hidden && !avatarPicker.contains(event.target) && !avatarButton?.contains(event.target)) {
    closeAvatarPicker(false);
  }
});

cells.forEach(cell => cell.addEventListener('click', () => humanMove(Number(cell.dataset.cell))));
newRoundButton.addEventListener('click', startNewRound);
resetScoreButton.addEventListener('click', () => {
  score = { human: 0, computer: 0, draws: 0 };
  learningPoints = 0;
  profile.saveScore(score);
  profile.saveLearning(learningPoints);
  renderScore();
  renderBrainpower();
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
  setBoardDisabled(true);
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

  setBoardDisabled(false);
  statusEl.textContent = randomChoice([
    'Your move. Make it bippity.',
    'Your turn. Choose wisely-ish.',
    'Okay, human. Show me what you’ve got.'
  ]);
}

function placePiece(index, player) {
  round.board[index] = player;
  const cell = cells[index];
  renderCellPiece(index, player);
  cell.classList.add(player.toLowerCase(), 'pop');
  cell.disabled = true;
  window.setTimeout(() => cell.classList.remove('pop'), 320);
  audio.playMove(player);
}

function finishRound(result) {
  if (round.over) return;
  round.over = true;
  round.winner = result.type === 'win' ? result.player : null;
  round.computerThinking = false;
  setBoardDisabled(true);

  if (result.type === 'win') {
    result.line.forEach(i => cells[i].classList.add('win'));
    if (result.player === HUMAN) {
      score.human += 1;
      statusEl.textContent = humanVictoryMessage();
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
  renderScore();
  renderBrainpower();
}

function startNewRound() {
  window.clearTimeout(round.computerMoveTimer);
  round = createRound(learningPoints);
  closeAvatarPicker(false);
  bot.startGame();
  cells.forEach((cell, index) => {
    cell.textContent = '';
    cell.disabled = false;
    cell.className = 'cell';
    cell.setAttribute('aria-label', CELL_NAMES[index]);
  });
  statusEl.textContent = 'Your move. Pick a square.';
}

function setBoardDisabled(disabled) {
  cells.forEach((cell, i) => { cell.disabled = disabled || Boolean(round.board[i]); });
}

function renderBrainpower() {
  // A previous worker may briefly serve the old HTML during an update.
  // Optional presentation must not prevent board handlers from initializing.
  if (!brainpowerMeter || !brainpowerValue || !brainpowerFill || !brainpowerFlavor) return;
  const percent = Math.floor(learningPoints / LEARNING.maxPoints * 100);
  brainpowerValue.textContent = `${percent}%`;
  brainpowerFill.style.width = `${percent}%`;
  brainpowerMeter.setAttribute('aria-valuenow', String(percent));
  brainpowerFlavor.textContent = LEARNING.flavors[Math.floor(learningLevel(learningPoints) / 2)];
}

function randomChoice(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function humanVictoryMessage() {
  return `BIPPITY! The ${selectedAvatar.emoji} ${selectedAvatar.name} wins!`;
}

function renderAvatar() {
  if (playerAvatarEl) playerAvatarEl.textContent = selectedAvatar.emoji;
  if (subtitleAvatarEl) subtitleAvatarEl.textContent = `${selectedAvatar.emoji} ${selectedAvatar.name}`;
  renderPlayerLabel();
  avatarOptions.forEach(option => option.setAttribute('aria-pressed', String(option.dataset.avatar === selectedAvatar.emoji)));
  round.board.forEach((piece, index) => {
    if (piece === HUMAN) {
      renderCellPiece(index, HUMAN);
    }
  });
  if (round.over && round.winner === HUMAN) statusEl.textContent = humanVictoryMessage();
}

function selectAvatar(emoji) {
  const avatar = findAvatar(emoji);
  if (!avatar) return;
  selectedAvatar = avatar;
  profile.saveAvatar(avatar);
  renderAvatar();
  closeAvatarPicker();
}

function closeAvatarPicker(restoreFocus = true) {
  if (!avatarPicker) return;
  avatarPicker.hidden = true;
  avatarButton?.setAttribute('aria-expanded', 'false');
  if (restoreFocus) avatarButton?.focus();
}

function renderPlayerLabel() {
  avatarButton?.setAttribute('aria-label', `You, ${selectedAvatar.name}, ${score.human} wins. Change avatar`);
}

function renderCellPiece(index, player) {
  const cell = cells[index];
  cell.textContent = player === HUMAN ? selectedAvatar.emoji : '🤖';
  cell.setAttribute('aria-label', `${CELL_NAMES[index]}, ${player === HUMAN ? selectedAvatar.name : 'robot'}`);
}

function renderScore() {
  renderPlayerLabel();
  playerScoreEl.textContent = score.human;
  computerScoreEl.textContent = score.computer;
  drawScoreEl.textContent = score.draws;
}


function launchConfetti() { confetti.launch(); }
