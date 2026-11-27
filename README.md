# best-flight-game-20261126-0057

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/wl0502749-code/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/wl0502749-code/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

**Ridgeline Courier** — a bush-plane flight game that runs offline in a desktop browser. Fly the Kestrel down a mountain valley, thread golden rings, drop supplies on smoke-marked clearings, and put her down on a short strip before the fuel runs out. Three sorties: Ring Run (dawn valley), River Drop (supply run along the river), and Dusk Landing (low fuel, crosswind, fading light).

## How to fly

- **↑ / ↓ (or W / S)** — throttle up / down. Speed is life: climb bleeds it, diving buys it back.
- **← / → (or A / D)** — bank and turn. Heading, altitude and speed are on the HUD, with a compass strip and a lit artificial horizon.
- **Mouse (hold and move) or Space** — pitch up to climb; **C** pitches down. **Space** also drops supplies over a drop zone.
- **P** pause · **R** restart · **M** mute · **1 / 2 / 3** pick a mission.

Land slow (under 62 kt), shallow and straight on the strip — too fast or too steep folds the gear. Rings pay 250 points, drops 400, a clean landing 500 plus a fuel bonus.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network: `game/` is plain static files (HTML + ES modules + generated WebAudio sound). Screenshots in `screenshots/` are real renders of the game, staged by `shots.json` (`?shot=start|play|end&seed=1`).

## Layout

- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to `/output` and writes `dossier.json` with the vendored make.fun library.
- `game/index.html` + `game/src/` — the game, split by job: `config.js` (tuning), `random.js` (seeded RNG), `world.js` (valley, flight model), `flight.js` (chase camera), `render.js` (sky, terrain, plane, HUD), `input.js`, `audio.js`, `shots.js` (screenshot staging), `main.js` (shell and frame loop).
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.

---

<sub>Entered on [make.fun](https://make.fun/?ref=4rzbqkgp&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
