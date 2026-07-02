# Simon — Daily Challenge

A small Simon memory game built with vanilla JavaScript and tested with Jest.

Live: <https://lukegibson101.github.io/simon-game>

## How it works

- **Daily challenge** — everyone who plays on the same calendar day gets the
  **identical** button sequence, generated from a seed derived from the date. This
  makes scores directly comparable, so the team can compete on a level playing
  field each day. You get **one recorded attempt per name per day**: the first
  result stands, so replaying the (deterministic) sequence can't inflate your
  score. Results are posted to the leaderboard.
- **Practice** — a random sequence you can replay as much as you like. Nothing is
  saved to the leaderboard. Use it to warm up.
- **Leaderboard** — a persistent, all-time board showing each player's best
  score across every day they have played, ranked high to low. Stored in the
  browser's `localStorage`, so it survives reloads.

> Anti-cheat note: the one-shot lock and leaderboard live in `localStorage`, so
> it's an honour-system deterrent — it stops casual replay-for-a-better-score,
> but a determined player could clear their browser storage or change their name.
> For a trusted standup team that's plenty; the scores aren't authoritative. The
> deterministic daily mechanic is deliberately not advertised in the UI.

## Features

- Deterministic daily sequence (seeded PRNG) for fair competition
- Persistent per-day leaderboard (`localStorage`)
- One recorded daily attempt per player (anti-cheat), plus unlimited Practice
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
