# Bippity-Boop

A colorful, installable tic-tac-toe Progressive Web App where a human plays against BoopBot. Each move produces a randomly synthesized “bip” or “boop” with the Web Audio API.

## Run locally

A service worker requires HTTP(S), so serve the folder instead of opening `index.html` directly.

```bash
cd bippity-boop
python3 -m http.server 8080 --bind 127.0.0.1 --directory deploy
```

Then open http://localhost:8080.

## Install on a phone

Deploy the `deploy/` folder to any HTTPS static host (Cloudflare Pages, Netlify, GitHub Pages, Vercel, etc.).

- Android/Chrome: use the install prompt or browser menu → Install app.
- iPhone/iPad Safari: Share → Add to Home Screen.

## Features

- Human vs. computer tic-tac-toe
- Smart minimax computer with a small playful imperfection rate
- Optional easier tactical bot mode
- Synthesized bip/boop sounds; no audio files required
- Persistent score via localStorage
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
