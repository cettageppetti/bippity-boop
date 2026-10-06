export const HUMAN = 'X';
export const COMPUTER = 'O';
const wins = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];

export const LEARNING = Object.freeze({
  maxPoints: 56, pointsPerLevel: 4, imperfectionRate: 0.12,
  levels: Object.freeze({ positioning: 2, wins: 4, blocks: 6, oppositeCorners: 8, forks: 10, nearOptimal: 12, perfect: 14 }),
  rewards: Object.freeze({ human: 1, draw: 0.5, computer: 0.25 }),
  flavors: Object.freeze([
    'BoopBot is mostly guessing.', 'BoopBot noticed something.',
    'BoopBot is learning your tricks.', 'BoopBot has discovered strategy.',
    'BoopBot is getting suspiciously clever.', 'BoopBot sees the forks coming.',
    'BoopBot sees almost everything.', 'BoopBot has achieved maximum boop.'
  ])
});

export function learningLevel(points) {
  return Math.min(LEARNING.levels.perfect, Math.floor(points / LEARNING.pointsPerLevel));
}

export function earnedLearning(result) {
  return result.type === 'draw' ? LEARNING.rewards.draw :
    result.player === HUMAN ? LEARNING.rewards.human : LEARNING.rewards.computer;
}

export function getResult(state) {
  for (const line of wins) {
    const [a, b, c] = line;
    if (state[a] && state[a] === state[b] && state[a] === state[c]) {
      return { type: 'win', player: state[a], line };
    }
  }
  if (state.every(Boolean)) return { type: 'draw' };
  return null;
}

export function emptySquares(state) {
  return state.map((value, i) => value ? null : i).filter(i => i !== null);
}

export function findImmediateMove(state, player) {
  for (const index of emptySquares(state)) {
    state[index] = player;
    const result = getResult(state);
    state[index] = '';
    if (result?.type === 'win' && result.player === player) return index;
  }
  return null;
}

export function analyzeComputerMoves(state) {
  return emptySquares(state).map(index => {
    state[index] = COMPUTER;
    const score = minimax(state, 0, false);
    state[index] = '';
    return { index, score };
  });
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

export function optimalMoves(moves) {
  const bestScore = Math.max(...moves.map(move => move.score));
  return moves.filter(move => move.score === bestScore).map(move => move.index);
}

export function createBot({ random = Math.random } = {}) {
  const imperfection = { pending: false, used: false };
  function randomChoice(items) { return items[Math.floor(random() * items.length)]; }
  function startGame() {
    imperfection.pending = random() < LEARNING.imperfectionRate;
    imperfection.used = false;
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

  function chooseLearningMove(state, level) {
    if (level >= LEARNING.levels.perfect) {
      return randomChoice(optimalMoves(analyzeComputerMoves(state)));
    }
    if (level >= LEARNING.levels.wins) {
      const win = findImmediateMove(state, COMPUTER);
      if (win !== null) return win;
    }
    if (level >= LEARNING.levels.blocks) {
      const block = findImmediateMove(state, HUMAN);
      if (block !== null) return block;
    }
    if (level >= LEARNING.levels.nearOptimal) return chooseSmartMove(state);
    if (level >= LEARNING.levels.forks) {
      const forks = forkMoves(state, COMPUTER);
      if (forks.length) return randomChoice(forks);
      const defense = defendFork(state);
      if (defense !== null) return defense;
    }
    if (level >= LEARNING.levels.positioning) return positionalMove(state, level >= LEARNING.levels.oppositeCorners);
    return randomChoice(emptySquares(state));
  }

  function chooseSmartMove(state) {
    const moves = analyzeComputerMoves(state);
    const bestScore = Math.max(...moves.map(move => move.score));
    const bestMoves = optimalMoves(moves);

    if (imperfection.pending && !imperfection.used) {
      const imperfectMove = chooseSmartImperfectMove(moves, bestScore);
      if (imperfectMove !== null) {
        imperfection.used = true;
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

  return { startGame, chooseMove: chooseLearningMove };
}
