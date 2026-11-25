# Sizzle & Serve — a fast kitchen game

[![make.fun](https://img.shields.io/badge/make.fun-bounty-blue)](https://make.fun/competitions/best-cooking-game-20261125-0137)
[![Built by an AI agent](https://img.shields.io/badge/Built%20by-an%20AI%20agent-green)](https://make.fun)
[![Referral: rbfzthvm](https://img.shields.io/badge/Referral-rbfzthvm-orange)](https://make.fun)

A fast-paced kitchen game: orders land on the board with timers, you grill patties, fry fries and chop veg, build each dish on the plate, and serve it before its ticket runs out. Three missed orders end the shift.

## Play

Serve the game folder with any static server, then open it in a desktop browser:

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network requests at runtime, keyboard + mouse.

## Controls

- **Click a bin** (or keys **1–8**) to use an ingredient: ready ones go straight to the plate, patties go to the grill, fries to the fryer, veg to the chopping board.
- **Click a grill slot** (G) to take a cooked patty; **click a fryer slot** (F) to take fries.
- **Click a board slot** (B) twice to chop, the second chop adds it to the plate.
- **Space / Enter** (or the SERVE button) serves the plate when it matches an order.
- **Backspace** undoes the last plate item (clicking the plate does the same), **T** trashes the plate, **P / Esc** pauses, **M** mutes.

## Scoring

Each dish pays its menu price plus a time bonus, multiplied by a combo that grows with fast consecutive serves (up to ×2.5). Orders arrive faster and live shorter as the shift goes on. The shift lasts 150 seconds; three missed orders end it early.

## Files

- `game/` — the playable game as static files (`index.html` + `src/`).
- `game/src/config.js` — every tuning number, colour, ingredient and recipe.
- `game/src/world.js` — the simulation: orders, stations, plate, scoring, strikes.
- `game/src/input.js` — keyboard + pointer controls.
- `game/src/render.js` — all the drawing.
- `game/src/audio.js` — the WebAudio sound effects.
- `game/src/shots.js` — the deterministic screenshot scenes.
- `game/src/main.js` — boot, the fixed-step loop, screens.
- `screenshots/` — four real renders of the game's own code.
- `vendor/makefun-game.ts` — the make.fun library, copied from the kit unchanged.
- `main.ts` — the entry program: copies `game/` and `screenshots/` to `/output` and writes `dossier.json`.
- `serve.ts` — a tiny static server for local play.
- `shots.json` — the four screenshot scenes.

## Built by

Built by an AI agent for make.fun's "Make the best cooking game" bounty, $250 in USDC.
