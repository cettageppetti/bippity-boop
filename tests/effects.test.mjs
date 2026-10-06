import test from 'node:test';
import assert from 'node:assert/strict';
import { createConfetti } from '../deploy/confetti.mjs';
import { setupPWA } from '../deploy/pwa.mjs';
import { eventTarget } from './events.mjs';

function confettiFixture(reduced = false) {
  const frames = new Map(), cancelled = [], transforms = [];
  let nextFrame = 0, painted = 0, cleared = 0;
  const ctx = {
    setTransform: (...args) => transforms.push(args),
    clearRect() { cleared++; }, fillRect() { painted++; },
    save() {}, restore() {}, translate() {}, rotate() {}
  };
  const canvas = { style: {}, getContext: () => ctx };
  const viewport = { innerWidth: 400, innerHeight: 800, devicePixelRatio: 3 };
  const effect = createConfetti(canvas, {
    viewport, random: () => 0.5, reducedMotion: () => reduced,
    requestFrame(callback) { frames.set(++nextFrame, callback); return nextFrame; },
    cancelFrame(frame) { cancelled.push(frame); frames.delete(frame); }
  });
  return { effect, canvas, viewport, frames, cancelled, transforms, get painted() { return painted; }, get cleared() { return cleared; } };
}

test('confetti canvas scales with viewport and caps pixel density', () => {
  const f = confettiFixture();
  f.effect.resize();
  assert.equal(f.canvas.width, 800);
  assert.equal(f.canvas.height, 1600);
  assert.equal(f.canvas.style.width, '400px');
  assert.deepEqual(f.transforms[0], [2,0,0,2,0,0]);
  f.viewport.innerWidth = 300;
  f.viewport.devicePixelRatio = 0.5;
  f.effect.resize();
  assert.equal(f.canvas.width, 300);
  assert.deepEqual(f.transforms[1], [1,0,0,1,0,0]);
});

test('reduced motion suppresses confetti rendering and animation scheduling', () => {
  const f = confettiFixture(true);
  f.effect.launch();
  assert.equal(f.painted, 0);
  assert.equal(f.frames.size, 0);
  assert.equal(f.cancelled.length, 0);
});

test('confetti replaces its active animation and eventually clears the canvas', () => {
  const f = confettiFixture();
  f.effect.launch();
  assert.equal(f.painted, 170);
  const previous = [...f.frames.keys()][0];
  f.effect.launch();
  assert.ok(f.cancelled.includes(previous));
  assert.equal(f.frames.size, 1);
  let iterations = 0;
  while (f.frames.size && iterations++ < 200) {
    const [id, callback] = [...f.frames][0];
    f.frames.delete(id); callback();
  }
  assert.equal(f.frames.size, 0);
  assert.ok(f.cleared > 1);
});

function pwaFixture(navigator = {}) {
  const window = { ...eventTarget(), location: { hostname: 'game.example' } };
  const button = { ...eventTarget(), hidden: true };
  const pwa = setupPWA({ window, navigator, installButton: button });
  return { window, button, pwa };
}

test('install control is exposed for a prompt and hidden after accepted or declined choices', async () => {
  for (const outcome of ['accepted', 'dismissed']) {
    const f = pwaFixture();
    let prevented = 0, prompted = 0;
    f.window.listeners.beforeinstallprompt({
      preventDefault() { prevented++; }, prompt() { prompted++; },
      userChoice: Promise.resolve({ outcome })
    });
    assert.equal(prevented, 1);
    assert.equal(f.button.hidden, false);
    await f.button.listeners.click({});
    // Event dispatch does not await listeners, so let userChoice resolve.
    await Promise.resolve();
    assert.equal(prompted, 1);
    assert.equal(f.button.hidden, true);
    f.button.listeners.click({});
    assert.equal(prompted, 1);
  }
});

test('appinstalled discards an outstanding install prompt', () => {
  const f = pwaFixture();
  let prompted = false;
  f.window.listeners.beforeinstallprompt({ preventDefault() {}, prompt() { prompted = true; } });
  f.window.listeners.appinstalled({});
  f.button.listeners.click({});
  assert.equal(f.button.hidden, true);
  assert.equal(prompted, false);
});

test('unsupported or failed worker registration leaves PWA setup usable', async () => {
  await pwaFixture().pwa.configureServiceWorker();
  let attempted = 0;
  const f = pwaFixture({ serviceWorker: { async register() { attempted++; throw Error('offline'); } } });
  await assert.doesNotReject(() => f.pwa.configureServiceWorker());
  assert.equal(attempted, 1);
  assert.ok(f.window.listeners.load);
});
