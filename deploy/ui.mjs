import { HUMAN, LEARNING, learningLevel } from './game-engine.mjs';

export function createGameView({ document, window, getState, onAvatarSelect }) {
  const CELL_NAMES = ['Top left', 'Top center', 'Top right', 'Middle left', 'Center', 'Middle right', 'Bottom left', 'Bottom center', 'Bottom right'];
  const cells = [...document.querySelectorAll('.cell')];
  const pieces = cells.map(cell => {
    const piece = document.createElement('span');
    piece.className = 'cell-piece';
    piece.setAttribute('aria-hidden', 'true');
    cell.textContent = '';
    cell.appendChild(piece);
    return piece;
  });
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
  avatarButton?.addEventListener('click', () => {
    if (!avatarPicker) return;
    if (avatarPicker.hidden) {
      avatarPicker.hidden = false;
      avatarButton.setAttribute('aria-expanded', 'true');
      avatarOptions.find(option => option.dataset.avatar === getState().selectedAvatar.emoji)?.focus();
    } else {
      closeAvatarPicker();
    }
  });
  avatarOptions.forEach(option => option.addEventListener('click', () => onAvatarSelect(option.dataset.avatar)));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && avatarPicker && !avatarPicker.hidden) closeAvatarPicker();
  });
  document.addEventListener('click', event => {
    if (avatarPicker && !avatarPicker.hidden && !avatarPicker.contains(event.target) && !avatarButton?.contains(event.target)) {
      closeAvatarPicker(false);
    }
  });

  function setBoardDisabled(disabled) {
    const { round } = getState();
    cells.forEach((cell, i) => { cell.disabled = disabled || Boolean(round.board[i]); });
  }

  function renderBrainpower() {
    const { learningPoints } = getState();
    // A previous worker may briefly serve the old HTML during an update.
    // Optional presentation must not prevent board handlers from initializing.
    if (!brainpowerMeter || !brainpowerValue || !brainpowerFill || !brainpowerFlavor) return;
    const percent = Math.floor(learningPoints / LEARNING.maxPoints * 100);
    brainpowerValue.textContent = `${percent}%`;
    brainpowerFill.style.width = `${percent}%`;
    brainpowerMeter.setAttribute('aria-valuenow', String(percent));
    brainpowerFlavor.textContent = LEARNING.flavors[Math.floor(learningLevel(learningPoints) / 2)];
  }


  function humanVictoryMessage() {
    const { selectedAvatar } = getState();
    return `BIPPITY! The ${selectedAvatar.emoji} ${selectedAvatar.name} wins!`;
  }

  function renderAvatar() {
    const { round, selectedAvatar } = getState();
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


  function closeAvatarPicker(restoreFocus = true) {
    if (!avatarPicker) return;
    avatarPicker.hidden = true;
    avatarButton?.setAttribute('aria-expanded', 'false');
    if (restoreFocus) avatarButton?.focus();
  }

  function renderPlayerLabel() {
    const { score, selectedAvatar } = getState();
    avatarButton?.setAttribute('aria-label', `You, ${selectedAvatar.name}, ${score.human} wins. Change avatar`);
  }

  function renderCellPiece(index, player) {
    const { selectedAvatar } = getState();
    const cell = cells[index];
    pieces[index].textContent = player === HUMAN ? selectedAvatar.emoji : '🤖';
    cell.setAttribute('aria-label', `${CELL_NAMES[index]}, ${player === HUMAN ? selectedAvatar.name : 'robot'}`);
  }

  function renderScore() {
    const { score } = getState();
    renderPlayerLabel();
    playerScoreEl.textContent = score.human;
    computerScoreEl.textContent = score.computer;
    drawScoreEl.textContent = score.draws;
  }


  function resetBoard() {
    cells.forEach((cell, index) => {
      pieces[index].textContent = '';
      cell.disabled = false;
      cell.className = 'cell';
      cell.setAttribute('aria-label', CELL_NAMES[index]);
    });
  }
  function placePiece(index, player) {
    const cell = cells[index];
    renderCellPiece(index, player);
    cell.classList.add(player.toLowerCase(), 'pop');
    cell.disabled = true;
    window.setTimeout(() => cell.classList.remove('pop'), 320);
  }
  return {
    elements: { cells, statusEl, newRoundButton, resetScoreButton, soundToggle, installButton, confettiCanvas },
    renderScore, renderAvatar, renderBrainpower, humanVictoryMessage, closeAvatarPicker,
    setBoardDisabled, resetBoard, placePiece,
    highlightWin(line) { line.forEach(index => cells[index].classList.add('win')); }
  };
}
