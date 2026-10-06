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
    setTimeout(callback, delay) { timers.push({ callback, delay }); } };
  const soundToggle = { ...eventTarget(), checked };
  const audio = createAudio({ window, document, soundToggle, random });
  return { audio, contexts, oscillators, gains, timers, window, document, soundToggle };
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

test('jingles retain their timing and note counts', () => {
  const f = fixture();
  f.audio.victory();
  assert.deepEqual(f.timers.map(timer => timer.delay), [0,90,180,270]);
  f.timers.length = 0;
  f.audio.defeat();
  assert.deepEqual(f.timers.map(timer => timer.delay), [0,110,220]);
  f.timers.length = 0;
  f.audio.draw();
  assert.deepEqual(f.timers.map(timer => timer.delay), [0,85,170]);
});
