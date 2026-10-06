import test from 'node:test';
import assert from 'node:assert/strict';
import { AVATARS, findAvatar, createProfileStore } from '../deploy/profile.mjs';
import { html, sw } from './invariants.mjs';

function fixture(entries = []) {
  const values = new Map(entries);
  return { values, store: createProfileStore(() => ({
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value)
  })) };
}

test('profile reads existing score, learning and raw emoji formats', () => {
  const { store } = fixture([
    ['bippity-boop-score', '{"human":4,"computer":2,"draws":1}'],
    ['bippity-boop-learning', '12.5'], ['bippity-boop-avatar', '🐙']
  ]);
  assert.deepEqual(store.loadScore(), { human: 4, computer: 2, draws: 1 });
  assert.equal(store.loadLearning(), 12.5);
  assert.equal(store.loadAvatar().name, 'octopus');
});

test('profile writes exactly the established keys and encodings', () => {
  const { store, values } = fixture();
  store.saveScore({ human: 2, computer: 1, draws: 3 });
  store.saveLearning(8.25);
  store.saveAvatar(findAvatar('👻'));
  assert.deepEqual([...values], [
    ['bippity-boop-score', '{"human":2,"computer":1,"draws":3}'],
    ['bippity-boop-learning', '8.25'], ['bippity-boop-avatar', '👻']
  ]);
});

test('profile validation preserves valid fields and rejects invalid values', () => {
  const { store, values } = fixture([['bippity-boop-score', '{"human":3,"computer":-2,"draws":"1"}']]);
  assert.deepEqual(store.loadScore(), { human: 3, computer: 0, draws: 0 });
  values.set('bippity-boop-score', 'broken JSON');
  assert.deepEqual(store.loadScore(), { human: 0, computer: 0, draws: 0 });
  for (const value of ['"12"', '-1', 'null', '{}', '1e400', 'broken']) {
    values.set('bippity-boop-learning', value);
    assert.equal(store.loadLearning(), 0);
  }
  values.set('bippity-boop-learning', '999');
  assert.equal(store.loadLearning(), 56);
  values.set('bippity-boop-avatar', '🤖');
  assert.equal(store.loadAvatar().emoji, '🦄');
});

test('both inaccessible storage and failing operations safely fall back', () => {
  for (const getStorage of [
    () => { throw Error('access denied'); },
    () => ({ getItem() { throw Error('read denied'); }, setItem() { throw Error('quota'); } })
  ]) {
    const store = createProfileStore(getStorage);
    assert.deepEqual(store.loadScore(), { human: 0, computer: 0, draws: 0 });
    assert.equal(store.loadLearning(), 0);
    assert.equal(store.loadAvatar().emoji, '🦄');
    assert.doesNotThrow(() => { store.saveScore({ human: 1 }); store.saveLearning(2); store.saveAvatar(AVATARS[1]); });
  }
});

test('fallback scores are independent and the avatar catalog is immutable', () => {
  const { store } = fixture();
  store.loadScore().human = 50;
  assert.equal(store.loadScore().human, 0);
  assert.ok(Object.isFrozen(AVATARS));
  assert.ok(AVATARS.every(Object.isFrozen));
});

test('HTML picker matches avatar catalog and offline cache includes profile module', () => {
  const choices = [...html.matchAll(/data-avatar="([^"]+)" aria-label="([^"]+)"/g)]
    .map(([, emoji, name]) => ({ emoji, name: name.toLowerCase() }));
  assert.deepEqual(choices, AVATARS);
  assert.ok(sw.includes("'./profile.mjs'"));
});
