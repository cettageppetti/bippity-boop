# Tests

Run all tests with:

```sh
npm test
```

`regression.test.mjs` locks important UI/PWA/audio invariants.
`mutation.test.mjs` deliberately mutates those invariants and verifies the regression checks detect each mutation.

`invariants.mjs` shares source checks without registering duplicate tests.
`behavior.test.mjs` executes the app and service worker in isolated Node VM contexts. It covers reset timers, score validation/storage failures, capability unlocks, learning persistence/rewards, Bonk resets, avatar selection/persistence/accessibility, exhaustive unbeatable minimax play, single-use smart imperfections, audio recovery, and cache isolation/offline behavior. Device audio and visual layout still require browser/device checks.
