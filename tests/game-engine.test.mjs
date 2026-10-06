import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as engine from '../deploy/game-engine.mjs';

function strategyChecks(api) {
  const bot = api.createBot({ random: () => 0 });
  assert.equal(bot.chooseMove(['X','','','','','','','',''], 0), 1);
  assert.equal(bot.chooseMove(['X','','','','','','','',''], 2), 4);
  const win = ['O','O','','X','','','','X',''];
  assert.equal(bot.chooseMove(win, 2), 4);
  assert.equal(bot.chooseMove(win, 4), 2);
  const loose = api.createBot({ random: () => 0.99 });
  const block = ['X','X','','','O','','','',''];
  assert.notEqual(loose.chooseMove(block, 4), 2);
  for (const level of [6, 8, 10, 12, 14]) {
    assert.equal(bot.chooseMove(['O','O','','X','X','','','',''], level), 2);
    assert.equal(bot.chooseMove(block, level), 2);
  }
  const opposite = ['X','','','','O','','','',''];
  assert.equal(bot.chooseMove(opposite, 6), 2);
  assert.equal(bot.chooseMove(opposite, 8), 8);
}

test('strategy unlocks preserve random, positional and tactical behavior', () => strategyChecks(engine));

test('fork stage creates and defends forks without changing its input', () => {
  const bot = engine.createBot({ random: () => 0 });
  assert.ok([2,6].includes(bot.chooseMove(['O','','','','X','','','','O'], 10)));
  const state = ['X','','','','O','','','','X'];
  const before = [...state];
  assert.ok([1,3,5,7].includes(bot.chooseMove(state, 10)));
  assert.deepEqual(state, before);
});

function imperfectionChecks(api) {
  const bot = api.createBot({ random: () => 0 });
  bot.startGame();
  // No weaker legal option exists; the armed mistake must remain pending.
  bot.chooseMove(['X','O','X','X','O','O','O','X',''], 12);
  const state = ['X','','','','','','','',''];
  const best = api.optimalMoves(api.analyzeComputerMoves(state));
  assert.ok(!best.includes(bot.chooseMove(state, 12)));
  assert.ok(best.includes(bot.chooseMove(state, 12)));
  assert.ok(best.includes(bot.chooseMove(state, 12)));
  bot.startGame();
  assert.ok(!best.includes(bot.chooseMove(state, 12)));
  // A different bot has independent per-game state.
  const other = api.createBot({ random: () => 0.5 });
  other.startGame();
  assert.ok(best.includes(other.chooseMove(state, 12)));
}

test('one imperfection remains pending, is consumed once and resets per game', () => imperfectionChecks(engine));

test('full brainpower ignores armed imperfections', () => {
  const bot = engine.createBot({ random: () => 0 });
  bot.startGame();
  const state = ['X','','','','','','','',''];
  assert.ok(engine.optimalMoves(engine.analyzeComputerMoves(state)).includes(bot.chooseMove(state, 14)));
});

test('perfect strategy cannot lose for any human continuation or optimal tie choice', () => {
  const seen = new Set();
  const bot = engine.createBot({ random: () => 0 });
  bot.startGame();
  function visit(state, humanTurn) {
    const result = engine.getResult(state);
    if (result) return result.player !== engine.HUMAN;
    const key = state.map(value => value || '-').join('') + humanTurn;
    if (seen.has(key)) return true;
    seen.add(key);
    const moves = humanTurn ? engine.emptySquares(state) : engine.optimalMoves(engine.analyzeComputerMoves(state));
    if (!humanTurn) assert.ok(moves.includes(bot.chooseMove(state, 14)));
    return moves.every(index => {
      const next = [...state];
      next[index] = humanTurn ? engine.HUMAN : engine.COMPUTER;
      return visit(next, !humanTurn);
    });
  }
  assert.equal(visit(Array(9).fill(''), true), true);
});

test('learning settings retain thresholds, rewards and maximum', () => {
  for (let level = 0; level <= 14; level++) assert.equal(engine.learningLevel(level * 4), level);
  assert.equal(engine.learningLevel(100), 14);
  assert.equal(engine.LEARNING.maxPoints, 56);
  assert.equal(engine.LEARNING.imperfectionRate, 0.12);
  assert.equal(engine.earnedLearning({ type: 'draw' }), 0.5);
  assert.equal(engine.earnedLearning({ type: 'win', player: engine.HUMAN }), 1);
  assert.equal(engine.earnedLearning({ type: 'win', player: engine.COMPUTER }), 0.25);
});

test('search and strategies preserve caller boards at every level', () => {
  const state = ['X','','','','O','','','','X'];
  const before = [...state];
  const bot = engine.createBot({ random: () => 0 });
  bot.startGame();
  for (let level = 0; level <= 14; level++) {
    assert.ok(engine.emptySquares(state).includes(bot.chooseMove(state, level)));
    assert.deepEqual(state, before);
  }
  engine.analyzeComputerMoves(state);
  assert.deepEqual(state, before);
});

const source = fs.readFileSync(new URL('../deploy/game-engine.mjs', import.meta.url), 'utf8');
function mutant(replace) {
  const modified = replace(source);
  assert.notEqual(modified, source, 'mutation must change the source');
  return vm.runInNewContext(modified.replaceAll('export ', '') + '\n({ createBot, optimalMoves, analyzeComputerMoves })');
}

test('behavior tests kill a progressive bot replaced by random play', () => {
  const api = mutant(s => s.replace('function chooseLearningMove(state, level) {', 'function chooseLearningMove(state, level) { return randomChoice(emptySquares(state));'));
  assert.throws(() => strategyChecks(api), assert.AssertionError);
});

test('behavior tests kill per-move random blunders', () => {
  const api = mutant(s => s.replace('if (imperfection.pending && !imperfection.used)', 'if (random() < 0.15)'));
  assert.throws(() => imperfectionChecks(api), assert.AssertionError);
});

test('behavior tests kill multiple armed blunders in one game', () => {
  const api = mutant(s => s.replace('if (imperfection.pending && !imperfection.used)', 'if (imperfection.pending)'));
  assert.throws(() => imperfectionChecks(api), assert.AssertionError);
});

test('rules recognize every winning line, draws and unfinished games', () => {
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for (const player of [engine.HUMAN, engine.COMPUTER]) for (const line of lines) {
    const state = Array(9).fill('');
    line.forEach(index => { state[index] = player; });
    assert.deepEqual(engine.getResult(state), { type: 'win', player, line });
  }
  assert.deepEqual(engine.getResult(['X','O','X','X','O','O','O','X','X']), { type: 'draw' });
  assert.equal(engine.getResult(Array(9).fill('')), null);
});
