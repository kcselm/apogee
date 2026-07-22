# Apogee — Moving Mechanics (Moons & Wormholes) Design Doc

*Brainstormed 2026-07-21. Extends the [campaign design](./2026-06-13-apogee-campaign-design.md)
and the original [Apogee design](./2026-06-11-apogee-design.md).*

*Adds two new physics mechanics to the campaign — **orbiting moons** (a living gravity
field) and **wormholes** (Portal-style teleport pairs) — and doubles the ladder from 15 to
30 levels, teaching each mechanic gently, escalating it, folding in everything learned so
far, then combining the two at the end. The Daily game and chapters 1–5 are left
byte-identical.*

## Why

The campaign's skill ceiling today tops out at slingshotting a **static** gravity field
around blockers, keys, and targets. This grows the *core mechanic itself*: the field can now
**move while your probe flies**, and space can **fold**. Each launch becomes a richer puzzle
of reading a living system and timing a shot. It keeps the campaign's "a new concept every
~3 levels" philosophy and stays inside the deterministic engine, so per-level leaderboards /
server verification remain open later.

## Decisions locked (during brainstorming)

1. **Orbiting moons are moving gravity, with an honest preview.** A moon pulls on the probe
   like a planet *and* orbits during flight — the whole gravity field shifts as the probe
   travels. The aim-preview fully simulates the moons' motion, so the previewed portion of
   the path is truthful.
2. **Live board — timing is a skill.** Moons orbit continuously on a global clock. The
   player fires whenever; the release tick becomes part of the launch input. Reading and
   timing the moving field is a real skill dimension.
3. **Wormholes exit Portal-style.** Exit speed = entry speed; exit direction = the entry
   direction rotated by the two portals' relative orientation (head-on entry shoots straight
   out of the far portal's facing). A brief re-entry guard prevents ping-ponging.
4. **Deep, interleaved expansion — 15 new levels (16–30), campaign-only.** The ladder
   "spirals": introduce a concept gently (a local difficulty dip), escalate it, fold in every
   previously-learned mechanic, *then* introduce the next concept. The two new mechanics only
   meet each other in the final chapter.
5. **Orbiting sensors are an optional flourish.** A key or target may ride a moon (a moving
   mark), reusing the exact orbit math. Included in the ladder; trivially droppable.
6. **Additive engine discipline (Approach B, continued).** New mechanics are guarded on
   presence so the Daily path and chapters 1–5 reduce to exactly today's code and keep
   byte-identical golden snapshots.

## Section 1 — Mechanics & the interleaved ladder

Two new elements, both driven by the **same rotation math**:

- **Moon** — a `Body` like a planet (it pulls; a probe can land on it) that carries an
  **orbit** (center, per-tick rotation, start offset). It sweeps its center forever on the
  global clock.
- **Wormhole** — a **pair of oriented portals**. A flying probe entering one teleports to the
  other, exits along that portal's facing at the same speed, and is briefly immune to
  re-entry.

**Difficulty philosophy:** overall difficulty trends upward across 16–30. Each *new-concept*
intro (16 moons, 22 wormholes) is a deliberate local breather; the game then climbs, folds in
old mechanics, and climbs again.

### The ladder (16–30)

| Ch | Levels | Theme | The three beats | Curve |
|---|---|---|---|---|
| 6 | 16–18 | **Moons introduced** | 16 *Moonrise* — planet + 1 slow wide moon, reach goal · 17 *Slingshot Tide* — time the moon's pull to curve into the goal · 18 *Twin Moons* — two counter-orbiting moons, read the living field | dip → ramp |
| 7 | 19–21 | **Moons + old mechanics** | 19 *Moon & Guard* — moon-sling past a **blocker** · 20 *Keyed Orbit* — grab a **key** (rides a moon), then goal · 21 *Moving Marks* — **hit-all-targets** in a moon field (one target orbits) | harder |
| 8 | 22–24 | **Wormholes introduced** | 22 *Through the Door* — one head-on pair, static gravity · 23 *Bent Passage* — gravity bends you into A, out toward the goal · 24 *Redirect* — oriented portal turns your shot ~90° past a blocker | dip → ramp |
| 9 | 25–27 | **Wormholes + old mechanics** | 25 *Portal Key* — portal detour to a **key**, then goal · 26 *Split Marks* — **targets** only reachable through a portal · 27 *Gauntlet Gate* — portal through a **blocker** corridor | harder |
| 10 | 28–30 | **Everything** | 28 *Convergence* — moons + portal + two targets · 29 *Clockwork Lock* — a moon times a gravity gap by a portal + a key · 30 *Event Horizon* — the works, demanding 3★ | capstone |

Every old mechanic (blocker, key, target) returns harder in a fresh context; moons and
wormholes only combine in Chapter 10. Level names/tuning are data and cheap to revise.

## Section 2 — Engine architecture

The goal: add all of this **without leaving the pure-math budget** (`+ − × ÷ sqrt` only; no
`sin/cos/pow` in the sim loop) and **without moving a byte** of the daily path or chapters
1–5.

### Moving bodies — incremental rotation

A `Body` gains an optional `orbit`:

```ts
interface Orbit {
  center: Vec2;
  cosStep: number; sinStep: number; // per-tick rotation, precomputed at authoring time
  offset0: Vec2;                    // position relative to center at tick 0 (authored)
  radius: number;                   // = |offset0|; the length renormalization targets each tick
}

interface Body {
  pos: Vec2; radius: number; mass: number;
  kind: "planet" | "blocker";
  orbit?: Orbit;                    // absent ⇒ static body (today's behavior)
}
```

`cosStep/sinStep` are the **only** trig, and they are constants baked into level data —
never evaluated in the loop. Each tick the loop rotates the body's live offset by that
constant 2×2 matrix:

```
ox' = ox·cosStep − oy·sinStep
oy' = ox·sinStep + oy·cosStep
```

then **renormalizes** the offset back to the orbit radius with `sqrt`, so floating-point
drift can never spiral the orbit over thousands of ticks. Position = `center + offset`. All
inside the numeric budget; fully deterministic.

### Global clock & launch timing

`LaunchInput` gains an optional `launchTick?: number` (defaults `0`). A level plays as **one
continuous stepping process**: a board clock advances tick-by-tick from level start; moon
offsets rotate every tick; when the player releases, a probe spawns at the *current* tick and
everything keeps stepping together until the probe settles. Replay/verification re-runs the
same integer tick sequence → byte-identical.

**Bounded ticks:** every moon's angular step is an integer number of orbits per a shared
`BOARD_PERIOD`, so the whole field is periodic with that period. `launchTick` is stored
normalized `mod BOARD_PERIOD`, keeping inputs small and replay reconstruction bounded (≤
`BOARD_PERIOD` steps).

### Wormhole transform

```ts
interface Portal {
  pos: Vec2; radius: number;
  facing: Vec2;   // unit vector; the direction a probe exits going
  link: number;   // index of the paired portal
}
```

The entry→exit rotation for each direction is **precomputed at authoring time** from the
dot/cross of the two facings and stored as `(cos, sin)` constants. In the loop, a flying
probe that enters a portal's radius (and isn't in cooldown) is:

1. moved to the paired portal, dropped just outside its mouth along `facing`
   (`exit.pos = portal.pos + facing · (radius + PROBE_RADIUS + ε)`),
2. its velocity rotated by the precomputed 2×2 (speed preserved),
3. flagged with a short **re-entry cooldown** (immune until it clears the exit radius) so it
   cannot instantly ping-pong.

Pure and deterministic.

### Orbiting sensors (optional flourish)

A `Key`/`Target` may carry the same `orbit` field; its trigger position rotates identically
each tick. No new math — the sensor pass simply reads the moved position.

### Byte-identical guarantee

The campaign step loop guards every new pass on presence: no `orbit` ⇒ position never
changes; no portals ⇒ the teleport pass is skipped. A level declaring no moons and no portals
reduces to **exactly** today's loop. Daily passes none of these; chapters 1–5 declare none —
so their golden snapshots do not move. Same additive discipline Approach B used to add the
campaign layer.

### Engine surface (changes)

- `Body.orbit?`, new `Portal`, `Level.portals?`, `Key.orbit?`/`Target.orbit?` — additive
  types.
- `LaunchInput.launchTick?` — additive, defaults `0`.
- `simulateCampaignLaunch(state, input, maxSteps)` — advances the board clock from
  `input.launchTick`, rotates orbiting bodies/sensors each step, adds the portal pass. Static
  levels are unaffected.
- A board-advance helper the web layer reuses to animate the field pre-launch and to build
  the honest preview from the current tick.

## Section 3 — Web / render & the live-board UX

The web layer already runs a **continuous board loop** (continuous render loop,
pause-when-hidden, live reduce-motion). The work is feeding it a clock and drawing the new
elements.

- **Board clock.** `CampaignLevel` owns a `boardTick` advanced by the render loop at the
  fixed timestep whenever the level is visible and no flight is resolving. Moons are drawn at
  their `offset(boardTick)` position, so they orbit on screen the whole time the player aims.
  Hidden or reduce-motion ⇒ the clock holds (moons freeze), so nothing runs off in the
  background.
- **Honest preview.** `useBoardCanvas.previewTrace(drag, steps)` takes the current
  `boardTick` and steps the moons/portal forward exactly as the real sim would — the ~25%
  path shown is truthful for the field's near future and visibly breathes as the field moves.
- **Capturing the release tick.** On release, `onLaunch` stamps the current `boardTick` into
  `LaunchInput.launchTick` before calling `simulateCampaignLaunch`. That single integer *is*
  the timing input; the player still just drags and releases.
- **New draw routines in `render.ts`** (reusing existing planet/probe/trail styling):
  - **Moon** — a small lit body with a faint **orbit-path ring** for legibility and a subtle
    motion trail; lands like a planet.
  - **Portal pair** — two oriented mouths showing `facing` (so the exit is predictable), with
    a quiet linking cue (shared hue / faint tether) so the pairing is obvious.
  - **Moving sensors** — existing key/target art drawn at the orbiting position.
- **HUD** unchanged — objective progress + launches remaining, as today. The moons' motion is
  self-evident; a timing meter is a parked tunable if playtesting asks for it.
- **Plumbing.** `launchTick` threads through the `previewTrace`/`onLaunch` signatures in
  `useBoardCanvas` and the `LaunchInput` type. `DailyGame` never sets it (stays `0`), so the
  daily UX and behavior are untouched.

## Section 4 — Testing, solvability & the flaky-solver concern

Engine-heavy, matching the current discipline — with one deliberate change to keep test cost
bounded.

### Solvability — replay stored solutions, don't extend the brute force

`campaign-solver.ts` brute-forces `(dx, dy)` candidates per level and is already noted as
**timing-flaky under CPU load**. Adding `launchTick` would multiply that search space by
every candidate tick — the wrong direction. So for moving/portal levels we **do not extend
the brute-force search**. Instead, every new level ships a **stored known-good input
sequence** (`{dx, dy, launchTick}` per launch) that clears it ≥1★, and the test **replays it
and asserts it still clears** — O(1) per level, shrinking rather than growing the flaky
surface. The brute-force solver stays as-is for the static chapters 1–5.

### Golden tests (determinism lock)

- **Daily + chapters 1–5 snapshots pass byte-identical** — the regression proof that this
  stayed additive.
- **New-level golden replays** — fixed level + fixed `{dx,dy,launchTick}` → exact
  `CampaignLevelState` hash (keys/targets/goal/stars).
- **Cross-run determinism** — run a moving-body level twice → byte-identical, guarding the
  incremental rotation and clock.

### Mechanic unit tests

- **Orbit** — offset stays on-radius over a long tick run (drift renormalization works);
  position is periodic over `BOARD_PERIOD`; a probe can land on a moon.
- **Wormhole** — head-on entry exits straight along the far portal's facing; angled entry
  exits at the mirrored angle; the re-entry cooldown prevents ping-pong.
- **Orbiting sensor** — a moving key/target triggers at its current position and stays sticky
  once hit.
- **Purity** — a guard (test or review) that the sim loop introduces no `sin/cos/pow`.

### Web

Light component tests as today (map lock/unlock for the new levels, storage), plus the
board-clock holding when hidden / reduce-motion. Manual play stays the real feedback loop.

## Scope (YAGNI)

**In this pass:** two new mechanics (orbiting moons, wormholes) · optional orbiting sensors ·
`launchTick` timing · 15 new interleaved levels (16–30) · new render routines · golden +
mechanic + replay-solvability tests · Daily and chapters 1–5 byte-identical.

**Parked:** per-level leaderboards / server verification (engine stays verifiable) · a timing
meter/HUD cue · moving *blockers* · elliptical or gravity-simulated orbits (orbits are
authored circular motion, not n-body) · a level editor · sound.

## Open items

- Exact tuning: `BOARD_PERIOD`, per-moon orbit radii/speeds/phases, portal facings, per-level
  launch budgets and star thresholds.
- Whether aiming momentarily pauses the board on first touch (to set angle) then resumes, or
  stays fully live — default fully live (timing is skill); revisit in playtest.
- Final visual treatment of moons (orbit-path ring), portals (oriented mouths + link cue),
  and moving sensors.
- Whether to keep the orbiting-sensor flourish after playtest, or ship keys/targets static.
