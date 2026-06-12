# Apogee — Design Doc

*A daily space-curling game. Brainstormed 2026-06-11. Working title: Apogee (alternatives: Slingshot, Gravity Well).*

*Sibling idea saved for later: [Critter Sumo](../../../../game-ideas/critter-sumo.md).*

## Design profile (what this game must be)

- **2–5 minute daily-bite sessions** — mobile-puzzler rhythm, zero ads, browser-based
- **Solo daily challenge** + **async head-to-head** vs friends, sharing one core mechanic
- **Perfect information** — the whole system is visible; no hidden info, no luck
- **Skill-shot execution** — parameter-based launches (angle + power), physics plays out
- **Optimization scoring** — compete on landing quality, one instantly comparable number

Inspirations: Park It (parameter shots), chess (positional play), mobile puzzlers (daily bite, minus ads), slither.io (low-friction fun).

## Section 1: The Game

**The pitch:** Every day, everyone gets the same tiny star system — a handful of planets with gravity, marked landing zones, and a launch point. You get **5 launches**. Drag to aim (slingshot-pull, Angry Birds style), see the **first ~25% of your trajectory**, release, and watch your probe curve through gravity wells. Land in scoring zones; closer to the bullseye scores more. Total your 5 landings, check the leaderboard, share an emoji grid. Two minutes. Come back tomorrow.

### Physics personality

- Planets are **fixed gravity sources**. The probe is pulled by all of them simultaneously — slingshots, decaying orbits, and figure-eight flybys emerge naturally from the math.
- A probe flies until it:
  - **lands on a surface** → becomes a permanent part of the board (obstacle/target for later shots),
  - **collides with another probe** → billiards in space; both tumble and may re-land or be lost,
  - **drifts off the map** → launch wasted. The void is the price of every greedy shot.
- Physics is **deterministic and seeded**: same day + same inputs → identical outcome on every machine. This is what makes leaderboards fair and replays shareable.

### Aiming

Partial trajectory preview: while dragging, the engine live-simulates and draws the first ~25% of the flight path. Enough to plan a slingshot's entry; the far side of the gravity well is on you. (Tunable; an "earned full-scan" mechanic is a possible later layer.)

### Scoring (Wordle-simple)

Each landing zone is a bullseye: outer ring 1, inner ring 3, center 5 (tunable). Solo score = sum of 5 landings (max ~25). One number, instantly comparable.

### Head-to-head (async, Phase 3)

Same engine, same daily system; two players alternate launches, 4 each, correspondence-chess pacing (take your turn whenever). Your landed probes are my obstacles and targets:

- claim a prime zone before your opponent reaches it,
- park a blocker on their approach path,
- knock their best lander off its spot — and maybe into the void.

Highest zone total at the end wins. Precision landing stays the only scoring rule for v1; planet-majority/territory bonuses are a candidate **post-v1 expansion**, not MVP.

## Section 2: Architecture

**Centerpiece decision: the engine is a pure, deterministic TypeScript package with zero dependencies.** No React, no DOM. `simulate(seed, inputs) → world state`, identical everywhere it runs. This buys:

1. **Cheat-proof leaderboards** — clients submit *inputs* (5 angle/power pairs, ~40 bytes), not scores. The server replays them through the same engine and computes the score itself. Cheating requires beating the physics, not editing a number.
2. **Shareable replays** — a friend's great shot is just input data; your client re-simulates it.
3. **Async head-to-head with no sync headaches** — a match is an ordered list of inputs. Nothing to reconcile.

### Monorepo layout (pnpm workspaces)

| Package | Contents |
|---|---|
| `engine` | Pure TS: fixed-timestep physics (gravity + circle collisions), seeded system generation (mulberry32 PRNG), scoring rules. Zero dependencies. |
| `shared` | Zod schemas: `LaunchInput`, `DailyResult`, `MatchState`. Single source of truth for client and server types. |
| `web` | React + Vite + TanStack Query. Raw canvas-2D renderer — no Phaser; the physics is simple enough that a game framework would be dead weight. |
| `server` | Hono + Drizzle: daily seed endpoint, replay-verification, leaderboard, async match turns. (Phase 2+) |

### Data flow — solo daily

```
date ──► daily seed ──► engine generates system
                            │
player drags to aim ◄───────┘
  (engine live-sims the 25% preview)
        │ release
        ▼
engine sims full flight ──► repeat ×5 ──► client POSTs inputs
                                              │
                          server replays inputs through same engine
                                              │
                                              ▼
                              verified score → leaderboard
```

### Game loop / rendering

Simulation runs at a **fixed timestep** (e.g. 60Hz logic); the canvas renderer interpolates between steps. This is the standard game-loop pattern and is *required* for determinism — frame rate must never affect physics.

### Build phases — each one is a playable game

1. **Phase 1 — Solo, client-only.** Engine + canvas renderer + daily seed derived from the UTC date. Local best score in localStorage. Fun exists before any server does.
2. **Phase 2 — Backend.** Hono server, verified leaderboard, Wordle-style share grids.
3. **Phase 3 — Head-to-head.** Async matches, knock-offs, friend invites.

## Section 3: Fairness, edge cases, error handling

- **Daily seed** = UTC date, so everyone worldwide plays the same board on the same day.
- **Determinism discipline:** no `Math.random()` at runtime (seeded PRNG for generation only); no time- or frame-dependent logic in the engine; fixed timestep; engine state fully serializable.
- **Float determinism:** JS floating point is deterministic per the IEEE 754 spec for the operations we use (+, −, ×, ÷, sqrt) — but `Math.sin/cos/pow` can differ across engines. The engine must either avoid them in the sim loop or use polyfilled deterministic versions. **This is the #1 technical risk; validate in Phase 1 with cross-browser golden tests.**
- **Endless flight guard:** a max simulation step count per launch (e.g. ~45 seconds of sim time); a probe still flying when it expires is "lost to deep space" (counts as void).
- **Solvability:** daily generation must guarantee a sane, playable system (reachable zones, no degenerate layouts). Generation runs validation checks and re-rolls from a derived seed on failure.
- **Abandoned H2H matches:** forfeit after N days of inactivity (Phase 3 detail).
- **Score submission failures:** inputs are stored locally; client retries idempotently (the replay-verification model makes resubmission naturally safe).

## Section 4: Testing

- **Engine (the bulk of testing, Vitest):**
  - *Golden replay tests:* fixed seed + fixed inputs → assert exact final state hash. Catches any accidental nondeterminism or physics regression instantly.
  - *Determinism property test:* run the same sim twice (and across Node versions in CI) → byte-identical results.
  - *Generation tests:* hundreds of seeds → all systems pass validity checks.
  - *Scoring unit tests:* zone math, collisions, void handling.
- **Server (Phase 2):** verification endpoint rejects tampered inputs/scores; idempotent resubmission.
- **Web:** light component tests; the engine purity means UI tests don't need to test physics. Manual play is the real Phase 1 feedback loop.

## Open items

- Final name (Apogee / Slingshot / Gravity Well / other)
- Exact tuning: launches per day, zone point values, preview length, map size
- Hosting target for Phase 2 (Cloudflare Workers + D1 is a natural Hono/Drizzle fit; decide later)
- Post-v1 ideas parked: territory/majority scoring, earned full-scan previews, moving bodies (moons/comets)
