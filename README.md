# Bippity-Boop

A colorful, installable tic-tac-toe Progressive Web App where a human plays against BoopBot. Each move produces a randomly synthesized “bip” or “boop” with the Web Audio API.

## Run locally

A service worker requires HTTP(S), so serve the folder instead of opening `index.html` directly.

```bash
cd bippity-boop
python3 -m http.server 8080 --bind 127.0.0.1 --directory deploy
```

Then open http://localhost:8080. Local previews bypass service-worker caching so refreshes show current files; deployed builds retain offline caching.

## Install on a phone

Deploy the `deploy/` folder to any HTTPS static host (Cloudflare Pages, Netlify, GitHub Pages, Vercel, etc.).

- Android/Chrome: use the install prompt or browser menu → Install app.
- iPhone/iPad Safari: Share → Add to Home Screen.

## Features

- Human vs. computer tic-tac-toe
- Tap the You score card to choose a persistent player avatar
- BoopBot learns actual strategies as you play, from random moves to perfect minimax
- Colorful brainpower meter with persistent learning
- Bonk BoopBot to reset scores and learning
- Synthesized bip/boop sounds; no audio files required
- Persistent scores and learning via localStorage
- Win confetti and short sound jingles
- Responsive layout and accessible buttons/status text
- Web app manifest and offline service worker
- 192px and 512px install icons

## Tests

This project includes zero-dependency Node regression and mutation checks.

```bash
npm test
```

The regression suite locks the unicorn/BoopBot subtitle, unicorn/robot display mapping, PWA asset cache, and Web Audio recovery behavior. The mutation suite deliberately breaks those invariants and verifies the tests detect the changes.

## Teaching BoopBot

BoopBot starts by guessing. A human win earns 1 learning point, a draw earns 0.5, and a BoopBot win earns 0.25. Brainpower reaches 100% at 56 points. Abandoned games earn nothing; New game keeps scores and learning. Existing scores are preserved, while learning starts at zero on first use.

Every 4 points advances one level. Capabilities unlock at levels 2 (center/corners), 4 (immediate wins), 6 (blocking), 8 (opposite corners), and 10 (fork creation/defense). Levels 12–13 use minimax with a 12% per-game chance of one intentional weaker choice, while always taking immediate wins and blocking immediate losses. Level 14 uses full minimax without intentional mistakes. Each game keeps its starting level; earned capabilities apply to the next game.

The Sound control remains available. **🥊 Bonk BoopBot** resets both scores and learning and starts a fresh game. The learning values are stored separately from scores and survive reloads when localStorage is available.

## Player avatars

Tap the **You** score card to choose 🦄 🐲 🐱 🦊 🐸 👻 👽 or 🐙. Your choice updates the subtitle, existing and future player pieces, accessible tile names, and victory messages. BoopBot stays 🤖. New game and Bonk preserve your avatar. Use Escape or tap outside the picker to close it. PWA install icons keep the original unicorn.

## Code organization

`deploy/game-engine.mjs` contains game rules, minimax, progressive strategies, and shared learning settings. It has no DOM, storage, or audio dependencies. Each bot instance owns its per-game imperfection state; tests can supply deterministic randomness.

`deploy/profile.mjs` defines the avatar catalog and persistence adapter, with validation and fallback behavior tested independently.

`deploy/app.js` is the browser module that coordinates game state, UI, storage, audio, and PWA setup. Round state is grouped into one object. Storage helpers preserve the existing score, learning, and avatar keys and formats; each loader retains its own validation. Shared renderers keep tile pieces and score-card accessibility labels consistent. All browser modules are included in the service-worker asset cache. No build step or runtime dependencies are required.

`deploy/confetti.mjs` owns canvas sizing, particles, animation frames, and reduced-motion behavior. `deploy/pwa.mjs` owns installation prompts and worker registration, including the localhost bypass. Both accept their browser dependencies explicitly for direct tests. `deploy/audio.mjs` owns Web Audio context recovery, gesture/lifecycle hooks, synthesized tones, and jingles. The controller calls its small API; the existing recovery architecture and sound timing are preserved.
