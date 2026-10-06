import { LEARNING } from './game-engine.mjs';

export const AVATARS = Object.freeze([
  { emoji: '🦄', name: 'unicorn' }, { emoji: '🐲', name: 'dragon' },
  { emoji: '🐱', name: 'cat' }, { emoji: '🦊', name: 'fox' },
  { emoji: '🐸', name: 'frog' }, { emoji: '👻', name: 'ghost' },
  { emoji: '👽', name: 'alien' }, { emoji: '🐙', name: 'octopus' }
].map(avatar => Object.freeze(avatar)));

export function findAvatar(emoji) {
  return AVATARS.find(avatar => avatar.emoji === emoji);
}

const KEYS = Object.freeze({
  score: 'bippity-boop-score', learning: 'bippity-boop-learning', avatar: 'bippity-boop-avatar'
});

// Resolve storage inside each try block: access itself can throw in browsers.
export function createProfileStore(getStorage) {
  function read(key, decode = JSON.parse) {
    try { return decode(getStorage().getItem(key)); } catch { return null; }
  }
  function write(key, value, encode = JSON.stringify) {
    try { getStorage().setItem(key, encode(value)); } catch {
      // The controller keeps its current session state when storage is unavailable.
    }
  }
  return {
    loadScore() {
      const stored = read(KEYS.score);
      return Object.fromEntries(['human', 'computer', 'draws'].map(key => [
        key, Number.isSafeInteger(stored?.[key]) && stored[key] >= 0 ? stored[key] : 0
      ]));
    },
    saveScore(score) { write(KEYS.score, score); },
    loadLearning() {
      const value = read(KEYS.learning);
      return typeof value === 'number' && Number.isFinite(value) && value >= 0
        ? Math.min(LEARNING.maxPoints, value) : 0;
    },
    saveLearning(points) { write(KEYS.learning, points); },
    loadAvatar() {
      return findAvatar(read(KEYS.avatar, value => value)) || AVATARS[0];
    },
    saveAvatar(avatar) { write(KEYS.avatar, avatar.emoji, value => value); }
  };
}
