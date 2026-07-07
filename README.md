# Simon

A small Simon memory game built with vanilla JavaScript and tested with Jest.

Live: <https://gibbo101.github.io/simon-game>

## How it works

Type a name (optional), hit **New game**, and repeat the sequence back. Each
round adds one more step, and playback speeds up as your score climbs.

- **Global leaderboard** — one persistent board showing each player's best score
  ever, ranked high to low. Stored in the browser's `localStorage`, so it
  survives reloads. Play as many times as you like; only your best is kept, and
  nobody is ever blocked.
- Every game is a fresh random sequence, so there's nothing to memorise and
  replay for a fake high score.

> The leaderboard lives in `localStorage`, so it's per-browser and honour-system
> — great for a shared standup screen, not an authoritative record.

## Features

- Persistent global high-score board (`localStorage`)
- Audio tones per button (Web Audio API — no asset files)
- Difficulty ramp: playback speeds up as your score climbs
- Keyboard accessible: Tab to a button, Enter/Space to press it

## Running locally

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Tests

```bash
npm install
npm test
```
