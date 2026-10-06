import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { app, sw } from './invariants.mjs';

function game({ stored = null, storageThrows = false, AudioContext } = {}) {
  const timers = new Map();
  let nextTimer = 0;
  const element = () => ({ textContent: '', checked: false, disabled: false, style: {}, className: 'cell',
    classList: { add() {}, remove() {} }, listeners: {},
    addEventListener(type, fn) { this.listeners[type] = fn; },
    getAttribute() { return 'Center'; }, setAttribute() {},
    getContext() { return { setTransform() {} }; } });
  const cells = Array.from({ length: 9 }, element);
  const elements = new Map();
  const context = vm.createContext({
    document: { querySelectorAll: () => cells, querySelector: id => {
      if (!elements.has(id)) elements.set(id, element());
      return elements.get(id);
    }, addEventListener() {} },
    window: { addEventListener() {}, AudioContext,
      setTimeout(fn) { timers.set(++nextTimer, fn); return nextTimer; },
      clearTimeout(id) { timers.delete(id); } },
    navigator: {}, innerWidth: 400, innerHeight: 800,
    localStorage: { getItem() { if (storageThrows) throw Error('unavailable'); return stored; },
      setItem() { if (storageThrows) throw Error('unavailable'); } },
    matchMedia: () => ({ matches: true })
  });
  vm.runInContext(app, context);
  return { run: code => vm.runInContext(code, context), elements, timers };
}

for (const reset of ['startNewRound()', "resetScoreButton.listeners.click()"] ) {
  test(`${reset} cancels a pending bot turn`, () => {
    const g = game();
    g.run('humanMove(0)');
    const timer = g.run('computerMoveTimer');
    assert.ok(g.timers.has(timer));
    g.run(reset);
    assert.equal(g.timers.has(timer), false);
    g.run('computerMove()');
    assert.equal(g.run('board.every(value => !value)'), true);
    g.run('humanMove(4)');
    const newTimer = g.run('computerMoveTimer');
    g.timers.get(newTimer)();
    assert.equal(g.run("board.filter(value => value === COMPUTER).length"), 1);
  });
}

test('stored scores are validated and valid values are retained', () => {
  for (const stored of ['null', '{}', '"bad"', '{bad', '{"human":-1,"draws":1.5,"computer":"2"}']) {
    assert.equal(game({ stored }).run('JSON.stringify(score)'), '{"human":0,"computer":0,"draws":0}');
  }
  assert.equal(game({ stored: '{"human":3,"computer":4,"draws":2}' }).run('score.human'), 3);
});

test('storage failures do not interrupt scoring or resets', () => {
  const g = game({ storageThrows: true });
  g.run("finishRound({ type: 'draw' })");
  assert.equal(g.run('score.draws'), 1);
  assert.equal(g.elements.get('#drawScore').textContent, 1);
  g.run('resetScoreButton.listeners.click()');
  assert.equal(g.run('score.draws'), 0);
});

test('basic bot wins before blocking and blocks before positional randomness', () => {
  const g = game();
  assert.equal(g.run("basicMove(['O','O','','X','X','','','',''])"), 2);
  assert.equal(g.run("basicMove(['X','X','','','O','','','',''])"), 2);
  assert.equal(g.run("Math.random = () => 0.5; basicMove(['X','','','','','','','',''])"), 4);
});

test('pure minimax cannot lose against any human continuation or optimal tie choice', () => {
  const g = game();
  assert.equal(g.run(`(() => {
    const seen = new Set();
    function visit(state, humanTurn) {
      const result = getResult(state);
      if (result) return result.player !== HUMAN;
      const key = state.map(value => value || '-').join('') + humanTurn;
      if (seen.has(key)) return true;
      seen.add(key);
      const moves = humanTurn ? emptySquares(state) : (() => {
        const choices = analyzeComputerMoves(state);
        const best = Math.max(...choices.map(move => move.score));
        return choices.filter(move => move.score === best).map(move => move.index);
      })();
      return moves.every(index => {
        const next = [...state]; next[index] = humanTurn ? HUMAN : COMPUTER;
        return visit(next, !humanTurn);
      });
    }
    return visit(Array(9).fill(''), true);
  })()`), true);
});

test('smart imperfection stays pending without alternatives and is consumed only once', () => {
  const g = game();
  g.run("smartBotImperfectMovePending = true; chooseSmartMove(['X','O','X','X','O','O','O','X',''])");
  assert.equal(g.run('smartBotImperfectMoveUsed'), false);
  const state = "['X','X','','O','','','','','']";
  g.run(`chooseSmartMove(${state})`);
  assert.equal(g.run('smartBotImperfectMoveUsed'), true);
  assert.equal(g.run(`chooseSmartMove(${state})`), 2);
});

test('audio recovery replaces a context that remains interrupted', async () => {
  const contexts = [];
  class AudioContext {
    constructor(options) { this.options = options; this.state = 'interrupted'; contexts.push(this); }
    async resume() { if (contexts.length > 1) this.state = 'running'; }
    async close() { this.state = 'closed'; }
  }
  const g = game({ AudioContext });
  g.elements.get('#soundToggle').checked = true;
  const recovered = await g.run('ensureAudioContext()');
  assert.equal(contexts.length, 2);
  assert.equal(contexts[0].state, 'closed');
  assert.equal(recovered.state, 'running');
  assert.equal(recovered.options.latencyHint, 'interactive');
});

function worker({ cached, network = async () => { throw Error('offline'); }, putThrows = false } = {}) {
  const handlers = {};
  const deleted = [], writes = [];
  const cache = { match: async request => cached?.(request), put: async (...args) => {
    if (putThrows) throw Error('quota'); writes.push(args);
  }, addAll: async () => {} };
  vm.runInNewContext(sw, { URL, Response, fetch: network,
    self: { registration: { scope: 'https://example.com/game/' },
      addEventListener: (name, fn) => { handlers[name] = fn; },
      clients: { claim: async () => {} }, skipWaiting: async () => {} },
    caches: { open: async () => cache, keys: async () => ['other-app', 'bippity-boop-v18', 'bippity-boop-v19'],
      delete: async key => { deleted.push(key); } }
  });
  return { handlers, deleted, writes, request(path, mode = 'cors') {
    let response;
    handlers.fetch({ request: { method: 'GET', url: new URL(path, 'https://example.com/game/').href, mode },
      respondWith(value) { response = value; } });
    return response;
  } };
}

test('service worker removes only old game caches', async () => {
  const w = worker(); let pending;
  w.handlers.activate({ waitUntil(value) { pending = value; } });
  await pending;
  assert.deepEqual(w.deleted, ['bippity-boop-v18']);
});

test('service worker ignores unrelated URLs and falls back to HTML only for navigation', async () => {
  const fallback = new Response('<html>offline</html>');
  const w = worker({ cached: request => request === './index.html' ? fallback : undefined });
  assert.equal(w.request('https://other.example/app.js'), undefined);
  assert.equal(w.request('unknown.png'), undefined);
  assert.equal(await w.request('./', 'navigate'), fallback);
  assert.equal((await w.request('styles.css')).type, 'error');
});

test('service worker neither caches HTTP errors nor loses responses on cache write failure', async () => {
  const error = new Response('missing', { status: 404 });
  const w = worker({ network: async () => error });
  assert.equal(await w.request('app.js'), error);
  assert.equal(w.writes.length, 0);
  const good = { ok: true, type: 'basic', clone() { return this; } };
  const failing = worker({ network: async () => good, putThrows: true });
  assert.equal(await failing.request('app.js'), good);
});

test('service worker serves cached assets offline and caches successful asset responses', async () => {
  const cached = new Response('cached javascript');
  const offline = worker({ cached: request => request.url?.endsWith('/app.js') ? cached : undefined });
  assert.equal(await offline.request('app.js'), cached);
  const response = { ok: true, type: 'basic', clone() { return this; } };
  const online = worker({ network: async () => response });
  assert.equal(await online.request('app.js'), response);
  assert.equal(online.writes.length, 1);
});
