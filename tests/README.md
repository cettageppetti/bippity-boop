# Tests

Run all tests with:

```sh
npm test
```

`regression.test.mjs` locks important UI/PWA/audio invariants.
`mutation.test.mjs` deliberately mutates those invariants and verifies the regression checks detect each mutation.

`invariants.mjs` shares source checks without registering duplicate tests.
`behavior.test.mjs` executes the app and service worker in isolated Node VM contexts. It covers reset timers, score validation/storage failures, capability unlocks, learning persistence/rewards, Bonk resets, avatar selection/persistence/accessibility, exhaustive unbeatable minimax play, single-use smart imperfections, audio recovery, and cache isolation/offline behavior. Device audio and visual layout still require browser/device checks.

`game-engine.test.mjs` imports the engine directly to test game rules, capability unlocks, forks, perfect play, and single-use imperfections without a DOM harness. Its behavioral mutation checks verify that random-play regressions and repeated blunders are detected. Browser integration tests remain in `behavior.test.mjs`.

The integration harness retains multiple event listeners, supports once handlers, models focus and picker containment, and bubbles simulated clicks to document handlers. It is intentionally a small mock rather than a full browser. Lifecycle audio checks invoke the registered handlers.

`profile.test.mjs` tests saved-data compatibility, validation, inaccessible storage, write failures, independent defaults, and consistency between the avatar catalog and HTML picker.

`effects.test.mjs` tests confetti sizing, animation replacement/completion, reduced motion, install prompt choices, installed-state cleanup, and worker registration failures.

`audio.test.mjs` tests tone scheduling, pitch slides, node cleanup, Sound mute behavior, constructor fallback, audio-clock jingle timing, overlapping recovery, stalled/late resume, pending-playback cancellation, and partial node failures directly. Audio source regression/mutation checks target the extracted module. Real iPhone playback still requires device testing.

`ui.test.mjs` tests rendering directly, including a mutation that exposes internal X/O tokens. Human-only celebrations and mutations that remove or misroute confetti are checked through executed controller behavior instead of source slices. UI wording, styling, and audio architecture still have targeted source guards.
