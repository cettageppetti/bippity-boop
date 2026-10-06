import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createGameView } from '../deploy/ui.mjs';
import { HUMAN, LEARNING, learningLevel } from '../deploy/game-engine.mjs';
import { eventTarget } from './events.mjs';

function fixture(factory = createGameView) {
  const element = () => ({ ...eventTarget(), attributes: {}, style: {}, textContent: '', disabled: false,
    classList: { add() {} }, setAttribute(key, value) { this.attributes[key] = value; } });
  const cells = Array.from({ length: 9 }, element);
  const elements = new Map();
  const state = { round: { board: Array(9).fill(''), over: false, winner: null },
    score: { human: 2, computer: 3, draws: 1 }, selectedAvatar: { emoji: '🐸', name: 'frog' }, learningPoints: 28 };
  const view = factory({ document: { ...eventTarget(), querySelectorAll: selector => selector === '.cell' ? cells : [],
    querySelector(id) { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); } },
    window: { setTimeout() {} }, getState: () => state, onAvatarSelect() {} });
  return { state, view, cells, elements };
}

function pieceChecks(factory) {
  const f = fixture(factory);
  f.view.placePiece(0, 'X'); f.view.placePiece(1, 'O');
  assert.equal(f.cells[0].textContent, '🐸');
  assert.equal(f.cells[1].textContent, '🤖');
  assert.equal(f.cells[0].attributes['aria-label'], 'Top left, frog');
  assert.equal(f.cells[1].attributes['aria-label'], 'Top center, robot');
}

test('view renders selected player pieces and a stable robot with accessible labels', () => pieceChecks(createGameView));

test('view renders scores, learning percentage and avatar-dependent victory text', () => {
  const f = fixture();
  f.view.renderScore(); f.view.renderBrainpower();
  assert.equal(f.elements.get('#playerScore').textContent, 2);
  assert.equal(f.elements.get('#computerScore').textContent, 3);
  assert.equal(f.elements.get('#drawScore').textContent, 1);
  assert.equal(f.elements.get('#brainpowerValue').textContent, '50%');
  assert.equal(f.elements.get('#brainpowerMeter').attributes['aria-valuenow'], '50');
  assert.equal(f.elements.get('#brainpowerFill').style.width, '50%');
  f.state.round.over = true; f.state.round.winner = HUMAN;
  f.view.renderAvatar();
  assert.match(f.elements.get('#status').textContent, /🐸 frog wins/);
});

test('board reset clears piece text, classes, disabled state and accessible names', () => {
  const f = fixture();
  f.view.placePiece(0, 'X');
  f.view.resetBoard();
  assert.equal(f.cells[0].textContent, '');
  assert.equal(f.cells[0].className, 'cell');
  assert.equal(f.cells[0].disabled, false);
  assert.equal(f.cells[0].attributes['aria-label'], 'Top left');
});

test('behavior tests kill a view that exposes internal X/O tokens', () => {
  const source = fs.readFileSync(new URL('../deploy/ui.mjs', import.meta.url), 'utf8');
  const modified = source.replace("cell.textContent = player === HUMAN ? selectedAvatar.emoji : '🤖';", 'cell.textContent = player;');
  assert.notEqual(modified, source);
  const factory = vm.runInNewContext(modified.replace(/^import .*;\n/, '').replace('export ', '')+'\ncreateGameView', { HUMAN, LEARNING, learningLevel });
  assert.throws(() => pieceChecks(factory), assert.AssertionError);
});
