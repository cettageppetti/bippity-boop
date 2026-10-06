const HUMAN = 'X';
const COMPUTER = 'O';
const AVATARS = [
  { emoji: '🦄', name: 'unicorn' }, { emoji: '🐲', name: 'dragon' },
  { emoji: '🐱', name: 'cat' }, { emoji: '🦊', name: 'fox' },
  { emoji: '🐸', name: 'frog' }, { emoji: '👻', name: 'ghost' },
  { emoji: '👽', name: 'alien' }, { emoji: '🐙', name: 'octopus' }
];
const CELL_NAMES = ['Top left', 'Top center', 'Top right', 'Middle left', 'Center', 'Middle right', 'Bottom left', 'Bottom center', 'Bottom right'];
const SMART_BOT_IMPERFECTION_RATE = 0.12;
const MAX_LEARNING_POINTS = 56;
const POINTS_PER_LEVEL = 4;
const wins = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

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
const ctx = confettiCanvas.getContext('2d');

let board = Array(9).fill('');
let roundOver = false;
let roundWinner = null;
let selectedAvatar = loadAvatar();
let computerThinking = false;
let computerMoveTimer = null;
let deferredInstallPrompt = null;
let audioContext = null;
let score = loadScore();
let learningPoints = loadLearning();
let roundLearningLevel = learningLevel();
let confettiPieces = [];
let confettiFrame = 0;
let smartBotImperfectMovePending = false;
let smartBotImperfectMoveUsed = false;

renderScore();
renderAvatar();
renderBrainpower();
resizeConfetti();
window.addEventListener('resize', resizeConfetti);
armSmartBotImperfectMove();

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
  saveScore();
  saveLearning();
  renderScore();
  renderBrainpower();
  startNewRound();
  statusEl.textContent = "BONK! BoopBot forgot everything. Your move.";
});

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installButton.hidden = false;
});

installButton.addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installButton.hidden = true;
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  installButton.hidden = true;
});

function humanMove(index) {
  if (roundOver || computerThinking || board[index]) return;
  placePiece(index, HUMAN);

  const result = getResult(board);
  if (result) return finishRound(result);

  computerThinking = true;
  setBoardDisabled(true);
  statusEl.textContent = randomChoice([
    'BoopBot is plotting…',
    'Tiny robot thoughts happening…',
    'Calculating maximum boop…'
  ]);

  const delay = 350 + Math.random() * 450;
  computerMoveTimer = window.setTimeout(computerMove, delay);
}

function computerMove() {
  computerMoveTimer = null;
  if (roundOver || !computerThinking) return;
  const available = emptySquares(board);
  if (!available.length) return finishRound({ type: 'draw' });

  const index = chooseLearningMove(board);

  placePiece(index, COMPUTER);
  computerThinking = false;

  const result = getResult(board);
  if (result) return finishRound(result);

  setBoardDisabled(false);
  statusEl.textContent = randomChoice([
    'Your move. Make it bippity.',
    'Your turn. Choose wisely-ish.',
    'Okay, human. Show me what you’ve got.'
  ]);
}

function placePiece(index, player) {
  board[index] = player;
  const cell = cells[index];
  cell.textContent = player === HUMAN ? selectedAvatar.emoji : '🤖';
  cell.classList.add(player.toLowerCase(), 'pop');
  cell.disabled = true;
  cell.setAttribute('aria-label', `${CELL_NAMES[index]}, ${player === HUMAN ? selectedAvatar.name : 'robot'}`);
  window.setTimeout(() => cell.classList.remove('pop'), 320);
  playBipBoop(player);
}

function finishRound(result) {
  if (roundOver) return;
  roundOver = true;
  roundWinner = result.type === 'win' ? result.player : null;
  computerThinking = false;
  setBoardDisabled(true);

  if (result.type === 'win') {
    result.line.forEach(i => cells[i].classList.add('win'));
    if (result.player === HUMAN) {
      score.human += 1;
      statusEl.textContent = humanVictoryMessage();
      launchConfetti();
      victoryJingle();
    } else {
      score.computer += 1;
      statusEl.textContent = randomChoice(['BOOP! BoopBot wins.', 'The machine has booped.', 'BoopBot takes this one.']);
      defeatJingle();
    }
  } else {
    score.draws += 1;
    statusEl.textContent = 'A perfectly respectable bippity-boop draw.';
    drawJingle();
  }

  learningPoints = Math.min(MAX_LEARNING_POINTS, learningPoints + (
    result.type === "draw" ? 0.5 : result.player === HUMAN ? 1 : 0.25
  ));
  saveScore();
  saveLearning();
  renderScore();
  renderBrainpower();
}

function startNewRound() {
  window.clearTimeout(computerMoveTimer);
  computerMoveTimer = null;
  board = Array(9).fill('');
  roundOver = false;
  roundWinner = null;
  closeAvatarPicker(false);
  computerThinking = false;
  roundLearningLevel = learningLevel();
  armSmartBotImperfectMove();
  cells.forEach((cell, index) => {
    cell.textContent = '';
    cell.disabled = false;
    cell.className = 'cell';
    cell.setAttribute('aria-label', CELL_NAMES[index]);
  });
  statusEl.textContent = 'Your move. Pick a square.';
}

function setBoardDisabled(disabled) {
  cells.forEach((cell, i) => { cell.disabled = disabled || Boolean(board[i]); });
}

function getResult(state) {
  for (const line of wins) {
    const [a, b, c] = line;
    if (state[a] && state[a] === state[b] && state[a] === state[c]) {
      return { type: 'win', player: state[a], line };
    }
  }
  if (state.every(Boolean)) return { type: 'draw' };
  return null;
}

function emptySquares(state) {
  return state.map((value, i) => value ? null : i).filter(i => i !== null);
}

function findImmediateMove(state, player) {
  for (const index of emptySquares(state)) {
    state[index] = player;
    const result = getResult(state);
    state[index] = '';
    if (result?.type === 'win' && result.player === player) return index;
  }
  return null;
}

function positionalMove(state, oppositeAware = false) {
  if (!state[4]) return 4;
  const available = emptySquares(state);
  if (oppositeAware) {
    const opposite = [[0, 8], [2, 6], [6, 2], [8, 0]]
      .filter(([humanCorner, oppositeCorner]) => state[humanCorner] === HUMAN && !state[oppositeCorner])
      .map(([, oppositeCorner]) => oppositeCorner);
    if (opposite.length) return randomChoice(opposite);
  }
  const corners = available.filter(index => [0, 2, 6, 8].includes(index));
  return randomChoice(corners.length ? corners : available);
}

function forkMoves(state, player) {
  return emptySquares(state).filter(index => {
    const next = [...state];
    next[index] = player;
    const threats = emptySquares(next).filter(target => {
      next[target] = player;
      const result = getResult(next);
      next[target] = '';
      return result?.type === 'win' && result.player === player;
    });
    return threats.length > 1;
  });
}

function defendFork(state) {
  const forks = forkMoves(state, HUMAN);
  if (forks.length === 1) return forks[0];
  if (!forks.length) return null;
  // A forcing threat can prevent several forks at once. Check the human's
  // forced block, or every reply when our move does not create a threat.
  const safe = emptySquares(state).filter(index => {
    const next = [...state];
    next[index] = COMPUTER;
    const forcedBlock = findImmediateMove(next, COMPUTER);
    const replies = forcedBlock === null ? emptySquares(next) : [forcedBlock];
    return replies.every(reply => {
      const afterReply = [...next];
      afterReply[reply] = HUMAN;
      if (getResult(afterReply)?.player === HUMAN) return false;
      if (findImmediateMove(afterReply, COMPUTER) !== null) return true;
      const threats = emptySquares(afterReply).filter(target => {
        const next = [...afterReply];
        next[target] = HUMAN;
        return getResult(next)?.player === HUMAN;
      });
      return threats.length <= 1;
    });
  });
  return safe.length ? randomChoice(safe) : null;
}

function chooseLearningMove(state, level = roundLearningLevel) {
  if (level >= 14) {
    const moves = analyzeComputerMoves(state);
    const bestScore = Math.max(...moves.map(move => move.score));
    return randomChoice(moves.filter(move => move.score === bestScore).map(move => move.index));
  }
  if (level >= 4) {
    const win = findImmediateMove(state, COMPUTER);
    if (win !== null) return win;
  }
  if (level >= 6) {
    const block = findImmediateMove(state, HUMAN);
    if (block !== null) return block;
  }
  if (level >= 12) return chooseSmartMove(state);
  if (level >= 10) {
    const forks = forkMoves(state, COMPUTER);
    if (forks.length) return randomChoice(forks);
    const defense = defendFork(state);
    if (defense !== null) return defense;
  }
  if (level >= 2) return positionalMove(state, level >= 8);
  return randomChoice(emptySquares(state));
}

function learningLevel() {
  return Math.min(14, Math.floor(learningPoints / POINTS_PER_LEVEL));
}

function loadLearning() {
  try {
    const value = JSON.parse(localStorage.getItem('bippity-boop-learning'));
    return typeof value === 'number' && Number.isFinite(value) && value >= 0
      ? Math.min(MAX_LEARNING_POINTS, value) : 0;
  } catch {
    return 0;
  }
}

function saveLearning() {
  try {
    localStorage.setItem('bippity-boop-learning', JSON.stringify(learningPoints));
  } catch {
    // Learning still works for this session if storage is unavailable.
  }
}

function renderBrainpower() {
  // A previous worker may briefly serve the old HTML during an update.
  // Optional presentation must not prevent board handlers from initializing.
  if (!brainpowerMeter || !brainpowerValue || !brainpowerFill || !brainpowerFlavor) return;
  const percent = Math.floor(learningPoints / MAX_LEARNING_POINTS * 100);
  brainpowerValue.textContent = `${percent}%`;
  brainpowerFill.style.width = `${percent}%`;
  brainpowerMeter.setAttribute('aria-valuenow', String(percent));
  const flavors = [
    'BoopBot is mostly guessing.',
    'BoopBot noticed something.',
    'BoopBot is learning your tricks.',
    'BoopBot has discovered strategy.',
    'BoopBot is getting suspiciously clever.',
    'BoopBot sees the forks coming.',
    'BoopBot sees almost everything.',
    'BoopBot has achieved maximum boop.'
  ];
  brainpowerFlavor.textContent = flavors[Math.floor(learningLevel() / 2)];
}

function armSmartBotImperfectMove() {
  smartBotImperfectMovePending = Math.random() < SMART_BOT_IMPERFECTION_RATE;
  smartBotImperfectMoveUsed = false;
}

function analyzeComputerMoves(state) {
  return emptySquares(state).map(index => {
    state[index] = COMPUTER;
    const score = minimax(state, 0, false);
    state[index] = '';
    return { index, score };
  });
}

function chooseSmartMove(state) {
  const moves = analyzeComputerMoves(state);
  const bestScore = Math.max(...moves.map(move => move.score));
  const bestMoves = moves.filter(move => move.score === bestScore).map(move => move.index);

  if (smartBotImperfectMovePending && !smartBotImperfectMoveUsed) {
    const imperfectMove = chooseSmartImperfectMove(moves, bestScore);
    if (imperfectMove !== null) {
      smartBotImperfectMoveUsed = true;
      return imperfectMove;
    }
  }

  return randomChoice(bestMoves);
}

function chooseSmartImperfectMove(moves, bestScore) {
  const nonBestMoves = moves.filter(move => move.score < bestScore);
  if (!nonBestMoves.length) return null;

  const safeImperfectMoves = nonBestMoves.filter(move => move.score >= 0);
  const candidateMoves = safeImperfectMoves.length ? safeImperfectMoves : nonBestMoves;
  const candidateScore = Math.max(...candidateMoves.map(move => move.score));
  return randomChoice(candidateMoves.filter(move => move.score === candidateScore).map(move => move.index));
}

function minimax(state, depth, maximizing) {
  const result = getResult(state);
  if (result?.type === 'win') return result.player === COMPUTER ? 10 - depth : depth - 10;
  if (result?.type === 'draw') return 0;

  if (maximizing) {
    let score = -Infinity;
    for (const index of emptySquares(state)) {
      state[index] = COMPUTER;
      score = Math.max(score, minimax(state, depth + 1, false));
      state[index] = '';
    }
    return score;
  }

  let score = Infinity;
  for (const index of emptySquares(state)) {
    state[index] = HUMAN;
    score = Math.min(score, minimax(state, depth + 1, true));
    state[index] = '';
  }
  return score;
}

function createAudioContext() {
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) return null;
  try {
    return new AudioContextCtor({ latencyHint: 'interactive' });
  } catch {
    try {
      return new AudioContextCtor();
    } catch {
      return null;
    }
  }
}

async function ensureAudioContext() {
  if (!soundToggle.checked) return null;

  if (!audioContext || audioContext.state === 'closed') {
    audioContext = createAudioContext();
  }
  if (!audioContext) return null;

  if (audioContext.state !== 'running') {
    try {
      await audioContext.resume();
    } catch {
      await resetAudioContext();
      audioContext = createAudioContext();
      if (!audioContext) return null;
      try {
        await audioContext.resume();
      } catch {
        return null;
      }
    }
  }

  if (audioContext.state !== 'running') {
    await resetAudioContext();
    audioContext = createAudioContext();
    if (!audioContext) return null;
    try {
      await audioContext.resume();
    } catch {
      return null;
    }
  }

  return audioContext.state === 'running' ? audioContext : null;
}

async function resetAudioContext() {
  const oldContext = audioContext;
  audioContext = null;
  if (!oldContext || oldContext.state === 'closed') return;
  try {
    await oldContext.close();
  } catch {
    // Some iOS/WebKit states reject close(); dropping the reference is enough.
  }
}

function unlockAudioFromUserGesture() {
  if (!soundToggle.checked) return;
  void ensureAudioContext();
}

async function playTone({ frequency, duration = 0.09, type = 'sine', gain = 0.12, slideTo = null }) {
  if (!soundToggle.checked) return;
  const context = await ensureAudioContext();
  if (!context) return;

  const oscillator = context.createOscillator();
  const gainNode = context.createGain();
  const now = context.currentTime;
  const stopAt = now + duration + 0.035;

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), now + duration);

  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), now + 0.008);
  gainNode.gain.setValueAtTime(Math.max(0.0001, gain), now + Math.max(0.01, duration - 0.02));
  gainNode.gain.exponentialRampToValueAtTime(0.0001, stopAt);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.addEventListener('ended', () => {
    oscillator.disconnect();
    gainNode.disconnect();
  }, { once: true });
  oscillator.start(now);
  oscillator.stop(stopAt);
}

document.addEventListener('pointerdown', unlockAudioFromUserGesture, { passive: true, capture: true });
document.addEventListener('touchstart', unlockAudioFromUserGesture, { passive: true, capture: true });
soundToggle.addEventListener('change', () => {
  if (soundToggle.checked) {
    unlockAudioFromUserGesture();
  } else {
    void resetAudioContext();
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') void resetAudioContext();
});
window.addEventListener('pagehide', () => {
  void resetAudioContext();
});
window.addEventListener('pageshow', () => {
  // Do not create audio here; iOS requires the next real user gesture to unlock it.
  void resetAudioContext();
});

function playBipBoop(player) {
  if (!soundToggle.checked) return;
  const bip = [620, 720, 840, 960];
  const boop = [320, 360, 400, 440];
  const isBip = Math.random() > 0.5;
  const pool = isBip ? bip : boop;
  const base = randomChoice(pool) * (player === COMPUTER ? 0.9 : 1);
  void playTone({
    frequency: base,
    slideTo: isBip ? base * 1.2 : base * 0.9,
    duration: isBip ? 0.075 : 0.13,
    type: isBip ? 'triangle' : 'sine',
    gain: 0.11
  });
}

function victoryJingle() {
  [523, 659, 784, 1047].forEach((f, i) => window.setTimeout(() => void playTone({ frequency: f, duration: .13, gain: .08 }), i * 90));
}
function defeatJingle() {
  [330, 277, 220].forEach((f, i) => window.setTimeout(() => void playTone({ frequency: f, duration: .16, type: 'triangle', gain: .07 }), i * 110));
}
function drawJingle() {
  [440, 523, 440].forEach((f, i) => window.setTimeout(() => void playTone({ frequency: f, duration: .1, gain: .06 }), i * 85));
}

function randomChoice(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function loadAvatar() {
  try {
    const emoji = localStorage.getItem('bippity-boop-avatar');
    return AVATARS.find(avatar => avatar.emoji === emoji) || AVATARS[0];
  } catch {
    return AVATARS[0];
  }
}

function humanVictoryMessage() {
  return `BIPPITY! The ${selectedAvatar.emoji} ${selectedAvatar.name} wins!`;
}

function renderAvatar() {
  if (playerAvatarEl) playerAvatarEl.textContent = selectedAvatar.emoji;
  if (subtitleAvatarEl) subtitleAvatarEl.textContent = `${selectedAvatar.emoji} ${selectedAvatar.name}`;
  avatarButton?.setAttribute('aria-label', `You, ${selectedAvatar.name}, ${score.human} wins. Change avatar`);
  avatarOptions.forEach(option => option.setAttribute('aria-pressed', String(option.dataset.avatar === selectedAvatar.emoji)));
  board.forEach((piece, index) => {
    if (piece === HUMAN) {
      cells[index].textContent = selectedAvatar.emoji;
      cells[index].setAttribute('aria-label', `${CELL_NAMES[index]}, ${selectedAvatar.name}`);
    }
  });
  if (roundOver && roundWinner === HUMAN) statusEl.textContent = humanVictoryMessage();
}

function selectAvatar(emoji) {
  const avatar = AVATARS.find(candidate => candidate.emoji === emoji);
  if (!avatar) return;
  selectedAvatar = avatar;
  try {
    localStorage.setItem('bippity-boop-avatar', avatar.emoji);
  } catch {
    // The selected avatar remains usable for this session.
  }
  renderAvatar();
  closeAvatarPicker();
}

function closeAvatarPicker(restoreFocus = true) {
  if (!avatarPicker) return;
  avatarPicker.hidden = true;
  avatarButton?.setAttribute('aria-expanded', 'false');
  if (restoreFocus) avatarButton?.focus();
}

function loadScore() {
  try {
    const stored = JSON.parse(localStorage.getItem('bippity-boop-score'));
    return Object.fromEntries(['human', 'computer', 'draws'].map(key => [
      key, Number.isSafeInteger(stored?.[key]) && stored[key] >= 0 ? stored[key] : 0
    ]));
  } catch {
    return { human: 0, computer: 0, draws: 0 };
  }
}
function saveScore() {
  try {
    localStorage.setItem('bippity-boop-score', JSON.stringify(score));
  } catch {
    // Keep the current session playable when storage is unavailable or full.
  }
}
function renderScore() {
  avatarButton?.setAttribute('aria-label', `You, ${selectedAvatar.name}, ${score.human} wins. Change avatar`);
  playerScoreEl.textContent = score.human;
  computerScoreEl.textContent = score.computer;
  drawScoreEl.textContent = score.draws;
}

function resizeConfetti() {
  const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  confettiCanvas.width = Math.round(innerWidth * ratio);
  confettiCanvas.height = Math.round(innerHeight * ratio);
  confettiCanvas.style.width = `${innerWidth}px`;
  confettiCanvas.style.height = `${innerHeight}px`;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function launchConfetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#ff63c3', '#ffb24d', '#ffe66d', '#57f0b1', '#46d9ff', '#9b7cff'];
  const burst = (side) => Array.from({ length: 85 }, () => ({
    x: side === 'left' ? innerWidth * .08 : innerWidth * .92,
    y: innerHeight * (.72 + (Math.random() - .5) * .08),
    vx: (side === 'left' ? 1 : -1) * (3.5 + Math.random() * 8.5),
    vy: -7 - Math.random() * 10,
    size: 6 + Math.random() * 9,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - .5) * .45,
    color: randomChoice(colors),
    life: 95 + Math.random() * 55
  }));

  confettiPieces = [...burst('left'), ...burst('right')];
  cancelAnimationFrame(confettiFrame);
  animateConfetti();
}

function animateConfetti() {
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  confettiPieces = confettiPieces.filter(p => p.life > 0 && p.y < innerHeight + 30);
  for (const p of confettiPieces) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += .22;
    p.vx *= .992;
    p.rot += p.vr;
    p.life -= 1;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.globalAlpha = Math.min(1, p.life / 25);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * .66);
    ctx.restore();
  }
  if (confettiPieces.length) confettiFrame = requestAnimationFrame(animateConfetti);
  else ctx.clearRect(0, 0, innerWidth, innerHeight);
}

async function configureServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    if (['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)) {
      const scriptURL = new URL('./service-worker.js', window.location.href).href;
      const registrations = await navigator.serviceWorker.getRegistrations();
      let removed = false;
      for (const registration of registrations) {
        const workers = [registration.active, registration.waiting, registration.installing];
        if (workers.some(worker => worker?.scriptURL === scriptURL)) {
          removed = await registration.unregister() || removed;
        }
      }
      // Reload once to release the old controller and obtain current files.
      if (removed && navigator.serviceWorker.controller?.scriptURL === scriptURL) {
        window.location.reload();
      }
    } else {
      await navigator.serviceWorker.register('./service-worker.js');
    }
  } catch {
    // Offline support is optional; registration errors must not affect play.
  }
}

window.addEventListener('load', configureServiceWorker);
