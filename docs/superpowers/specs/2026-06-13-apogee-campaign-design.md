# Apogee — Campaign Mode Design Doc

*Brainstormed 2026-06-13. Extends the original [Apogee design](./2026-06-11-apogee-design.md).
Adds an Angry-Birds-style level campaign alongside the existing daily score-attack game.*

## Why

The daily game is a score-optimizer: one shared board per day, sum five launches, come
back tomorrow. This adds the opposite rhythm — **a ladder of hand-authored levels you
binge back-to-back, getting progressively harder, introducing a new mechanic every few
levels** (blocker planets, then collect-a-key-before-the-goal). The two modes share the
same deterministic engine.

## Decision summary (locked during brainstorming)

1. **Mode shape:** Campaign is a **new mode alongside** the daily game. The daily game and
   its code/behavior are left untouched. A home screen picks Daily or Campaign.
2. **Win condition:** A level is cleared by satisfying **typed objectives**. v1 supports
   `reach-goal` and `hit-all-targets`; a level may combine them. All objectives must be met.
3. **Level source:** **Hand-authored** levels stored as typed data. The author controls the
   difficulty ramp and when each mechanic first appears.
4. **Launches & stars:** Each level grants a limited **launch budget**. Star rating is
   **hybrid** — efficiency (launches left) + precision (how cleanly the objective was hit).
   Thresholds are authored per level.
5. **Key mechanic:** A key is collected by flying a probe through it and **persists across
   launches**. The goal stays locked until the level's keys are collected.
6. **Blocker mechanic:** A blocker is a **gravity well you cannot touch** — it bends the
   probe's path like a planet, but contact loses the probe and wastes the launch.
7. **Engine architecture:** **Additive campaign layer** (Approach B). Daily path and its
   golden tests stay byte-identical; shared physics primitives are reused by a new
   `campaign/` module that holds all the new mechanics and rules — inside the deterministic
   engine, so campaign play stays server-verifiable later.

## Section 1: The campaign experience

A campaign level is a small, fixed star system with a launch point, some planets, and an
objective. You get a limited number of slingshot launches. Drag to aim (same as daily),
release, watch the probe curve through gravity, and try to satisfy the level's objective:
**reach the goal**, or **hit every target**, sometimes after **collecting a key** first —
all while **slingshotting around blocker planets** that destroy a probe on contact.

Clear a level to earn at least one star; clear it with launches to spare and a clean,
centered objective pass to earn two or three. An end card offers **Retry** and **Next
level**, so stages flow one right after another. Progress (cleared + best stars per level)
is saved locally; levels unlock linearly.

### The mechanics, by player feel

- **Goal** — the destination. Land on it or fly through it. Locked until keys are in hand.
- **Key** — grab it on any launch; it stays grabbed. Turns a level into a two-shot puzzle:
  one launch to thread the key, another to hit the now-open goal (or both in one flight).
- **Blocker planet** — pulls on the probe like a planet but is lethal to touch. You must use
  the *other* planets' gravity to curve past it.
- **Target** — for `hit-all-targets` levels: pass a probe through every target to clear.

## Section 2: Architecture

**Approach B — additive campaign layer.** The pure, deterministic engine is preserved. The
daily public API (`createDailyGame`, `simulateLaunch`, `scoreGame`, …) and its golden
snapshot tests do not change. Shared physics math is extracted into reusable primitives that
both the daily path and a new campaign path call, guaranteeing identical behavior.

### Module layout

```
packages/engine/src/
  physics.ts            extract primitives: gravityAt (exists), integrateProbe,
                        tryLand, resolveCollisions, voidCheck
  game.ts, generation.ts, scoring.ts, …   daily path — public API untouched
  campaign/
    types.ts            Level, Body, Key, Goal, Target, Objective, CampaignLevelState
    levels.ts           authored v1 ladder: export const LEVELS: Level[]
    simulate.ts         simulateCampaignLaunch() — primitives + key/blocker/goal/target
    objectives.ts       evaluateObjectives() → met flags + isCleared
    scoring.ts          starRating() → 0..3 + breakdown
    index.ts
  index.ts              add campaign exports
```

### Data model (reuses existing `Vec2`, `Probe`, and the `RINGS` table from `scoring.ts`)

```ts
interface Body { pos: Vec2; radius: number; mass: number;
                 kind: "planet" | "blocker" }   // both exert gravity

interface Key    { pos: Vec2; radius: number }   // fly through to collect (persists)
interface Goal   { pos: Vec2; radius: number }   // reach to satisfy reach-goal
interface Target { pos: Vec2; radius: number }   // for hit-all-targets

type Objective = { kind: "reach-goal" } | { kind: "hit-all-targets" }

interface Level {
  id: string; name: string;
  bodies: Body[];                 // planets + blockers (gravity sources)
  keys: Key[]; goal?: Goal; targets: Target[];
  launchPos: Vec2;
  bounds: { width: number; height: number };
  launchBudget: number;           // max launches
  objectives: Objective[];        // ALL must be met to clear
  starThresholds: { two: number; three: number };
}
```

Precision is measured around the **goal/target centers** themselves (a probe's distance to
the center at trigger time, mapped through `RINGS`), so there is no separate bullseye-zone
concept in a level — the objective *is* the bullseye.

```ts
interface CampaignLevelState {
  level: Level;
  probes: Probe[];
  launchesUsed: number;
  keysCollected: boolean[];       // sticky, per key, persists across launches
  targetsHit:    boolean[];       // sticky, per target
  goalReached:   boolean;         // sticky once triggered with keys in hand
  bestPrecision: number;          // best objective-pass precision so far
}
```

### Engine surface (new)

- `createLevel(level: Level): CampaignLevelState`
- `simulateCampaignLaunch(state, input: LaunchInput): { state, trace }`
- `evaluateObjectives(state): { met: boolean[]; cleared: boolean }`
- `isLevelOver(state): boolean`  — cleared OR launches exhausted
- `starRating(state): { stars: 0 | 1 | 2 | 3; levelScore: number }`

### Determinism constraints (carried over from the original spec)

- Campaign rules live **in the engine**, not the UI, so a server could re-judge a level from
  its inputs later (per-level leaderboards are a parked extension, not v1).
- Only `+ − × ÷ sqrt` in numeric code; no `Math.sin/cos/pow` in the sim loop; fixed timestep.
- Daily golden tests must remain byte-identical — the regression proof that Approach B left
  the daily path alone.

## Section 3: Mechanics in detail

New elements split into two kinds, which keeps the step function simple:

**Bodies** (physical — exert gravity, occupy space, included in `gravityAt`):
- **Planet** — as today: probe lands and sticks to the surface.
- **Blocker** — gravity source *and* lethal: a flying probe entering `radius + PROBE_RADIUS`
  becomes `lost` (no landing, launch wasted).

**Sensors** (non-physical — triggered when a flying probe passes within range; never alter
the flight path):
- **Key** — first probe to pass through sets `keysCollected[i] = true`, sticky for the level.
- **Goal** — triggers the `reach-goal` objective when a probe passes through, **only once all
  keys are collected**; a locked goal ignores the trigger. Surface placement ⇒ "land there";
  open-space placement ⇒ "fly through it." One rule covers both.
- **Target** — first probe to pass through sets `targetsHit[i] = true`.

### The campaign step

`simulateCampaignLaunch` runs the same loop daily does — integrate → land → collide →
void — **plus one extra pass** per step: check blocker contact (→ `lost`) and sensor
overlaps (keys, goal, targets). It also emits lightweight trace events
(`{ step, type: "key" | "goal" | "target", index }`) so the renderer can flash a pickup
mid-flight. Daily passes no blockers and no sensors, so its path is unchanged.

### Gating rule

A level's goal unlocks when **all** its keys are collected. Most levels have one key;
multi-key levels become "grab both, then land." Tunable in level data.

## Section 4: Objectives, clearing, and star rating

**Clearing.** `evaluateObjectives` checks every objective; the level is cleared the instant
all are satisfied. `isLevelOver` = cleared OR `launchesUsed >= launchBudget`. Out of
launches with an objective unmet ⇒ failed; the player retries.

**Star rating** (hybrid efficiency + precision):

```
launchesLeft = launchBudget − launchesUsed
bestPrecision = best RINGS points (5/3/1) of any objective-completing pass, scored by the
                probe's distance to the goal/target center at the moment it passed through
levelScore   = launchesLeft × LAUNCH_BONUS + bestPrecision

stars = !cleared                          ? 0
      : levelScore ≥ starThresholds.three ? 3
      : levelScore ≥ starThresholds.two   ? 2
      : 1                                   // clearing at all earns one star
```

`LAUNCH_BONUS` is a global tuning constant; `starThresholds.{two,three}` are authored per
level, so the entire star curve lives in content. Measuring precision **at trigger time**
(not only on landing) means it works whether the goal is a surface to land on or a ring to
fly through.

## Section 5: Web layer

Today `App.tsx` *is* the daily game. Split so both modes are first-class:

```
web/src/
  AppRoot.tsx          view state machine: 'home' | 'daily' | 'map' | 'level'
  DailyGame.tsx        today's App.tsx logic, moved as-is (behavior unchanged)
  campaign/
    CampaignMap.tsx     the level ladder
    CampaignLevel.tsx   one level's play loop
    campaignStorage.ts  progress persistence
  GameCanvas.tsx        shared; renders daily OR a campaign level
  render.ts             extended to draw blockers / keys / goal / targets
```

- **Home** — title screen with **Daily** and **Campaign** buttons. No router library; `AppRoot`
  holds a `view` field.
- **CampaignMap** — grid of level tiles showing number, earned stars, and lock state. Linear
  unlock: level N opens when N−1 is cleared. Click an open tile to play it.
- **CampaignLevel** — mirrors the daily loop but calls `simulateCampaignLaunch`; its HUD shows
  **objective progress** (keys collected, targets hit, goal locked/unlocked) and **launches
  remaining**. Level-over card: **stars earned + Retry + Next level** (Next jumps straight to
  the following stage — the binge flow).
- **campaignStorage** — extends the existing `storage.ts` pattern (injected `Storage`, thin
  load/record functions) with one key, `apogee-campaign-progress`, mapping
  `levelId → { cleared: boolean; stars: 0..3 }`. Unlocks are derived from it.
- **render.ts** — adds draw routines: **blocker** (visually hostile, distinct from a planet),
  **key** (glints; dimmed once collected), **goal** (ring/portal, styled locked vs unlocked),
  **target** (mark that flips when hit). All read from `CampaignLevelState`; existing
  planet/zone/probe/trajectory drawing is reused.

The daily game's files and behavior do not change — `DailyGame.tsx` is the old `App.tsx`
under a new name, mounted by `AppRoot`.

## Section 6: Level authoring and the v1 ladder

**Authoring format.** Levels are typed TypeScript data in `campaign/levels.ts`
(`export const LEVELS: Level[]`) — not JSON. Compile-time type-checking on every level,
shared constants, no runtime parsing. Editing or reordering a level is a data change.

**The v1 ladder (~15 levels)** — a new concept roughly every three levels, introduced gently
then combined:

| Levels | Introduces | Curve |
|---|---|---|
| 1–3   | reach-goal, gravity   | 1 planet → 2 planets → a real slingshot-around |
| 4–6   | **blocker**           | blocker in the straight path → blocker + gravity → blocker corridor |
| 7–9   | **key → goal**        | key then goal (2 shots) → key behind a planet → key + blocker |
| 10–12 | **hit-all-targets**   | two targets → spread targets (multi-shot) → targets + blocker |
| 13–15 | **everything**        | key + targets → tight budget + blocker + key → capstone with a demanding 3★ |

Difficulty ramps via tighter launch budgets, more bodies, blockers nearer the ideal path,
keys placed behind hazards, and stricter star thresholds. Counts and tuning are cheap to
revise since it is all data.

## Section 7: Testing

Engine-heavy, matching the current discipline:

- **Daily golden tests must still pass unchanged** — the proof Approach B did not disturb
  the daily path.
- **Campaign golden tests** — fixed level + fixed inputs → exact `CampaignLevelState` hash
  (keys / targets / goal / stars). Locks campaign determinism.
- **Mechanic unit tests** — blocker contact → `lost`; key collection persists across
  launches; goal stays locked until keys collected; sensor-precision math.
- **Objective + star unit tests** — each objective met/unmet; star thresholds map correctly.
- **Solvability tests** — every authored level ships with a known-good input sequence that
  clears it (≥1★). The authored-level analog of the daily generation-validity tests; guards
  against breaking a level while tuning.
- **Web** — light component tests (map lock/unlock logic, storage); manual play is the real
  feedback loop, as today.

## Section 8: Scope (YAGNI)

**In v1:** home / mode select · ~15 authored levels · 4 mechanics (reach-goal,
hit-all-targets, blocker, key) · hybrid stars · linear unlock · localStorage progress ·
retry / next.

**Parked for later:** procedural / endless levels · star-gated chapter unlocks ·
moving / rotating bodies · per-level leaderboards + server verification (the engine stays
verifiable, so this remains open) · a level-editor UI · sound.

## Open items

- Exact tuning: per-level launch budgets, `LAUNCH_BONUS`, star thresholds, body counts.
- Final visual treatment of blockers / keys / goal / targets and the level-map screen
  (nailed during implementation; can be mocked up first if desired).
- Whether the home screen also surfaces a "best stars / N total" progress summary.
