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
    [523, 659, 784, 1047].forEach((f, i) => window.setTimeout(() => void playTone({ frequency: f, duration: .13, gain: .08 }), i * 90));
  }
  function defeatJingle() {
    [330, 277, 220].forEach((f, i) => window.setTimeout(() => void playTone({ frequency: f, duration: .16, type: 'triangle', gain: .07 }), i * 110));
  }
  function drawJingle() {
    [440, 523, 440].forEach((f, i) => window.setTimeout(() => void playTone({ frequency: f, duration: .1, gain: .06 }), i * 85));
  }

  return { ensureContext: ensureAudioContext, reset: resetAudioContext, playTone, playMove: playBipBoop, victory: victoryJingle, defeat: defeatJingle, draw: drawJingle };
}
