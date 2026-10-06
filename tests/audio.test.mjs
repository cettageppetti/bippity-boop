import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudio } from '../deploy/audio.mjs';
import { COMPUTER, HUMAN } from '../deploy/game-engine.mjs';
import { eventTarget } from './events.mjs';

function fixture({ checked = true, random = () => 0.5, AudioContextCtor } = {}) {
  const contexts = [], oscillators = [], gains = [], timers = [];
  const parameter = () => ({ calls: [], setValueAtTime(...args) { this.calls.push(['set', ...args]); },
    exponentialRampToValueAtTime(...args) { this.calls.push(['ramp', ...args]); } });
  class AudioContext {
    constructor(options) { this.options = options; this.state = 'running'; this.currentTime = 2; contexts.push(this); }
    async close() { this.state = 'closed'; }
    createOscillator() {
      const node = { ...eventTarget(), frequency: parameter(), connect() {}, disconnect() { this.disconnected = true; },
        start(time) { this.started = time; }, stop(time) { this.stopped = time; } };
      oscillators.push(node); return node;
    }
    createGain() {
      const node = { gain: parameter(), connect() {}, disconnect() { this.disconnected = true; } };
      gains.push(node); return node;
    }
  }
  const document = eventTarget();
  const window = { ...eventTarget(), AudioContext: AudioContextCtor || AudioContext,
    setTimeout(callback, delay) { timers.push({ callback, delay }); return timers.length; }, clearTimeout(id) { if (timers[id - 1]) timers[id - 1].cancelled = true; } };
  const soundToggle = { ...eventTarget(), checked };
  const audio = createAudio({ window, document, soundToggle, random });
  return { AudioContext, audio, contexts, oscillators, gains, timers, window, document, soundToggle };
}

test('tone envelopes are scheduled immediately and finished nodes disconnect once', async () => {
  const f = fixture();
  await f.audio.playTone({ frequency: 440, duration: 0.13, slideTo: 396 });
  assert.equal(f.contexts[0].options.latencyHint, 'interactive');
  const oscillator = f.oscillators[0];
  assert.deepEqual(oscillator.frequency.calls, [['set',440,2], ['ramp',396,2.13]]);
  assert.equal(oscillator.started, 2);
  assert.equal(oscillator.stopped, 2.165);
  assert.equal(f.gains[0].gain.calls[0][1], 0.0001);
  oscillator.listeners.ended({});
  assert.equal(oscillator.disconnected, true);
  assert.equal(f.gains[0].disconnected, true);
});

test('move tones preserve boop range, mild pitch slide and bot frequency multiplier', async () => {
  const f = fixture({ random: () => 0 });
  f.audio.playMove(HUMAN);
  await Promise.resolve();
  assert.equal(f.oscillators[0].type, 'sine');
  assert.deepEqual(f.oscillators[0].frequency.calls, [['set',320,2], ['ramp',288,2.13]]);
  f.audio.playMove(COMPUTER);
  await Promise.resolve();
  assert.equal(f.oscillators[1].frequency.calls[0][1], 288);
  const bip = fixture({ random: () => 0.9 });
  bip.audio.playMove(HUMAN);
  await Promise.resolve();
  assert.equal(bip.oscillators[0].type, 'triangle');
  assert.equal(bip.oscillators[0].frequency.calls[0][1], 960);
});

test('Sound off prevents context creation and toggling off closes an existing context', async () => {
  const f = fixture({ checked: false });
  await f.audio.playTone({ frequency: 440 });
  f.audio.playMove(HUMAN);
  assert.equal(f.contexts.length, 0);
  f.soundToggle.checked = true;
  const context = await f.audio.ensureContext();
  f.soundToggle.checked = false;
  f.soundToggle.listeners.change({});
  assert.equal(context.state, 'closed');
});

test('context constructor fallback and unavailable Web Audio fail gracefully', async () => {
  let attempts = 0;
  class LegacyContext {
    constructor(options) { attempts++; if (options) throw Error('unsupported options'); this.state = 'running'; }
  }
  const legacy = fixture({ AudioContextCtor: LegacyContext });
  assert.equal((await legacy.audio.ensureContext()).state, 'running');
  assert.equal(attempts, 2);
  const missing = fixture();
  delete missing.window.AudioContext;
  assert.equal(await missing.audio.ensureContext(), null);
});

test('jingles retain their timing and note counts on the audio clock', async () => {
  for (const [method, offsets] of [['victory', [0,.09,.18,.27]], ['defeat', [0,.11,.22]], ['draw', [0,.085,.17]]]) {
    const f = fixture();
    f.audio[method]();
    await Promise.resolve();
    assert.deepEqual(f.oscillators.map(node => node.started), offsets.map(offset => 2 + offset));
    assert.equal(f.timers.length, 0);
    f.audio.cancel();
    assert.ok(f.oscillators.every(node => node.disconnected));
    assert.ok(f.gains.every(node => node.disconnected));
  }
});

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };

function suspendedFixture() {
  const f = fixture();
  const pending = deferred();
  let resumes = 0;
  class Suspended extends f.AudioContext {
    constructor(options) { super(options); this.state = 'suspended'; }
    resume() { resumes++; return pending.promise.then(() => { this.state = 'running'; }); }
  }
  f.window.AudioContext = Suspended;
  return { ...f, pending, resumes: () => resumes };
}

test('overlapping gesture and playback requests share one resume', async () => {
  const f = suspendedFixture();
  f.document.listeners.pointerdown({});
  f.document.listeners.touchstart({});
  const played = f.audio.playTone({ frequency: 440 });
  assert.equal(f.resumes(), 1);
  assert.equal(f.contexts.length, 1);
  f.pending.resolve();
  await played;
  assert.equal(f.oscillators.length, 1);
});

test('mute, background and cancellation invalidate pending playback', async () => {
  for (const action of ['mute', 'hidden', 'pagehide', 'cancel']) {
    const f = suspendedFixture();
    const played = f.audio.playTone({ frequency: 440 });
    if (action === 'mute') { f.soundToggle.checked = false; f.soundToggle.listeners.change({}); }
    if (action === 'hidden') { f.document.visibilityState = 'hidden'; f.document.listeners.visibilitychange({}); }
    if (action === 'pagehide') f.window.listeners.pagehide({});
    if (action === 'cancel') f.audio.cancel();
    f.pending.resolve();
    await played;
    assert.equal(f.oscillators.length, 0, action);
  }
});

test('a stalled resume times out, disposes its context and permits a later gesture', async () => {
  const f = suspendedFixture();
  const recovery = f.audio.ensureContext();
  f.timers[0].callback();
  await flush();
  assert.equal(f.contexts.length, 2);
  f.timers[1].callback();
  assert.equal(await recovery, null);
  assert.ok(f.contexts.every(context => context.state === 'closed'));
  f.window.AudioContext = f.AudioContext;
  const fresh = await f.audio.ensureContext();
  f.pending.resolve();
  await flush();
  assert.equal(await f.audio.ensureContext(), fresh);
});

test('late resume does not play an outdated move', async () => {
  const f = suspendedFixture();
  const originalNow = Date.now;
  let now = 100;
  Date.now = () => now;
  try {
    const played = f.audio.playTone({ frequency: 440 });
    now += 300;
    f.pending.resolve();
    await played;
    assert.equal(f.oscillators.length, 0);
  } finally { Date.now = originalNow; }
});

test('partial node construction and scheduling failures clean up without rejecting', async () => {
  for (const failure of ['createGain', 'start']) {
    const f = fixture();
    const context = await f.audio.ensureContext();
    if (failure === 'createGain') context.createGain = () => { throw Error('interrupted'); };
    else {
      const create = context.createOscillator.bind(context);
      context.createOscillator = () => { const node = create(); node.start = () => { throw Error('closed'); }; return node; };
    }
    await assert.doesNotReject(f.audio.playTone({ frequency: 440 }));
    assert.ok(f.oscillators.every(node => node.disconnected));
    assert.ok(f.gains.every(node => node.disconnected));
  }
});

test('old recovery cannot replace the context created after a lifecycle reset', async () => {
  const f = suspendedFixture();
  const oldRecovery = f.audio.ensureContext();
  await f.audio.reset();
  f.window.AudioContext = f.AudioContext;
  const fresh = await f.audio.ensureContext();
  f.pending.resolve();
  assert.equal(await oldRecovery, null);
  assert.equal(await f.audio.ensureContext(), fresh);
  assert.equal(fresh.state, 'running');
});
