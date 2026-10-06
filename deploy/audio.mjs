import { COMPUTER } from './game-engine.mjs';

export function createAudio({ window, document, soundToggle, random }) {
  let audioContext = null;
  function randomChoice(items) { return items[Math.floor(random() * items.length)]; }
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

  let recovery = null;
  let generation = 0;
  const activeNodes = new Set();
  const enabled = () => soundToggle.checked && document.visibilityState !== 'hidden';

  async function resumeContext(context) {
    let timer;
    try {
      // A blocked resume promise can remain pending indefinitely on WebKit.
      return await Promise.race([
        Promise.resolve(context.resume()).then(() => context.state === 'running', () => false),
        new Promise(resolve => { timer = window.setTimeout(() => resolve(false), 1000); })
      ]);
    } catch {
      return false;
    } finally {
      window.clearTimeout(timer);
    }
  }

  async function ensureAudioContext() {
    if (!enabled()) return null;
    if (recovery) return recovery;
    if (!audioContext || audioContext.state === 'closed') audioContext = createAudioContext();
    if (!audioContext) return null;
    if (audioContext.state === 'running') return audioContext;

    const version = generation;
    const initialContext = audioContext;
    const attempt = async () => {
      let context = initialContext;
      for (let tries = 0; tries < 2; tries++) {
        const running = await resumeContext(context);
        if (version !== generation || !enabled()) return null;
        if (running) return context;
        audioContext = null;
        void closeContext(context);
        if (tries === 0) {
          context = createAudioContext();
          audioContext = context;
          if (!context) return null;
        }
      }
      return null;
    };
    const pending = attempt();
    recovery = pending;
    try { return await pending; }
    finally { if (recovery === pending) recovery = null; }
  }

  async function closeContext(context) {
    if (!context || context.state === 'closed') return;
    try { await context.close(); } catch {
      // Dropping the reference also handles contexts whose close() rejects.
    }
  }

  function cancelSounds() {
    generation++;
    for (const cancel of [...activeNodes]) cancel();
  }

  async function resetAudioContext() {
    cancelSounds();
    const oldContext = audioContext;
    audioContext = null;
    recovery = null;
    await closeContext(oldContext);
  }

  function unlockAudioFromUserGesture() {
    if (!soundToggle.checked) return;
    void ensureAudioContext();
  }

  function scheduleTone(context, { frequency, duration = 0.09, type = 'sine', gain = 0.12, slideTo = null }, offset = 0) {
    let oscillator, gainNode;
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      activeNodes.delete(cancel);
      try { oscillator?.disconnect(); } catch {}
      try { gainNode?.disconnect(); } catch {}
    };
    const cancel = () => {
      try { oscillator?.stop(); } catch {}
      cleanup();
    };
    try {
      oscillator = context.createOscillator();
      gainNode = context.createGain();
      const now = context.currentTime + offset;
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
      oscillator.addEventListener('ended', cleanup, { once: true });
      activeNodes.add(cancel);
      oscillator.start(now);
      oscillator.stop(stopAt);
    } catch {
      cancel();
    }
  }

  async function playSequence(notes) {
    if (!enabled()) return;
    const version = generation;
    const requestedAt = Date.now();
    const context = await ensureAudioContext();
    // Drop delayed requests rather than playing a previous move's sound later.
    if (!context || !enabled() || version !== generation || context !== audioContext || Date.now() - requestedAt > 250) return;
    for (const { offset = 0, ...tone } of notes) scheduleTone(context, tone, offset);
  }

  async function playTone(tone) { await playSequence([tone]); }

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
    const isBip = random() > 0.5;
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
    void playSequence([523, 659, 784, 1047].map((frequency, i) => ({ frequency, duration: .13, gain: .08, offset: i * .09 })));
  }
  function defeatJingle() {
    void playSequence([330, 277, 220].map((frequency, i) => ({ frequency, duration: .16, type: 'triangle', gain: .07, offset: i * .11 })));
  }
  function drawJingle() {
    void playSequence([440, 523, 440].map((frequency, i) => ({ frequency, duration: .1, gain: .06, offset: i * .085 })));
  }

  return { ensureContext: ensureAudioContext, reset: resetAudioContext, cancel: cancelSounds, playTone, playMove: playBipBoop, victory: victoryJingle, defeat: defeatJingle, draw: drawJingle };
}
