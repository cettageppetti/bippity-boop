import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { eventTarget } from './events.mjs';
import * as engine from '../deploy/game-engine.mjs';
import * as profileAPI from '../deploy/profile.mjs';
import { createConfetti } from '../deploy/confetti.mjs';
import { setupPWA } from '../deploy/pwa.mjs';
import { createAudio } from '../deploy/audio.mjs';
import { createGameView } from '../deploy/ui.mjs';
import { app, sw, html } from './invariants.mjs';

function game({ appSource = app, confettiFactory = createConfetti, stored = null, learningStored = null, avatarStored = null, storage = new Map(), storageThrows = false, missingMeter = false, serviceWorker, location, AudioContext } = {}) {
  const timers = new Map();
  let nextTimer = 0;
  const documentEvents = eventTarget();
  const windowEvents = eventTarget();
  let focusedElement;
  const element = () => ({ attributes: {}, hidden: true, focus() { if (focusedElement) focusedElement.focused = false; this.focused = true; focusedElement = this; }, contains(target) { for (let node = target; node; node = node.parent) if (node === this) return true; return false; }, textContent: '', checked: false, disabled: false, style: {}, className: 'cell',
    classList: { add() {}, remove() {} }, ...eventTarget(),
    click() { if (this.disabled) return; const event = { target: this }; this.listeners.click?.(event); documentEvents.listeners.click?.(event); },
    getAttribute(key) { return this.attributes[key] || 'Center'; }, setAttribute(key, value) { this.attributes[key] = value; },
    getContext() { return { setTransform() {} }; } });
  const cells = Array.from({ length: 9 }, (_, index) => ({ ...element(), dataset: { cell: String(index) } }));
  const options = [...html.matchAll(/data-avatar="([^"]+)"/g)].map(([, emoji]) => ({ ...element(), dataset: { avatar: emoji } }));
  const elements = new Map();
  const context = vm.createContext({
    URL, engine, profileAPI, createConfetti: confettiFactory, setupPWA, createAudio, createGameView,
    document: { ...documentEvents, querySelectorAll: selector => selector === '.cell' ? cells : options, querySelector: id => {
      if (!html.includes(`id="${id.slice(1)}"`) || (missingMeter && id.startsWith('#brainpower'))) return null;
      if (!elements.has(id)) elements.set(id, element());
      return elements.get(id);
    } },
    window: { ...windowEvents, AudioContext, location, innerWidth: 400, innerHeight: 800,
      setTimeout(fn) { timers.set(++nextTimer, fn); return nextTimer; },
      clearTimeout(id) { timers.delete(id); } },
    navigator: serviceWorker ? { serviceWorker } : {}, innerWidth: 400, innerHeight: 800,
    localStorage: { getItem(key) { if (storageThrows) throw Error('unavailable'); return storage.has(key) ? storage.get(key) : key === 'bippity-boop-learning' ? learningStored : key === 'bippity-boop-avatar' ? avatarStored : stored; },
      setItem(key, value) { if (storageThrows) throw Error('unavailable'); storage.set(key, value); } },
    matchMedia: () => ({ matches: true })
  });
  vm.runInContext(appSource.replace(/^(?:import .*?;\n)+/, 'const { HUMAN, COMPUTER, LEARNING, learningLevel, earnedLearning, getResult, emptySquares, createBot } = engine;\nconst { findAvatar, createProfileStore } = profileAPI;\n'), context);
  options.forEach(option => { option.parent = elements.get('#avatarPicker'); });
  return { run: code => vm.runInContext(code, context), elements, cells, options, documentListeners: documentEvents.listeners, windowListeners: windowEvents.listeners, timers, storage };
}

for (const reset of ['startNewRound()', "resetScoreButton.listeners.click()"] ) {
  test(`${reset} cancels a pending bot turn`, () => {
    const g = game();
    g.run('humanMove(0)');
    const timer = g.run('round.computerMoveTimer');
    assert.ok(g.timers.has(timer));
    g.run(reset);
    assert.equal(g.timers.has(timer), false);
    g.run('computerMove()');
    assert.equal(g.run('round.board.every(value => !value)'), true);
    g.run('humanMove(4)');
    const newTimer = g.run('round.computerMoveTimer');
    g.timers.get(newTimer)();
    assert.equal(g.run("round.board.filter(value => value === COMPUTER).length"), 1);
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

test('audio recovery replaces a context that remains interrupted', async () => {
  const contexts = [];
  class AudioContext {
    constructor(options) { this.options = options; this.state = 'interrupted'; contexts.push(this); }
    async resume() { if (contexts.length > 1) this.state = 'running'; }
    async close() { this.state = 'closed'; }
  }
  const g = game({ AudioContext });
  g.elements.get('#soundToggle').checked = true;
  const recovered = await g.run('audio.ensureContext()');
  assert.equal(contexts.length, 2);
  assert.equal(contexts[0].state, 'closed');
  assert.equal(recovered.state, 'running');
  assert.equal(recovered.options.latencyHint, 'interactive');
});

function worker({ cached, network = async () => { throw Error('offline'); }, putThrows = false, scope = 'https://example.com/game/' } = {}) {
  const handlers = {};
  const deleted = [], writes = [];
  const cache = { match: async request => cached?.(request), put: async (...args) => {
    if (putThrows) throw Error('quota'); writes.push(args);
  }, addAll: async () => {} };
  vm.runInNewContext(sw, { URL, Response, fetch: network,
    self: { registration: { scope },
      addEventListener: (name, fn) => { handlers[name] = fn; },
      clients: { claim: async () => {} }, skipWaiting: async () => {} },
    caches: { open: async () => cache, keys: async () => ['other-app', 'bippity-boop-v18', 'bippity-boop-v33'],
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

test('learning rewards outcomes once, persists, and updates the meter', () => {
  const storage = new Map();
  const g = game({ storage });
  for (const [result, total] of [
    ["{ type: 'win', player: HUMAN, line: [0,1,2] }", 1],
    ["{ type: 'draw' }", 1.5],
    ["{ type: 'win', player: COMPUTER, line: [0,1,2] }", 1.75]
  ]) {
    g.run(`finishRound(${result}); finishRound(${result})`);
    assert.equal(g.run('learningPoints'), total);
    g.run('startNewRound()');
  }
  assert.equal(storage.get('bippity-boop-learning'), '1.75');
  assert.equal(game({ storage }).run('learningPoints'), 1.75);
  assert.equal(g.elements.get('#brainpowerValue').textContent, '3%');
});

test('learning caps at maximum and the active game keeps its starting level', () => {
  const g = game({ learningStored: '55.75' });
  assert.equal(g.run('round.learningLevel'), 13);
  g.run("finishRound({ type: 'draw' })");
  assert.equal(g.run('learningPoints'), 56);
  assert.equal(g.run('round.learningLevel'), 13);
  assert.equal(g.elements.get('#brainpowerValue').textContent, '100%');
  g.run('startNewRound()');
  assert.equal(g.run('round.learningLevel'), 14);
  assert.match(g.elements.get('#brainpowerFlavor').textContent, /maximum boop/);
});

test('invalid stored learning starts at zero; excessive learning is capped', () => {
  for (const learningStored of ['null', '"20"', '-1', '{}', 'true', '1e400', '{bad']) {
    assert.equal(game({ learningStored }).run('learningPoints'), 0);
  }
  assert.equal(game({ learningStored: '200' }).run('learningPoints'), 56);
});

test('Bonk clears scores, learning, board and meter persistently while preserving Sound', () => {
  const g = game({ learningStored: '30', stored: '{"human":5,"computer":3,"draws":2}' });
  g.elements.get('#soundToggle').checked = true;
  g.run('humanMove(0); resetScoreButton.listeners.click()');
  assert.equal(g.run('learningPoints'), 0);
  assert.equal(g.run('round.learningLevel'), 0);
  assert.equal(g.run('score.human + score.computer + score.draws'), 0);
  assert.equal(g.run('round.board.every(value => !value)'), true);
  assert.equal(g.elements.get('#brainpowerValue').textContent, '0%');
  assert.equal(g.elements.get('#soundToggle').checked, true);
  assert.match(g.elements.get('#status').textContent, /BONK!/);
  assert.equal(game({ storage: g.storage }).run('learningPoints'), 0);
});

test('New game preserves learning and scores, including when storage is unavailable', () => {
  const g = game({ storageThrows: true });
  g.run("finishRound({ type: 'draw' }); startNewRound()");
  assert.equal(g.run('learningPoints'), 0.5);
  assert.equal(g.run('score.draws'), 1);
  g.run('resetScoreButton.listeners.click()');
  assert.equal(g.run('learningPoints'), 0);
});

test('old cached HTML without the meter still attaches playable tile handlers', () => {
  const g = game({ missingMeter: true });
  g.cells[0].listeners.click();
  assert.equal(g.run('round.board[0]'), 'X');
  g.timers.get(g.run('round.computerMoveTimer'))();
  assert.equal(g.run("round.board.filter(value => value === 'O').length"), 1);
  assert.equal(g.run('round.computerThinking'), false);
});

test('localhost workers bypass cached responses', () => {
  for (const host of ['localhost', '127.0.0.1', '[::1]']) {
    const w = worker({ scope: `http://${host}:8080/` });
    assert.equal(w.request('app.js'), undefined);
  }
});

test('local preview unregisters only its own worker and reloads once to release it', async () => {
  const scriptURL = 'http://localhost:8080/service-worker.js';
  let unregistered = 0, reloads = 0;
  const serviceWorker = {
    controller: { scriptURL },
    async getRegistrations() { return [
      { active: { scriptURL }, async unregister() { unregistered++; return true; } },
      { active: { scriptURL: 'http://localhost:8080/other/worker.js' }, async unregister() { throw Error('unrelated worker'); } }
    ]; },
    async register() { throw Error('must not register locally'); }
  };
  const g = game({ serviceWorker, location: { hostname: 'localhost', href: 'http://localhost:8080/', reload() { reloads++; } } });
  await g.run('pwa.configureServiceWorker()');
  assert.equal(unregistered, 1);
  assert.equal(reloads, 1);
  serviceWorker.getRegistrations = async () => [];
  await g.run('pwa.configureServiceWorker()');
  assert.equal(reloads, 1);
});

test('production still registers its offline worker', async () => {
  let registered;
  const g = game({ serviceWorker: { async register(url) { registered = url; } }, location: { hostname: 'game.example' } });
  await g.run('pwa.configureServiceWorker()');
  assert.equal(registered, './service-worker.js');
});

test('all avatar choices update the score card, subtitle, current pieces and future moves', () => {
  const g = game();
  g.run('placePiece(0, HUMAN); placePiece(1, COMPUTER)');
  for (const [emoji, name] of [['🦄','unicorn'],['🐲','dragon'],['🐱','cat'],['🦊','fox'],['🐸','frog'],['👻','ghost'],['👽','alien'],['🐙','octopus']]) {
    g.run(`selectAvatar('${emoji}')`);
    assert.equal(g.elements.get('#playerAvatar').textContent, emoji);
    assert.equal(g.elements.get('#subtitleAvatar').textContent, `${emoji} ${name}`);
    assert.equal(g.cells[0].textContent, emoji);
    assert.equal(g.cells[0].attributes['aria-label'], `Top left, ${name}`);
    assert.equal(g.cells[1].textContent, '🤖');
    assert.equal(g.options.filter(option => option.attributes['aria-pressed'] === 'true').length, 1);
    assert.equal(g.storage.get('bippity-boop-avatar'), emoji);
  }
  g.run('placePiece(2, HUMAN)');
  assert.equal(g.cells[2].textContent, '🐙');
  assert.equal(g.run('round.board[0]'), 'X');
  assert.equal(g.run('round.board[1]'), 'O');
});

test('avatar picker opens from the score card, focuses selection and closes on selection or Escape', () => {
  const g = game();
  const trigger = g.elements.get('#avatarButton');
  const picker = g.elements.get('#avatarPicker');
  trigger.listeners.click();
  assert.equal(picker.hidden, false);
  assert.equal(trigger.attributes['aria-expanded'], 'true');
  assert.equal(g.options[0].focused, true);
  g.options[3].listeners.click();
  assert.equal(g.run('selectedAvatar.emoji'), '🦊');
  assert.equal(picker.hidden, true);
  assert.equal(trigger.focused, true);
  trigger.listeners.click();
  g.documentListeners.keydown({ key: 'Escape' });
  assert.equal(picker.hidden, true);
  assert.equal(trigger.attributes['aria-expanded'], 'false');
  trigger.listeners.click();
  g.documentListeners.click({ target: {} });
  assert.equal(picker.hidden, true);
});

test('avatar survives reloads, New game and Bonk without changing learning or scores on selection', () => {
  const g = game({ learningStored: '16', stored: '{"human":3,"computer":2,"draws":1}' });
  g.run("selectAvatar('🐸')");
  assert.equal(g.run('learningPoints'), 16);
  assert.equal(g.run('score.human'), 3);
  const reloaded = game({ storage: g.storage });
  assert.equal(reloaded.elements.get('#subtitleAvatar').textContent, '🐸 frog');
  g.run('startNewRound(); resetScoreButton.listeners.click()');
  assert.equal(g.run('selectedAvatar.emoji'), '🐸');
  assert.equal(game({ storage: g.storage }).run('selectedAvatar.emoji'), '🐸');
});

test('invalid or unavailable avatar storage defaults safely and selection works without storage', () => {
  for (const avatarStored of [null, 'X', '🤖', '{}', '<script>']) {
    assert.equal(game({ avatarStored }).run('selectedAvatar.emoji'), '🦄');
  }
  const g = game({ storageThrows: true });
  g.run("selectAvatar('👻'); selectAvatar('invalid')");
  assert.equal(g.run('selectedAvatar.emoji'), '👻');
});

test('victory messages follow the selected avatar, including changes after a win', () => {
  const g = game();
  g.run("selectAvatar('🐲'); finishRound({ type: 'win', player: HUMAN, line: [0,1,2] })");
  assert.match(g.elements.get('#status').textContent, /🐲 dragon wins/);
  g.run("selectAvatar('👽')");
  assert.match(g.elements.get('#status').textContent, /👽 alien wins/);
  assert.equal(g.run('score.human'), 1);
  assert.equal(g.run('learningPoints'), 1);
});

test('score-card clicks bubble without immediately closing the avatar picker', () => {
  const g = game();
  const trigger = g.elements.get('#avatarButton');
  const picker = g.elements.get('#avatarPicker');
  trigger.click();
  assert.equal(picker.hidden, false);
  g.documentListeners.click({ target: g.options[0] });
  assert.equal(picker.hidden, false);
  g.options[2].click();
  assert.equal(picker.hidden, true);
  assert.equal(g.elements.get('#playerAvatar').textContent, '🐱');
  assert.equal(trigger.focused, true);
});

test('round reset replaces every transient field while preserving persistent state', () => {
  const g = game({ learningStored: '20', avatarStored: '🐸' });
  g.run("round.over = true; round.winner = HUMAN; round.computerThinking = true; round.board[0] = HUMAN; startNewRound()");
  assert.equal(g.run('JSON.stringify(round)'), JSON.stringify({ board: Array(9).fill(''), over: false, winner: null, computerThinking: false, computerMoveTimer: null, learningLevel: 5 }));
  assert.equal(g.run('learningPoints'), 20);
  assert.equal(g.run('selectedAvatar.emoji'), '🐸');
});

test('shared rendering keeps player label score and avatar synchronized', () => {
  const g = game();
  g.run("finishRound({ type: 'draw' }); startNewRound(); selectAvatar('🐱'); finishRound({ type: 'win', player: HUMAN, line: [0,1,2] })");
  assert.equal(g.elements.get('#avatarButton').attributes['aria-label'], 'You, cat, 1 wins. Change avatar');
});

test('event harness retains multiple listeners and removes once handlers', () => {
  const target = eventTarget();
  const calls = [];
  target.addEventListener('click', () => calls.push('first'));
  target.addEventListener('click', () => calls.push('once'), { once: true });
  target.listeners.click({}); target.listeners.click({});
  assert.deepEqual(calls, ['first', 'once', 'first']);
});

test('registered lifecycle handlers discard stale audio contexts', async () => {
  class AudioContext {
    constructor() { this.state = 'running'; }
    async close() { this.state = 'closed'; }
  }
  const g = game({ AudioContext });
  g.elements.get('#soundToggle').checked = true;
  for (const event of ['hidden', 'pagehide', 'pageshow']) {
    const context = await g.run('audio.ensureContext()');
    if (event === 'hidden') {
      g.run("document.visibilityState = 'hidden'");
      g.documentListeners.visibilitychange({});
    } else {
      g.windowListeners[event]({});
    }
    assert.equal(context.state, 'closed');
    if (event === 'hidden') assert.equal(await g.run('audio.ensureContext()'), null);
    g.run("document.visibilityState = 'visible'");
  }
});

function celebrationChecks(appSource = app) {
  for (const [result, expected] of [
    ["{ type: 'win', player: HUMAN, line: [0,1,2] }", 1],
    ["{ type: 'win', player: COMPUTER, line: [0,1,2] }", 0],
    ["{ type: 'draw' }", 0]
  ]) {
    let bursts = 0;
    const g = game({ appSource, confettiFactory: () => ({ resize() {}, launch() { bursts++; } }) });
    g.run(`finishRound(${result})`);
    assert.equal(bursts, expected);
  }
}

test('human wins alone trigger a confetti celebration', () => celebrationChecks());

test('behavior tests kill a missing human celebration', () => {
  const changed = app.replace('confetti.launch();', 'void 0;');
  assert.notEqual(changed, app);
  assert.throws(() => celebrationChecks(changed), assert.AssertionError);
});

test('behavior tests kill confetti triggered for bot wins', () => {
  const changed = app.replace('score.computer += 1;', 'score.computer += 1; launchConfetti();');
  assert.notEqual(changed, app);
  assert.throws(() => celebrationChecks(changed), assert.AssertionError);
});
