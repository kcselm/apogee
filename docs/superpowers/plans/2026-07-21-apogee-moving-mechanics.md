# Moving Mechanics (Moons & Wormholes) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add orbiting moons (a live, moving gravity field with launch-timing) and Portal-style wormholes to the Apogee campaign, plus 15 new interleaved levels (16–30), keeping the Daily game and campaign chapters 1–5 byte-identical.

**Architecture:** Additive layer on the existing deterministic engine. New `campaign/orbit.ts` and `campaign/portal.ts` hold pure math; `simulateCampaignLaunch` is rewritten to advance moving geometry each step, teleport through portals, and accept a `launchTick`. Every new pass is guarded on presence, so levels declaring no moons/portals reduce to today's exact loop. Moving levels are validated by replaying stored known-good solutions (not by extending the brute-force solver). The web layer gains a board clock that animates the field while aiming, feeds an honest preview, and stamps the release tick into the launch input.

**Tech Stack:** TypeScript, pnpm workspaces, Vitest (engine + web), React 19 + Vite, canvas-2D renderer.

## Global Constraints

- **Numeric budget (engine sim loop):** only `+ − × ÷ sqrt`. No `Math.sin/cos/pow/atan2` inside any per-step simulation code. Trig is allowed ONLY in authoring/setup helpers (`makeOrbit`, `makePortal`) and test/tool/render code — mark such spots with a comment.
- **Determinism:** same inputs → byte-identical results everywhere. Fixed timestep `DT = 1/60`. Engine state fully serializable. No `Math.random()` or time/frame-dependent logic in the engine.
- **Byte-identical guarantee:** the Daily path and campaign chapters 1–5 must produce identical golden snapshots after every task. `packages/engine/tests/golden.test.ts` and the existing `it`s in `campaign-golden.test.ts` must never change their snapshots.
- **`LaunchInput.launchTick` is optional and defaults to 0.** The Daily engine ignores it. Static campaign levels are unaffected by it.
- **Board period:** `BOARD_PERIOD = 480` ticks (8 s). Every orbit's angular step is `2π·turnsPerPeriod/BOARD_PERIOD`, so the whole field is periodic with `BOARD_PERIOD`; `launchTick` is used mod `BOARD_PERIOD`.
- **Commands (Windows PowerShell):**
  - One engine test file: `pnpm --filter @apogee/engine exec vitest run <substring>`
  - Full engine suite: `pnpm --filter @apogee/engine test`
  - Web suite: `pnpm --filter @apogee/web test`
  - Typecheck: `pnpm --filter @apogee/engine typecheck` / `pnpm --filter @apogee/web typecheck`
  - Dev server: `pnpm dev`

---

## Task 0: Establish a green baseline

**Files:** none created; verifies working tree.

- [ ] **Step 1: Run the full suite**

Run: `pnpm test`
Expected: all engine + web tests pass. (The working tree currently has modified snapshot files `packages/engine/tests/__snapshots__/campaign-golden.test.ts.snap` and `golden.test.ts.snap`.)

- [ ] **Step 2: Reconcile the modified snapshots**

If Step 1 is green, the modified snapshots are the intended baseline — commit them so "byte-identical" has a clean reference:

```bash
git add packages/engine/tests/__snapshots__/campaign-golden.test.ts.snap packages/engine/tests/__snapshots__/golden.test.ts.snap
git commit -m "test(engine): lock current golden snapshots as baseline"
```

If Step 1 is RED, stop and diagnose before proceeding — do not build on a red baseline.

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

---

## Task 1: Orbit math + orbit types

**Files:**
- Modify: `packages/engine/src/campaign/constants.ts` (add `BOARD_PERIOD`)
- Modify: `packages/engine/src/campaign/types.ts` (add `Orbit`, `orbit?` on `Body`/`Key`/`Target`)
- Create: `packages/engine/src/campaign/orbit.ts`
- Modify: `packages/engine/src/campaign/index.ts` (export orbit helpers + constant)
- Test: `packages/engine/tests/campaign-orbit.test.ts`

**Interfaces:**
- Produces:
  - `interface Orbit { center: Vec2; offset0: Vec2; radius: number; cosStep: number; sinStep: number }`
  - `advanceOrbit(off: Vec2, orbit: { cosStep: number; sinStep: number; radius: number }): Vec2`
  - `orbitOffsetAt(orbit: Orbit, tick: number): Vec2`
  - `orbitPositionAt(orbit: Orbit, tick: number): Vec2`
  - `makeOrbit(center: Vec2, radius: number, phaseTurns: number, turnsPerPeriod: number): Orbit`
  - `BOARD_PERIOD: number`

- [ ] **Step 1: Add the constant**

In `packages/engine/src/campaign/constants.ts`, append:

```ts
/** Ticks in one full board cycle; every orbit is periodic with this. 480 = 8s @ 60Hz. */
export const BOARD_PERIOD = 480;
```

- [ ] **Step 2: Add orbit types**

In `packages/engine/src/campaign/types.ts`, add the `Orbit` interface above `Body`, and an optional `orbit` on `Body`, `Key`, `Target`:

```ts
/** Circular orbit driving a moving body/sensor. `cosStep`/`sinStep` are baked at
 *  authoring time (the only trig); the sim only rotates + renormalizes with them. */
export interface Orbit {
  center: Vec2;
  offset0: Vec2;
  radius: number;
  cosStep: number;
  sinStep: number;
}
```

Then add `orbit?: Orbit;` as the last field of `Body`, `Key`, and `Target` (leave every other field unchanged).

- [ ] **Step 3: Write the failing test**

Create `packages/engine/tests/campaign-orbit.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { BOARD_PERIOD } from "../src/campaign/constants";
import { advanceOrbit, makeOrbit, orbitOffsetAt, orbitPositionAt } from "../src/campaign/orbit";

describe("orbit math", () => {
  it("keeps the offset on the orbit radius over a long run", () => {
    const orbit = makeOrbit({ x: 800, y: 500 }, 160, 0, 1);
    let off = { x: orbit.offset0.x, y: orbit.offset0.y };
    for (let i = 0; i < 5000; i++) off = advanceOrbit(off, orbit);
    expect(Math.sqrt(off.x * off.x + off.y * off.y)).toBeCloseTo(160, 6);
  });

  it("orbitOffsetAt(tick) equals stepping from offset0 tick times", () => {
    const orbit = makeOrbit({ x: 800, y: 500 }, 120, 0.25, 2);
    let off = { x: orbit.offset0.x, y: orbit.offset0.y };
    for (let i = 0; i < 37; i++) off = advanceOrbit(off, orbit);
    const at = orbitOffsetAt(orbit, 37);
    expect(at.x).toBe(off.x);
    expect(at.y).toBe(off.y);
  });

  it("is periodic modulo BOARD_PERIOD", () => {
    const orbit = makeOrbit({ x: 0, y: 0 }, 100, 0.1, 1);
    const a = orbitOffsetAt(orbit, 5);
    const b = orbitOffsetAt(orbit, 5 + BOARD_PERIOD);
    expect(b.x).toBe(a.x);
    expect(b.y).toBe(a.y);
  });

  it("orbitPositionAt adds the center", () => {
    const orbit = makeOrbit({ x: 300, y: 200 }, 80, 0, 1);
    expect(orbitPositionAt(orbit, 0)).toEqual({ x: 380, y: 200 });
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `pnpm --filter @apogee/engine exec vitest run campaign-orbit`
Expected: FAIL — cannot resolve `../src/campaign/orbit`.

- [ ] **Step 5: Implement orbit.ts**

Create `packages/engine/src/campaign/orbit.ts`:

```ts
import type { Vec2 } from "../types";
import { BOARD_PERIOD } from "./constants";
import type { Orbit } from "./types";

/** One fixed-step rotation of an orbit offset, renormalized to the radius.
 *  Pure: + − × ÷ sqrt only. */
export function advanceOrbit(
  off: Vec2,
  orbit: { cosStep: number; sinStep: number; radius: number },
): Vec2 {
  const nx = off.x * orbit.cosStep - off.y * orbit.sinStep;
  const ny = off.x * orbit.sinStep + off.y * orbit.cosStep;
  const len = Math.sqrt(nx * nx + ny * ny);
  return { x: (nx / len) * orbit.radius, y: (ny / len) * orbit.radius };
}

/** Offset at an absolute tick, reconstructed by stepping from offset0. Pure.
 *  Depends on `tick` only through `tick mod BOARD_PERIOD`. */
export function orbitOffsetAt(orbit: Orbit, tick: number): Vec2 {
  const k = (((tick | 0) % BOARD_PERIOD) + BOARD_PERIOD) % BOARD_PERIOD;
  let off = { x: orbit.offset0.x, y: orbit.offset0.y };
  for (let i = 0; i < k; i++) off = advanceOrbit(off, orbit);
  return off;
}

/** Absolute position (center + offset) at a tick. Pure. */
export function orbitPositionAt(orbit: Orbit, tick: number): Vec2 {
  const off = orbitOffsetAt(orbit, tick);
  return { x: orbit.center.x + off.x, y: orbit.center.y + off.y };
}

/** Authoring helper — trig is fine here; NEVER called in the sim loop.
 *  `phaseTurns` ∈ [0,1) start angle; `turnsPerPeriod` full orbits per BOARD_PERIOD
 *  (negative = reverse). */
export function makeOrbit(
  center: Vec2,
  radius: number,
  phaseTurns: number,
  turnsPerPeriod: number,
): Orbit {
  const step = (2 * Math.PI * turnsPerPeriod) / BOARD_PERIOD;
  const phase = 2 * Math.PI * phaseTurns;
  return {
    center,
    radius,
    offset0: { x: radius * Math.cos(phase), y: radius * Math.sin(phase) },
    cosStep: Math.cos(step),
    sinStep: Math.sin(step),
  };
}
```

- [ ] **Step 6: Export from the campaign barrel**

In `packages/engine/src/campaign/index.ts`, add:

```ts
export { BOARD_PERIOD } from "./constants";
export { advanceOrbit, makeOrbit, orbitOffsetAt, orbitPositionAt } from "./orbit";
```

- [ ] **Step 7: Run tests + typecheck**

Run: `pnpm --filter @apogee/engine exec vitest run campaign-orbit`
Expected: PASS (4 tests).
Run: `pnpm --filter @apogee/engine typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add packages/engine/src/campaign/constants.ts packages/engine/src/campaign/types.ts packages/engine/src/campaign/orbit.ts packages/engine/src/campaign/index.ts packages/engine/tests/campaign-orbit.test.ts
git commit -m "feat(engine): pure orbit math for moving bodies"
```

---

## Task 2: Portal math + portal types

**Files:**
- Modify: `packages/engine/src/campaign/constants.ts` (add portal constants)
- Modify: `packages/engine/src/campaign/types.ts` (add `Portal`, `portals?` on `Level`)
- Create: `packages/engine/src/campaign/portal.ts`
- Modify: `packages/engine/src/campaign/index.ts` (export portal helpers)
- Test: `packages/engine/tests/campaign-portal.test.ts`

**Interfaces:**
- Produces:
  - `interface Portal { pos: Vec2; radius: number; facing: Vec2; link: number }`
  - `rotateVec(v: Vec2, cos: number, sin: number): Vec2`
  - `portalExitRotation(entryFacing: Vec2, exitFacing: Vec2): { cos: number; sin: number }`
  - `makePortal(x: number, y: number, radius: number, facingDeg: number, link: number): Portal`
  - `PORTAL_COOLDOWN: number`, `PORTAL_EXIT_MARGIN: number`

- [ ] **Step 1: Add constants**

In `packages/engine/src/campaign/constants.ts`, append:

```ts
/** Steps a just-teleported probe ignores portals, so it can't instantly re-enter. */
export const PORTAL_COOLDOWN = 6;
/** Extra units past the exit mouth a probe is placed on teleport. */
export const PORTAL_EXIT_MARGIN = 2;
```

- [ ] **Step 2: Add portal types**

In `packages/engine/src/campaign/types.ts`, add above `Level`:

```ts
/** One mouth of a wormhole pair. `facing` is a unit vector — the direction a probe
 *  exits going. `link` is the index of the paired portal in `Level.portals`. */
export interface Portal {
  pos: Vec2;
  radius: number;
  facing: Vec2;
  link: number;
}
```

Then add `portals?: Portal[];` as the last field of `Level`.

- [ ] **Step 3: Write the failing test**

Create `packages/engine/tests/campaign-portal.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { makePortal, portalExitRotation, rotateVec } from "../src/campaign/portal";

describe("portal transform", () => {
  it("head-on entry exits straight along the far portal's facing", () => {
    const a = makePortal(400, 500, 30, 0, 1); // faces +x
    const b = makePortal(900, 500, 30, 90, 0); // faces +y
    const rot = portalExitRotation(a.facing, b.facing);
    // Entering A head-on means velocity opposite A.facing: (-1,0)·speed.
    const vout = rotateVec({ x: -200, y: 0 }, rot.cos, rot.sin);
    expect(vout.x).toBeCloseTo(0, 6);
    expect(vout.y).toBeCloseTo(200, 6);
  });

  it("preserves speed for an arbitrary entry", () => {
    const a = makePortal(0, 0, 20, 37, 1);
    const b = makePortal(100, 0, 20, 211, 0);
    const rot = portalExitRotation(a.facing, b.facing);
    const vin = { x: 123, y: -45 };
    const vout = rotateVec(vin, rot.cos, rot.sin);
    expect(Math.hypot(vout.x, vout.y)).toBeCloseTo(Math.hypot(vin.x, vin.y), 6);
  });

  it("makePortal builds a unit facing vector", () => {
    const p = makePortal(10, 20, 25, 90, 1);
    expect(p.facing.x).toBeCloseTo(0, 6);
    expect(p.facing.y).toBeCloseTo(1, 6);
    expect(Math.hypot(p.facing.x, p.facing.y)).toBeCloseTo(1, 6);
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `pnpm --filter @apogee/engine exec vitest run campaign-portal`
Expected: FAIL — cannot resolve `../src/campaign/portal`.

- [ ] **Step 5: Implement portal.ts**

Create `packages/engine/src/campaign/portal.ts`:

```ts
import type { Vec2 } from "../types";
import type { Portal } from "./types";

/** Rotate a vector by (cos,sin). Pure. */
export function rotateVec(v: Vec2, cos: number, sin: number): Vec2 {
  return { x: v.x * cos - v.y * sin, y: v.x * sin + v.y * cos };
}

/** (cos,sin) rotation turning a probe entering along `entryFacing` into one exiting
 *  along `exitFacing`: head-on entry (velocity = −entryFacing) exits as +exitFacing.
 *  Pure — dot/cross of the unit facings only, no trig. */
export function portalExitRotation(
  entryFacing: Vec2,
  exitFacing: Vec2,
): { cos: number; sin: number } {
  // R maps entryFacing → −exitFacing, hence −entryFacing → exitFacing.
  const cos = -(entryFacing.x * exitFacing.x + entryFacing.y * exitFacing.y);
  const sin = -(entryFacing.x * exitFacing.y - entryFacing.y * exitFacing.x);
  return { cos, sin };
}

/** Authoring helper — trig is fine here. `facingDeg`: 0 = +x, 90 = +y (canvas down). */
export function makePortal(
  x: number,
  y: number,
  radius: number,
  facingDeg: number,
  link: number,
): Portal {
  const r = (facingDeg * Math.PI) / 180;
  return { pos: { x, y }, radius, facing: { x: Math.cos(r), y: Math.sin(r) }, link };
}
```

- [ ] **Step 6: Export from the campaign barrel**

In `packages/engine/src/campaign/index.ts`, add:

```ts
export { PORTAL_COOLDOWN, PORTAL_EXIT_MARGIN } from "./constants";
export { makePortal, portalExitRotation, rotateVec } from "./portal";
```

- [ ] **Step 7: Run tests + typecheck**

Run: `pnpm --filter @apogee/engine exec vitest run campaign-portal`
Expected: PASS (3 tests).
Run: `pnpm --filter @apogee/engine typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add packages/engine/src/campaign/constants.ts packages/engine/src/campaign/types.ts packages/engine/src/campaign/portal.ts packages/engine/src/campaign/index.ts packages/engine/tests/campaign-portal.test.ts
git commit -m "feat(engine): pure portal transform math"
```

---

## Task 3: `launchTick` + campaign simulate rewrite (moving bodies, sensors, portals)

This rewrites `simulateCampaignLaunch` to advance moving geometry each step and teleport through portals, while staying byte-identical for levels with no orbits/portals.

**Files:**
- Modify: `packages/engine/src/types.ts` (add `launchTick?` to `LaunchInput`)
- Modify: `packages/engine/src/campaign/simulate.ts` (rewrite the loop)
- Test: `packages/engine/tests/campaign-moving.test.ts` (new)
- Verify unchanged: `packages/engine/tests/campaign-simulate.test.ts`, `campaign-golden.test.ts`

**Interfaces:**
- Consumes: `advanceOrbit`, `orbitOffsetAt` (Task 1); `portalExitRotation`, `rotateVec` (Task 2); `PORTAL_COOLDOWN`, `PORTAL_EXIT_MARGIN` (Task 2); existing `integrate`, `contacts`, `landOn`, `resolveCollisions`, `voidCheck` from `../physics`; `precisionPoints` from `./scoring`.
- Produces: `simulateCampaignLaunch(state, input, maxSteps?)` — same signature; now reads `input.launchTick ?? 0`.

- [ ] **Step 1: Add `launchTick` to `LaunchInput`**

In `packages/engine/src/types.ts`, change the `LaunchInput` interface to:

```ts
/** Raw drag vector from aiming; engine derives direction and clamped speed.
 *  `launchTick` is the board-clock tick a campaign launch fired on (moving fields);
 *  optional, defaults 0, ignored by the Daily engine and static levels. */
export interface LaunchInput {
  dx: number;
  dy: number;
  launchTick?: number;
}
```

- [ ] **Step 2: Write the failing test**

Create `packages/engine/tests/campaign-moving.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { makeOrbit } from "../src/campaign/orbit";
import { makePortal } from "../src/campaign/portal";
import { createLevel, simulateCampaignLaunch } from "../src/campaign/simulate";
import type { Level } from "../src/campaign/types";

const BOUNDS = { width: 1600, height: 1000 };
function base(partial: Partial<Level>): Level {
  return {
    id: "t", name: "t", bodies: [], keys: [], goal: undefined, targets: [],
    launchPos: { x: 80, y: 500 }, bounds: BOUNDS, launchBudget: 3,
    objectives: [], starThresholds: { two: 8, three: 13 }, ...partial,
  };
}

describe("moving bodies", () => {
  it("the field moves: different launch ticks give different flights", () => {
    const orbit = makeOrbit({ x: 800, y: 500 }, 150, 0, 1);
    const lvl = base({
      bodies: [{ pos: { x: 800, y: 500 }, radius: 40, mass: 1600, kind: "planet", orbit }],
    });
    const a = simulateCampaignLaunch(createLevel(lvl), { dx: 220, dy: -60, launchTick: 0 });
    const b = simulateCampaignLaunch(createLevel(lvl), { dx: 220, dy: -60, launchTick: 120 });
    expect(JSON.stringify(a.state.probes)).not.toBe(JSON.stringify(b.state.probes));
  });

  it("launchTick defaults to 0 and stays deterministic", () => {
    const orbit = makeOrbit({ x: 800, y: 500 }, 150, 0, 1);
    const lvl = base({
      bodies: [{ pos: { x: 800, y: 500 }, radius: 40, mass: 1600, kind: "planet", orbit }],
    });
    const a = simulateCampaignLaunch(createLevel(lvl), { dx: 220, dy: -60 });
    const b = simulateCampaignLaunch(createLevel(lvl), { dx: 220, dy: -60, launchTick: 0 });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
  });

  it("a probe can land on a moon (orbiting planet-kind body)", () => {
    // turnsPerPeriod 0 → a stationary body sitting at center+offset0 (radius 60 → x=460).
    const orbit = makeOrbit({ x: 400, y: 500 }, 60, 0, 0);
    const lvl = base({
      bodies: [{ pos: { x: 400, y: 500 }, radius: 50, mass: 2500, kind: "planet", orbit }],
    });
    const r = simulateCampaignLaunch(createLevel(lvl), { dx: 200, dy: 0 });
    expect(r.state.probes[0]!.state).toBe("landed");
  });

  it("a moving target is hit at its current position", () => {
    const orbit = makeOrbit({ x: 400, y: 500 }, 20, 0, 0); // parked at (420,500)
    const lvl = base({
      targets: [{ pos: { x: 400, y: 500 }, radius: 30, orbit }],
      objectives: [{ kind: "hit-all-targets" }],
    });
    const r = simulateCampaignLaunch(createLevel(lvl), { dx: 200, dy: 0 });
    expect(r.state.targetsHit).toEqual([true]);
  });
});

describe("wormholes in simulate", () => {
  it("teleports a probe to the paired portal, exiting along its facing at the same speed", () => {
    const lvl = base({
      portals: [makePortal(400, 500, 30, 180, 1), makePortal(1000, 300, 30, 90, 0)],
    });
    const r = simulateCampaignLaunch(createLevel(lvl), { dx: 200, dy: 0 }); // speed 600
    const f = r.trace.map((fr) => fr[0]!);
    // After teleport the probe sits at x≈1000 (no gravity) moving +y.
    const i = f.findIndex((p) => p.x > 950 && p.x < 1050);
    expect(i).toBeGreaterThan(0);
    const d = Math.hypot(f[i + 1]!.x - f[i]!.x, f[i + 1]!.y - f[i]!.y);
    expect(d).toBeCloseTo(600 / 60, 3); // MAX_SPEED · DT — speed preserved
    expect(Math.abs(f[i + 1]!.x - f[i]!.x)).toBeLessThan(1e-6); // moving straight +y
  });

  it("resolves rather than trapping when portals are far apart", () => {
    const lvl = base({
      portals: [makePortal(400, 500, 30, 180, 1), makePortal(1000, 300, 30, 90, 0)],
    });
    const r = simulateCampaignLaunch(createLevel(lvl), { dx: 200, dy: 0 });
    expect(r.state.probes[0]!.state).not.toBe("flying");
    expect(r.trace.length).toBeLessThan(500);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm --filter @apogee/engine exec vitest run campaign-moving`
Expected: FAIL — moving/portal behavior not implemented (moon body doesn't move; no teleport).

- [ ] **Step 4: Rewrite simulate.ts**

Replace the entire body of `packages/engine/src/campaign/simulate.ts` with:

```ts
import { MAX_SPEED, MAX_STEPS, POWER_SCALE, PROBE_RADIUS } from "../constants";
import { contacts, integrate, landOn, resolveCollisions, voidCheck } from "../physics";
import type { LaunchInput, Probe, ProbeFrame, Vec2 } from "../types";
import { PORTAL_COOLDOWN, PORTAL_EXIT_MARGIN } from "./constants";
import { advanceOrbit, orbitOffsetAt } from "./orbit";
import { portalExitRotation, rotateVec } from "./portal";
import { precisionPoints } from "./scoring";
import type { CampaignLevelState, Level, Orbit, SensorEvent } from "./types";

export function createLevel(level: Level): CampaignLevelState {
  return {
    level,
    probes: [],
    launchesUsed: 0,
    keysCollected: level.keys.map(() => false),
    targetsHit: level.targets.map(() => false),
    goalReached: false,
    bestPrecision: 0,
  };
}

function cloneProbe(p: Probe): Probe {
  return { pos: { ...p.pos }, vel: { ...p.vel }, state: p.state };
}

function within(probe: Probe, cx: number, cy: number, reach: number): boolean {
  const dx = probe.pos.x - cx;
  const dy = probe.pos.y - cy;
  return Math.sqrt(dx * dx + dy * dy) <= reach;
}

function distTo(probe: Probe, cx: number, cy: number): number {
  const dx = probe.pos.x - cx;
  const dy = probe.pos.y - cy;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Mutable working geometry whose position advances each step when `orbit` is set. */
interface Moving {
  pos: Vec2;
  orbit: Orbit | null;
  off: Vec2 | null;
}

function initMoving(pos: Vec2, orbit: Orbit | undefined, launchTick: number): Moving {
  if (!orbit) return { pos: { x: pos.x, y: pos.y }, orbit: null, off: null };
  const off = orbitOffsetAt(orbit, launchTick);
  return { pos: { x: orbit.center.x + off.x, y: orbit.center.y + off.y }, orbit, off };
}

function stepMoving(m: Moving): void {
  if (!m.orbit || !m.off) return;
  m.off = advanceOrbit(m.off, m.orbit);
  m.pos.x = m.orbit.center.x + m.off.x;
  m.pos.y = m.orbit.center.y + m.off.y;
}

/**
 * Run one campaign launch to completion (or maxSteps). Pure: returns new state.
 * Extends the daily physics loop with: moving bodies/sensors (orbits), blocker
 * death, a sensor pass (keys → targets → goal), and wormhole teleports. Levels
 * with no orbits and no portals reduce to the original static loop byte-for-byte.
 */
export function simulateCampaignLaunch(
  state: CampaignLevelState,
  input: LaunchInput,
  maxSteps: number = MAX_STEPS,
): { state: CampaignLevelState; trace: ProbeFrame[][]; events: SensorEvent[] } {
  const level = state.level;
  const launchTick = input.launchTick ?? 0;
  const len = Math.sqrt(input.dx * input.dx + input.dy * input.dy);
  const speed = Math.min(len * POWER_SCALE, MAX_SPEED);
  const probes = state.probes.map(cloneProbe);
  probes.push({
    pos: { ...level.launchPos },
    vel:
      len === 0
        ? { x: 0, y: 0 }
        : { x: (input.dx / len) * speed, y: (input.dy / len) * speed },
    state: "flying",
  });

  const keysCollected = state.keysCollected.slice();
  const targetsHit = state.targetsHit.slice();
  let goalReached = state.goalReached;
  let bestPrecision = state.bestPrecision;

  // Working geometry (positions advance each step when orbiting).
  const bodies = level.bodies.map((b) => ({
    kind: b.kind,
    radius: b.radius,
    mass: b.mass,
    m: initMoving(b.pos, b.orbit, launchTick),
  }));
  const gravBodies = bodies.map((b) => ({ pos: b.m.pos, radius: b.radius, mass: b.mass }));
  const keyM = level.keys.map((k) => initMoving(k.pos, k.orbit, launchTick));
  const targetM = level.targets.map((t) => initMoving(t.pos, t.orbit, launchTick));

  // Portals: precompute the entry→exit velocity rotation (pure, no trig).
  const portals = level.portals ?? [];
  const portalRot = portals.map((p) => portalExitRotation(p.facing, portals[p.link]!.facing));
  const cooldown = probes.map(() => 0);

  const trace: ProbeFrame[][] = [];
  const events: SensorEvent[] = [];

  for (let step = 0; step < maxSteps; step++) {
    // 1. Integrate flying probes over the CURRENT (possibly moved) bodies.
    for (const probe of probes) {
      if (probe.state === "flying") integrate(gravBodies, probe);
    }
    // 2. Body contact: land on planets/moons, die on blockers.
    for (const probe of probes) {
      if (probe.state !== "flying") continue;
      for (let bi = 0; bi < gravBodies.length; bi++) {
        const gb = gravBodies[bi]!;
        if (!contacts(gb, probe)) continue;
        if (bodies[bi]!.kind === "blocker") probe.state = "lost";
        else landOn(gb, probe);
        break;
      }
    }
    // 3. Sensors (keys → targets → goal), read at their current positions.
    for (const probe of probes) {
      if (probe.state === "lost") continue;
      keyM.forEach((k, i) => {
        if (!keysCollected[i] && within(probe, k.pos.x, k.pos.y, level.keys[i]!.radius + PROBE_RADIUS)) {
          keysCollected[i] = true;
          events.push({ step, type: "key", index: i });
        }
      });
      targetM.forEach((t, i) => {
        if (!targetsHit[i] && within(probe, t.pos.x, t.pos.y, level.targets[i]!.radius + PROBE_RADIUS)) {
          targetsHit[i] = true;
          bestPrecision = Math.max(bestPrecision, precisionPoints(distTo(probe, t.pos.x, t.pos.y)));
          events.push({ step, type: "target", index: i });
        }
      });
      if (level.goal && !goalReached && keysCollected.every(Boolean)) {
        if (within(probe, level.goal.pos.x, level.goal.pos.y, level.goal.radius + PROBE_RADIUS)) {
          goalReached = true;
          bestPrecision = Math.max(bestPrecision, precisionPoints(distTo(probe, level.goal.pos.x, level.goal.pos.y)));
          events.push({ step, type: "goal", index: 0 });
        }
      }
    }
    // 4. Wormholes: teleport a flying probe entering a mouth (with re-entry guard).
    if (portals.length) {
      for (let pi = 0; pi < probes.length; pi++) {
        const probe = probes[pi]!;
        if (probe.state !== "flying") continue;
        if (cooldown[pi]! > 0) {
          cooldown[pi]!--;
          continue;
        }
        for (let k = 0; k < portals.length; k++) {
          const p = portals[k]!;
          if (!within(probe, p.pos.x, p.pos.y, p.radius + PROBE_RADIUS)) continue;
          const exit = portals[p.link]!;
          const rv = rotateVec(probe.vel, portalRot[k]!.cos, portalRot[k]!.sin);
          probe.vel.x = rv.x;
          probe.vel.y = rv.y;
          probe.pos.x = exit.pos.x + exit.facing.x * (exit.radius + PROBE_RADIUS + PORTAL_EXIT_MARGIN);
          probe.pos.y = exit.pos.y + exit.facing.y * (exit.radius + PROBE_RADIUS + PORTAL_EXIT_MARGIN);
          cooldown[pi] = PORTAL_COOLDOWN;
          break;
        }
      }
    }
    // 5. Probe-probe collisions, then void check.
    resolveCollisions(probes);
    for (const probe of probes) voidCheck(level.bounds, probe);

    trace.push(probes.map((p) => ({ x: p.pos.x, y: p.pos.y, state: p.state })));
    if (probes.every((p) => p.state !== "flying")) break;

    // 6. Advance moving geometry one step for the NEXT step.
    for (const b of bodies) stepMoving(b.m);
    for (const k of keyM) stepMoving(k);
    for (const t of targetM) stepMoving(t);
  }
  for (const p of probes) if (p.state === "flying") p.state = "lost";

  return {
    state: {
      level,
      probes,
      launchesUsed: state.launchesUsed + 1,
      keysCollected,
      targetsHit,
      goalReached,
      bestPrecision,
    },
    trace,
    events,
  };
}
```

Note: `gravBodies[bi].pos` is the SAME object as `bodies[bi].m.pos`, so Step 6's mutation is visible to `integrate`/`contacts` next step. For a static level, `initMoving` copies the position, no `stepMoving` fires, portals are empty — the loop is numerically identical to the previous implementation.

- [ ] **Step 5: Run the new test**

Run: `pnpm --filter @apogee/engine exec vitest run campaign-moving`
Expected: PASS (6 tests).

- [ ] **Step 6: Verify static behavior is byte-identical**

Run: `pnpm --filter @apogee/engine exec vitest run campaign-simulate campaign-golden`
Expected: PASS — existing simulate tests and the existing golden snapshot are unchanged (no snapshot update prompt).

- [ ] **Step 7: Full engine suite + typecheck**

Run: `pnpm --filter @apogee/engine test`
Expected: all pass, no snapshots written.
Run: `pnpm --filter @apogee/engine typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add packages/engine/src/types.ts packages/engine/src/campaign/simulate.ts packages/engine/tests/campaign-moving.test.ts
git commit -m "feat(engine): simulate moving bodies, moving sensors, and wormholes"
```

---

## Task 4: Moving-level golden + determinism lock

**Files:**
- Modify: `packages/engine/tests/campaign-golden.test.ts` (add a moving+portal case; keep existing cases)
- Generated: `packages/engine/tests/__snapshots__/campaign-golden.test.ts.snap` (new entry, appended by Vitest)

**Interfaces:**
- Consumes: `makeOrbit`, `makePortal`, `createLevel`, `simulateCampaignLaunch`, `evaluateObjectives`, `starRating`.

- [ ] **Step 1: Add the moving golden case**

Append to `packages/engine/tests/campaign-golden.test.ts` — add the two imports at the top (`makeOrbit`, `makePortal`) and a new `describe` block. Do NOT touch the existing `LEVEL`, `INPUTS`, or the existing `describe`.

At the top, add:

```ts
import { makeOrbit } from "../src/campaign/orbit";
import { makePortal } from "../src/campaign/portal";
```

At the bottom, add:

```ts
/** A fixed moving level: an orbiting moon plus a wormhole pair, reach the goal. */
const MOVING_LEVEL: Level = {
  id: "golden-moving",
  name: "Golden Moving",
  bodies: [
    { pos: { x: 800, y: 500 }, radius: 60, mass: 3600, kind: "planet", orbit: makeOrbit({ x: 800, y: 500 }, 150, 0, 1) },
  ],
  keys: [],
  goal: { pos: { x: 1200, y: 500 }, radius: 40 },
  targets: [],
  portals: [makePortal(500, 500, 30, 180, 1), makePortal(1000, 500, 30, 0, 0)],
  launchPos: { x: 80, y: 500 },
  bounds: { width: 1600, height: 1000 },
  launchBudget: 3,
  objectives: [{ kind: "reach-goal" }],
  starThresholds: { two: 6, three: 11 },
};

const MOVING_INPUTS = [
  { dx: 120, dy: -20, launchTick: 0 },
  { dx: 90, dy: -40, launchTick: 60 },
];

describe("campaign golden replay — moving", () => {
  it("a fixed moving level + timed inputs matches the locked snapshot", () => {
    let s = createLevel(MOVING_LEVEL);
    for (const input of MOVING_INPUTS) s = simulateCampaignLaunch(s, input).state;
    const summary = {
      probes: s.probes,
      goalReached: s.goalReached,
      bestPrecision: s.bestPrecision,
      cleared: evaluateObjectives(s).cleared,
      stars: starRating(s).stars,
    };
    expect(summary).toMatchSnapshot();
  });

  it("replaying twice is byte-identical (determinism)", () => {
    const run = () => {
      let s = createLevel(MOVING_LEVEL);
      for (const input of MOVING_INPUTS) s = simulateCampaignLaunch(s, input).state;
      return JSON.stringify(s);
    };
    expect(run()).toBe(run());
  });
});
```

- [ ] **Step 2: Generate the snapshot**

Run: `pnpm --filter @apogee/engine exec vitest run campaign-golden`
Expected: PASS — Vitest writes 1 new snapshot for `golden-moving` and both `it`s pass. The pre-existing `campaign golden replay` snapshot is unchanged.

- [ ] **Step 3: Confirm re-run is stable**

Run: `pnpm --filter @apogee/engine exec vitest run campaign-golden`
Expected: PASS, "0 written" — proves the snapshot is stable/deterministic.

- [ ] **Step 4: Commit**

```bash
git add packages/engine/tests/campaign-golden.test.ts packages/engine/tests/__snapshots__/campaign-golden.test.ts.snap
git commit -m "test(engine): golden + determinism lock for a moving level"
```

---

## Task 5: Solvability infrastructure (stored solutions, not extended brute force)

Moving/portal levels are validated by replaying a stored known-good solution; static levels keep the brute-force solver. A dev-only, env-gated discovery test prints solutions to paste in.

**Files:**
- Modify: `packages/engine/src/campaign/levels.ts` (add + export `isMovingLevel`)
- Create: `packages/engine/src/campaign/solutions.ts`
- Modify: `packages/engine/src/campaign/index.ts` (export `isMovingLevel`, `SOLUTIONS`)
- Create: `packages/engine/tests/campaign-solver-timed.ts` (dev tool, not a `.test.ts`)
- Create: `packages/engine/tests/discover-solutions.test.ts` (env-gated)
- Modify: `packages/engine/tests/campaign-levels.test.ts` (split static vs moving)

**Interfaces:**
- Produces:
  - `isMovingLevel(level: Level): boolean`
  - `SOLUTIONS: Record<string, LaunchInput[]>`
  - `findTimedSolution(level: Level): LaunchInput[] | null`

- [ ] **Step 1: Add `isMovingLevel`**

In `packages/engine/src/campaign/levels.ts`, add above `export const LEVELS` (and keep the existing `import type { Level }`):

```ts
/** True when a level has any orbiting body/sensor or any wormhole — i.e. it needs
 *  a timed, replayed solution rather than the static brute-force solver. */
export function isMovingLevel(level: Level): boolean {
  return (
    level.bodies.some((b) => b.orbit != null) ||
    level.keys.some((k) => k.orbit != null) ||
    level.targets.some((t) => t.orbit != null) ||
    (level.portals?.length ?? 0) > 0
  );
}
```

- [ ] **Step 2: Create the solutions store**

Create `packages/engine/src/campaign/solutions.ts`:

```ts
import type { LaunchInput } from "../types";

/**
 * Known-good clearing input sequences (≥1★) for moving/portal levels, keyed by
 * level id. Filled by running the discovery tool:
 *   $env:SOLVE=1; pnpm --filter @apogee/engine exec vitest run discover-solutions
 * then pasting the printed sequences here. CI only REPLAYS these.
 */
export const SOLUTIONS: Record<string, LaunchInput[]> = {};
```

- [ ] **Step 3: Export from the barrel**

In `packages/engine/src/campaign/index.ts`, add:

```ts
export { LEVELS, isMovingLevel } from "./levels";
export { SOLUTIONS } from "./solutions";
```

Then REMOVE the now-duplicated `export { LEVELS } from "./levels";` line that already exists so `LEVELS` is exported exactly once.

- [ ] **Step 4: Create the timed discovery tool**

Create `packages/engine/tests/campaign-solver-timed.ts`:

```ts
import { BOARD_PERIOD } from "../src/campaign/constants";
import { evaluateObjectives } from "../src/campaign/objectives";
import { createLevel, simulateCampaignLaunch } from "../src/campaign/simulate";
import type { CampaignLevelState, Level } from "../src/campaign/types";
import type { LaunchInput } from "../src/types";

// Trig + broad search allowed HERE: dev authoring tool, never CI, never the sim loop.
const DIRECTIONS = 72;
const POWERS = [40, 70, 100, 140, 180, 220, 260];
const TICKS = Array.from({ length: 16 }, (_, i) => Math.round((i / 16) * BOARD_PERIOD));

function candidates(): LaunchInput[] {
  const out: LaunchInput[] = [];
  for (let d = 0; d < DIRECTIONS; d++) {
    const t = (d / DIRECTIONS) * Math.PI * 2;
    for (const p of POWERS) {
      for (const tick of TICKS) {
        out.push({ dx: Math.cos(t) * p, dy: Math.sin(t) * p, launchTick: tick });
      }
    }
  }
  return out;
}

function progress(s: CampaignLevelState): number {
  return (
    s.keysCollected.filter(Boolean).length +
    s.targetsHit.filter(Boolean).length +
    (s.goalReached ? 1 : 0)
  );
}

function signature(s: CampaignLevelState): number {
  let bits = 0;
  let i = 0;
  for (const k of s.keysCollected) { if (k) bits |= 1 << i; i++; }
  for (const t of s.targetsHit) { if (t) bits |= 1 << i; i++; }
  if (s.goalReached) bits |= 1 << i;
  return bits;
}

/** Greedy progress-pruned BFS over (dx,dy,launchTick). Returns a clearing sequence
 *  within budget, or null. Same shape as the static solver, plus the tick axis. */
export function findTimedSolution(level: Level): LaunchInput[] | null {
  const cands = candidates();
  let frontier: { state: CampaignLevelState; seq: LaunchInput[] }[] = [
    { state: createLevel(level), seq: [] },
  ];
  for (let depth = 0; depth < level.launchBudget; depth++) {
    const next: typeof frontier = [];
    const seen = new Set<number>();
    for (const node of frontier) {
      const bestBySig = new Map<number, boolean>();
      const baseProg = progress(node.state);
      for (const input of cands) {
        const res = simulateCampaignLaunch(node.state, input);
        if (evaluateObjectives(res.state).cleared) return [...node.seq, input];
        if (progress(res.state) > baseProg) {
          const sig = signature(res.state);
          if (!seen.has(sig) && !bestBySig.has(sig)) {
            bestBySig.set(sig, true);
            seen.add(sig);
            next.push({ state: res.state, seq: [...node.seq, input] });
          }
        }
      }
    }
    if (next.length === 0) break;
    frontier = next;
  }
  return null;
}
```

- [ ] **Step 5: Create the env-gated discovery test**

Create `packages/engine/tests/discover-solutions.test.ts`:

```ts
import { describe, it } from "vitest";
import { LEVELS, isMovingLevel } from "../src/campaign/levels";
import { SOLUTIONS } from "../src/campaign/solutions";
import { findTimedSolution } from "./campaign-solver-timed";

// Skipped in CI. Run to print solutions to paste into src/campaign/solutions.ts:
//   $env:SOLVE=1; pnpm --filter @apogee/engine exec vitest run discover-solutions
describe.skipIf(!process.env.SOLVE)("discover solutions for moving levels", () => {
  it("prints a clearing sequence for each moving level lacking one", () => {
    for (const lvl of LEVELS) {
      if (!isMovingLevel(lvl) || SOLUTIONS[lvl.id]) continue;
      const sol = findTimedSolution(lvl);
      // eslint-disable-next-line no-console
      console.log(`"${lvl.id}":`, sol ? JSON.stringify(sol) + "," : "UNSOLVABLE — adjust layout/budget");
    }
  });
});
```

- [ ] **Step 6: Split the solvability test (static brute force vs moving replay)**

Replace `packages/engine/tests/campaign-levels.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import { LEVELS, isMovingLevel } from "../src/campaign/levels";
import { evaluateObjectives } from "../src/campaign/objectives";
import { createLevel, simulateCampaignLaunch } from "../src/campaign/simulate";
import { SOLUTIONS } from "../src/campaign/solutions";
import { findSolution } from "./campaign-solver";

describe("authored levels", () => {
  it("every level has a unique id", () => {
    const ids = LEVELS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every level declares at least one objective with the data it needs", () => {
    for (const lvl of LEVELS) {
      expect(lvl.objectives.length).toBeGreaterThan(0);
      for (const o of lvl.objectives) {
        if (o.kind === "reach-goal") expect(lvl.goal, lvl.id).toBeDefined();
        if (o.kind === "hit-all-targets") expect(lvl.targets.length, lvl.id).toBeGreaterThan(0);
      }
    }
  });

  it("every portal links to a valid, mutually-paired portal", () => {
    for (const lvl of LEVELS) {
      const ps = lvl.portals ?? [];
      ps.forEach((p, i) => {
        expect(p.link, `${lvl.id} portal ${i} link`).toBeGreaterThanOrEqual(0);
        expect(p.link, `${lvl.id} portal ${i} link`).toBeLessThan(ps.length);
        expect(ps[p.link]!.link, `${lvl.id} portal ${i} pairing`).toBe(i);
      });
    }
  });

  it("every STATIC level is solvable within its launch budget (brute force)", () => {
    for (const lvl of LEVELS) {
      if (isMovingLevel(lvl)) continue;
      const solution = findSolution(lvl);
      expect(solution, `level ${lvl.id} is unsolvable — adjust its layout`).not.toBeNull();
      expect(solution!.length, lvl.id).toBeLessThanOrEqual(lvl.launchBudget);
    }
  });

  it("every MOVING level clears when its stored solution is replayed", () => {
    for (const lvl of LEVELS) {
      if (!isMovingLevel(lvl)) continue;
      const seq = SOLUTIONS[lvl.id];
      expect(seq, `no stored solution for ${lvl.id} — run SOLVE=1 discover-solutions`).toBeDefined();
      expect(seq!.length, `${lvl.id} solution exceeds budget`).toBeLessThanOrEqual(lvl.launchBudget);
      let s = createLevel(lvl);
      for (const input of seq!) s = simulateCampaignLaunch(s, input).state;
      expect(evaluateObjectives(s).cleared, `stored solution for ${lvl.id} no longer clears`).toBe(true);
    }
  });
});
```

- [ ] **Step 7: Run the suite + typecheck**

Run: `pnpm --filter @apogee/engine test`
Expected: PASS. No moving levels exist yet, so the moving-replay test loops zero times; all 15 static levels still solve. `discover-solutions` is skipped.
Run: `pnpm --filter @apogee/engine typecheck`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add packages/engine/src/campaign/levels.ts packages/engine/src/campaign/solutions.ts packages/engine/src/campaign/index.ts packages/engine/tests/campaign-solver-timed.ts packages/engine/tests/discover-solutions.test.ts packages/engine/tests/campaign-levels.test.ts
git commit -m "test(engine): stored-solution solvability for moving levels"
```

---

## Task 6: Chapter 6 — Moons introduced (levels 16–18)

Coordinates below are validated starting points: authored in the existing house style (launch `{80,500}`, world `1600×1000`, sun/planet radii 60–96). Each level must clear via a discovered solution; if the discovery tool reports UNSOLVABLE, nudge the layout per the guidance and re-run.

**Files:**
- Modify: `packages/engine/src/campaign/levels.ts` (add `moon()` helper + imports; append 3 levels)
- Modify: `packages/engine/src/campaign/solutions.ts` (record 3 solutions)

**Interfaces:**
- Consumes: `makeOrbit` (Task 1); `findTimedSolution`/discovery (Task 5).
- Produces: level ids `6-1`, `6-2`, `6-3` in `LEVELS`; their entries in `SOLUTIONS`.

- [ ] **Step 1: Add the moon helper + imports**

In `packages/engine/src/campaign/levels.ts`, add to the imports:

```ts
import { makeOrbit } from "./orbit";
import type { Body } from "./types";
```

(keep the existing `import type { Level } from "./types";` — or merge into one `import type { Body, Level } from "./types";`.)

Add this helper next to `planet`/`blocker`:

```ts
/** A planet-kind body that orbits `(cx,cy)` — landable, gravitating, and moving. */
function moon(
  cx: number, cy: number, radius: number,
  orbitRadius: number, phaseTurns: number, turnsPerPeriod: number,
): Body {
  return {
    pos: { x: cx, y: cy },
    radius,
    mass: radius * radius,
    kind: "planet",
    orbit: makeOrbit({ x: cx, y: cy }, orbitRadius, phaseTurns, turnsPerPeriod),
  };
}
```

- [ ] **Step 2: Append the three levels**

Add to the end of the `LEVELS` array (before the closing `];`):

```ts
  // --- Chapter 6: orbiting moons, reach the goal (16-18) ---
  {
    id: "6-1", name: "Moonrise",
    bodies: [planet(800, 520, 70), moon(800, 520, 34, 200, 0, 1)],
    keys: [], goal: { pos: { x: 1250, y: 360 }, radius: 40 }, targets: [],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 4,
    objectives: [{ kind: "reach-goal" }], starThresholds: { two: 6, three: 11 },
  },
  {
    id: "6-2", name: "Slingshot Tide",
    bodies: [planet(760, 500, 80), moon(760, 500, 30, 190, 0.5, 1)],
    keys: [], goal: { pos: { x: 700, y: 720 }, radius: 38 }, targets: [],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 4,
    objectives: [{ kind: "reach-goal" }], starThresholds: { two: 6, three: 11 },
  },
  {
    id: "6-3", name: "Twin Moons",
    bodies: [planet(820, 500, 64), moon(820, 500, 28, 160, 0, 1), moon(820, 500, 28, 160, 0.5, -1)],
    keys: [], goal: { pos: { x: 1300, y: 520 }, radius: 38 }, targets: [],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 5,
    objectives: [{ kind: "reach-goal" }], starThresholds: { two: 6, three: 11 },
  },
```

- [ ] **Step 3: Discover solutions**

Run: `$env:SOLVE=1; pnpm --filter @apogee/engine exec vitest run discover-solutions; Remove-Item Env:SOLVE`
Expected: console prints a line per new level, e.g. `"6-1": [{"dx":...,"dy":...,"launchTick":...}],`.

If any line prints `UNSOLVABLE`, adjust that level and re-run: widen `launchBudget` by 1, move the goal 40–80 units toward open space, shrink the moon's `orbitRadius`, or reduce a moon's `radius`. Re-run until all three print a sequence.

- [ ] **Step 4: Record the solutions**

Paste the printed lines into `SOLUTIONS` in `packages/engine/src/campaign/solutions.ts`:

```ts
export const SOLUTIONS: Record<string, LaunchInput[]> = {
  "6-1": [/* pasted */],
  "6-2": [/* pasted */],
  "6-3": [/* pasted */],
};
```

- [ ] **Step 5: Verify replay clears**

Run: `pnpm --filter @apogee/engine exec vitest run campaign-levels`
Expected: PASS — the moving-replay test finds a stored solution for `6-1`/`6-2`/`6-3` and each clears within budget.

- [ ] **Step 6: Typecheck + commit**

Run: `pnpm --filter @apogee/engine typecheck`
Expected: no errors.

```bash
git add packages/engine/src/campaign/levels.ts packages/engine/src/campaign/solutions.ts
git commit -m "feat(engine): campaign chapter 6 — orbiting moons (16-18)"
```

---

## Task 7: Chapter 7 — Moons + old mechanics (levels 19–21)

Introduces a blocker, an orbiting key, and an orbiting target alongside moons.

**Files:**
- Modify: `packages/engine/src/campaign/levels.ts` (append 3 levels)
- Modify: `packages/engine/src/campaign/solutions.ts` (record 3 solutions)

**Interfaces:**
- Consumes: `makeOrbit` (already imported in Task 6), existing `blocker`/`planet`/`moon`.
- Produces: ids `7-1`, `7-2`, `7-3` in `LEVELS` + `SOLUTIONS`.

- [ ] **Step 1: Append the three levels**

Add to the end of `LEVELS`:

```ts
  // --- Chapter 7: moons meet blockers/keys/targets (19-21) ---
  {
    id: "7-1", name: "Moon & Guard",
    bodies: [blocker(560, 500, 60), planet(1050, 520, 76), moon(1050, 520, 30, 170, 0, 1)],
    keys: [], goal: { pos: { x: 1230, y: 360 }, radius: 40 }, targets: [],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 5,
    objectives: [{ kind: "reach-goal" }], starThresholds: { two: 6, three: 11 },
  },
  {
    id: "7-2", name: "Keyed Orbit",
    bodies: [planet(820, 520, 76)],
    keys: [{ pos: { x: 820, y: 520 }, radius: 26, orbit: makeOrbit({ x: 820, y: 520 }, 210, 0, 1) }],
    goal: { pos: { x: 1250, y: 360 }, radius: 38 }, targets: [],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 4,
    objectives: [{ kind: "reach-goal" }], starThresholds: { two: 6, three: 11 },
  },
  {
    id: "7-3", name: "Moving Marks",
    bodies: [planet(760, 420, 70), planet(1040, 660, 72)],
    keys: [], goal: undefined,
    targets: [
      { pos: { x: 1220, y: 360 }, radius: 26 },
      { pos: { x: 760, y: 420 }, radius: 24, orbit: makeOrbit({ x: 760, y: 420 }, 170, 0, 1) },
    ],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 5,
    objectives: [{ kind: "hit-all-targets" }], starThresholds: { two: 6, three: 11 },
  },
```

- [ ] **Step 2: Discover, record, verify**

Run: `$env:SOLVE=1; pnpm --filter @apogee/engine exec vitest run discover-solutions; Remove-Item Env:SOLVE`
Paste the `7-1`/`7-2`/`7-3` lines into `SOLUTIONS`. Adjust any UNSOLVABLE level (guidance in Task 6 Step 3; for `7-1` also try moving the blocker off the launch→planet line).

Run: `pnpm --filter @apogee/engine exec vitest run campaign-levels`
Expected: PASS.

- [ ] **Step 3: Typecheck + commit**

Run: `pnpm --filter @apogee/engine typecheck`
Expected: no errors.

```bash
git add packages/engine/src/campaign/levels.ts packages/engine/src/campaign/solutions.ts
git commit -m "feat(engine): campaign chapter 7 — moons + old mechanics (19-21)"
```

---

## Task 8: Chapter 8 — Wormholes introduced (levels 22–24)

**Files:**
- Modify: `packages/engine/src/campaign/levels.ts` (add `makePortal` import; append 3 levels)
- Modify: `packages/engine/src/campaign/solutions.ts` (record 3 solutions)

**Interfaces:**
- Consumes: `makePortal` (Task 2). Portal facings: `0`=+x, `90`=+y (down), `180`=−x, `270`=up. `link` indices are relative to each level's own `portals` array (pair 0↔1).
- Produces: ids `8-1`, `8-2`, `8-3` in `LEVELS` + `SOLUTIONS`.

- [ ] **Step 1: Import makePortal**

In `packages/engine/src/campaign/levels.ts` imports, add:

```ts
import { makePortal } from "./portal";
```

- [ ] **Step 2: Append the three levels**

Add to the end of `LEVELS`:

```ts
  // --- Chapter 8: wormholes, reach the goal (22-24) ---
  {
    id: "8-1", name: "Through the Door",
    bodies: [planet(820, 700, 64)],
    keys: [], goal: { pos: { x: 1360, y: 300 }, radius: 40 }, targets: [],
    portals: [makePortal(520, 470, 32, 200, 1), makePortal(1150, 360, 32, 340, 0)],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 4,
    objectives: [{ kind: "reach-goal" }], starThresholds: { two: 6, three: 11 },
  },
  {
    id: "8-2", name: "Bent Passage",
    bodies: [planet(640, 360, 80), planet(1080, 640, 72)],
    keys: [], goal: { pos: { x: 1360, y: 640 }, radius: 38 }, targets: [],
    portals: [makePortal(760, 560, 30, 160, 1), makePortal(1200, 420, 30, 20, 0)],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 4,
    objectives: [{ kind: "reach-goal" }], starThresholds: { two: 6, three: 11 },
  },
  {
    id: "8-3", name: "Redirect",
    bodies: [blocker(900, 500, 64)],
    keys: [], goal: { pos: { x: 1150, y: 720 }, radius: 40 }, targets: [],
    portals: [makePortal(560, 560, 30, 120, 1), makePortal(1150, 260, 30, 90, 0)],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 5,
    objectives: [{ kind: "reach-goal" }], starThresholds: { two: 6, three: 11 },
  },
```

- [ ] **Step 3: Discover, record, verify**

Run: `$env:SOLVE=1; pnpm --filter @apogee/engine exec vitest run discover-solutions; Remove-Item Env:SOLVE`
Paste `8-1`/`8-2`/`8-3` into `SOLUTIONS`. If a level is UNSOLVABLE, rotate a portal facing by 20–40° toward the goal, move portal B nearer the goal, or widen a portal `radius` to 34–40 so the entry is easier to hit.

Run: `pnpm --filter @apogee/engine exec vitest run campaign-levels`
Expected: PASS.

- [ ] **Step 4: Typecheck + commit**

Run: `pnpm --filter @apogee/engine typecheck`
Expected: no errors.

```bash
git add packages/engine/src/campaign/levels.ts packages/engine/src/campaign/solutions.ts
git commit -m "feat(engine): campaign chapter 8 — wormholes (22-24)"
```

---

## Task 9: Chapter 9 — Wormholes + old mechanics (levels 25–27)

**Files:**
- Modify: `packages/engine/src/campaign/levels.ts` (append 3 levels)
- Modify: `packages/engine/src/campaign/solutions.ts` (record 3 solutions)

**Interfaces:**
- Consumes: `makePortal`, `planet`, `blocker`. Produces ids `9-1`, `9-2`, `9-3`.

- [ ] **Step 1: Append the three levels**

Add to the end of `LEVELS`:

```ts
  // --- Chapter 9: wormholes meet keys/targets/blockers (25-27) ---
  {
    id: "9-1", name: "Portal Key",
    bodies: [planet(820, 520, 72)],
    keys: [{ pos: { x: 460, y: 300 }, radius: 26 }],
    goal: { pos: { x: 1360, y: 300 }, radius: 38 }, targets: [],
    portals: [makePortal(1000, 560, 30, 160, 1), makePortal(1280, 360, 30, 10, 0)],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 5,
    objectives: [{ kind: "reach-goal" }], starThresholds: { two: 6, three: 11 },
  },
  {
    id: "9-2", name: "Split Marks",
    bodies: [planet(760, 500, 70)],
    keys: [], goal: undefined,
    targets: [{ pos: { x: 1300, y: 700 }, radius: 24 }, { pos: { x: 1000, y: 300 }, radius: 24 }],
    portals: [makePortal(560, 360, 30, 150, 1), makePortal(1180, 700, 30, 330, 0)],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 5,
    objectives: [{ kind: "hit-all-targets" }], starThresholds: { two: 6, three: 11 },
  },
  {
    id: "9-3", name: "Gauntlet Gate",
    bodies: [blocker(620, 420, 54), blocker(760, 700, 54), planet(1080, 520, 80)],
    keys: [], goal: { pos: { x: 1360, y: 560 }, radius: 36 }, targets: [],
    portals: [makePortal(520, 560, 28, 140, 1), makePortal(1240, 400, 28, 20, 0)],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 5,
    objectives: [{ kind: "reach-goal" }], starThresholds: { two: 6, three: 11 },
  },
```

- [ ] **Step 2: Discover, record, verify**

Run: `$env:SOLVE=1; pnpm --filter @apogee/engine exec vitest run discover-solutions; Remove-Item Env:SOLVE`
Paste `9-1`/`9-2`/`9-3` into `SOLUTIONS`. Adjust UNSOLVABLE levels per earlier guidance; for `9-3` you may also spread the two blockers apart or drop one to open a corridor.

Run: `pnpm --filter @apogee/engine exec vitest run campaign-levels`
Expected: PASS.

- [ ] **Step 3: Typecheck + commit**

Run: `pnpm --filter @apogee/engine typecheck`
Expected: no errors.

```bash
git add packages/engine/src/campaign/levels.ts packages/engine/src/campaign/solutions.ts
git commit -m "feat(engine): campaign chapter 9 — wormholes + old mechanics (25-27)"
```

---

## Task 10: Chapter 10 — Everything (levels 28–30)

The finale combines moons, wormholes, keys, targets, and blockers. Level 30 is the capstone with a demanding 3★.

**Files:**
- Modify: `packages/engine/src/campaign/levels.ts` (append 3 levels)
- Modify: `packages/engine/src/campaign/solutions.ts` (record 3 solutions)

**Interfaces:**
- Consumes: `moon`, `makePortal`, `planet`, `blocker`. Produces ids `10-1`, `10-2`, `10-3`.

- [ ] **Step 1: Append the three levels**

Add to the end of `LEVELS`:

```ts
  // --- Chapter 10: everything together (28-30) ---
  {
    id: "10-1", name: "Convergence",
    bodies: [planet(800, 520, 70), moon(800, 520, 28, 180, 0, 1)],
    keys: [], goal: undefined,
    targets: [{ pos: { x: 1300, y: 300 }, radius: 24 }, { pos: { x: 1000, y: 720 }, radius: 24 }],
    portals: [makePortal(520, 340, 28, 150, 1), makePortal(1180, 300, 28, 20, 0)],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 6,
    objectives: [{ kind: "hit-all-targets" }], starThresholds: { two: 8, three: 14 },
  },
  {
    id: "10-2", name: "Clockwork Lock",
    bodies: [planet(900, 520, 72), moon(900, 520, 30, 200, 0, 1)],
    keys: [{ pos: { x: 460, y: 320 }, radius: 26 }],
    goal: { pos: { x: 1320, y: 300 }, radius: 36 }, targets: [],
    portals: [makePortal(560, 640, 28, 120, 1), makePortal(1220, 360, 28, 20, 0)],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 6,
    objectives: [{ kind: "reach-goal" }], starThresholds: { two: 8, three: 14 },
  },
  {
    id: "10-3", name: "Event Horizon",
    bodies: [blocker(640, 440, 52), planet(960, 620, 74), moon(960, 620, 28, 180, 0, -1)],
    keys: [{ pos: { x: 480, y: 700 }, radius: 26 }],
    goal: { pos: { x: 1360, y: 640 }, radius: 36 },
    targets: [{ pos: { x: 980, y: 280 }, radius: 24 }],
    portals: [makePortal(560, 300, 26, 140, 1), makePortal(1180, 760, 26, 340, 0)],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 7,
    objectives: [{ kind: "hit-all-targets" }, { kind: "reach-goal" }], starThresholds: { two: 9, three: 15 },
  },
```

- [ ] **Step 2: Discover, record, verify**

Run: `$env:SOLVE=1; pnpm --filter @apogee/engine exec vitest run discover-solutions; Remove-Item Env:SOLVE`
Paste `10-1`/`10-2`/`10-3` into `SOLUTIONS`. These are the hardest to solve; the discovery search may take longer. If UNSOLVABLE, raise `launchBudget` by 1, enlarge portal radii to 30–34, or move the key/goal into more open space. The capstone only needs a ≥1★ clearing sequence stored — 3★ tuning is a playtest concern (Task 15).

Run: `pnpm --filter @apogee/engine exec vitest run campaign-levels`
Expected: PASS — all 15 new levels now clear via stored solutions; all 15 original levels still solve via brute force.

- [ ] **Step 3: Full engine suite + typecheck + commit**

Run: `pnpm --filter @apogee/engine test`
Expected: PASS, no snapshots written.
Run: `pnpm --filter @apogee/engine typecheck`
Expected: no errors.

```bash
git add packages/engine/src/campaign/levels.ts packages/engine/src/campaign/solutions.ts
git commit -m "feat(engine): campaign chapter 10 — capstone combining everything (28-30)"
```

---

## Task 12: Web board clock + honest preview + release-tick capture

Adds a board clock to the shared canvas loop: it free-runs while aiming (advancing moons on screen), feeds the honest preview, and stamps the release tick into the launch. The Daily adapter is untouched — its 2-arg `previewTrace` is assignable to the new 3-arg type, and it ignores the stamped `launchTick`.

**Files:**
- Modify: `packages/web/src/space/useBoardCanvas.ts`
- Modify: `packages/web/src/campaign/CampaignCanvas.tsx`
- Verify unchanged behavior: `packages/web/src/GameCanvas.tsx` (no edit needed)

**Interfaces:**
- Produces: `BoardDrawOpts.boardTick: number`; `BoardAdapter.previewTrace: (drag, steps, tick) => ProbeFrame[][]`; `onLaunch` is called with `launchTick` populated.

- [ ] **Step 1: Add `boardTick` to draw opts + tick to previewTrace**

In `packages/web/src/space/useBoardCanvas.ts`, in `interface BoardDrawOpts` add a final field:

```ts
  animate: boolean;
  /** Board-clock tick for this frame (drives moving-body rendering). */
  boardTick: number;
```

And change the `previewTrace` line in `interface BoardAdapter` to:

```ts
  /** Live-sim a preview trace for the given drag at the current board tick. */
  previewTrace: (drag: LaunchInput, steps: number, tick: number) => ProbeFrame[][];
```

- [ ] **Step 2: Add the clock refs**

Right after `const prevStateRef = useRef<ProbeFrame["state"]>("flying");`, add:

```ts
  // Board clock: free-runs while aiming; during anim, tick = animStart + frameIdx.
  const tickRef = useRef(0);
  const lastLaunchTickRef = useRef(0);
  const animStartTickRef = useRef(0);
```

- [ ] **Step 3: Snapshot the launch tick when a new anim starts**

In the new-animation detection block, add the `animStartTickRef` line:

```ts
  if (opts.anim !== animRef.current) {
    animRef.current = opts.anim;
    frameIdxRef.current = 0;
    animStartTickRef.current = lastLaunchTickRef.current;
    prevStateRef.current = "flying";
    clearTrail(trailRef.current);
  }
```

- [ ] **Step 4: Pass the tick into the preview**

Change the `computePreview` body's `previewTrace` call:

```ts
      const trace = adapter.previewTrace(drag, PREVIEW_STEPS, tickRef.current);
```

- [ ] **Step 5: Compute + advance the clock in render()**

Replace the `render` function's `if (anim) { … } else { … }` with a version that threads `boardTick`. In the `anim` branch, compute `boardTick` and resume the clock on completion; in the `else` branch, advance the clock and pass `boardTick`:

In the `anim` branch, add at the very top (right after `if (anim) {`):

```ts
        const boardTick = animStartTickRef.current + frameIdxRef.current;
```

Add `boardTick,` to that branch's `adapter.draw(ctx, { … })` opts object, and change the completion block to reset the clock:

```ts
        frameIdxRef.current++;
        if (frameIdxRef.current >= anim.length) {
          tickRef.current = animStartTickRef.current + anim.length;
          animRef.current = null;
          clearTrail(trailRef.current);
          cbRef.current.onAnimDone();
        }
```

Replace the `else` branch with:

```ts
      } else {
        if (motion) tickRef.current++;
        adapter.draw(ctx, {
          probeFrames: null,
          previewPath: computePreview(),
          drag: dragRef.current,
          trail: null,
          bursts: burstsRef.current,
          time: t,
          animate: motion,
          boardTick: tickRef.current,
        });
      }
```

- [ ] **Step 6: Capture the launch tick on release**

Replace `onUp` with:

```ts
    const onUp = () => {
      const drag = dragRef.current;
      dragRef.current = null;
      kick();
      if (drag && (drag.dx !== 0 || drag.dy !== 0)) {
        lastLaunchTickRef.current = tickRef.current;
        cbRef.current.onLaunch({ dx: drag.dx, dy: drag.dy, launchTick: tickRef.current });
      }
    };
```

- [ ] **Step 7: Wire the campaign adapter to the tick**

In `packages/web/src/campaign/CampaignCanvas.tsx`, change the `previewTrace` and add `boardTick` to the draw view:

```tsx
      previewTrace: (drag, steps, tick) =>
        simulateCampaignLaunch(state, { ...drag, launchTick: tick }, steps).trace,
      draw: (ctx, o: BoardDrawOpts) =>
        drawCampaignFrame(ctx, {
          state,
          probeFrames: o.probeFrames,
          previewPath: o.previewPath,
          drag: o.drag,
          trail: o.trail,
          bursts: o.bursts,
          time: o.time,
          animate: o.animate,
          boardTick: o.boardTick,
        }),
```

(This will not typecheck until Task 13 adds `boardTick` to `CampaignRenderView`. That's expected — Steps 8–9 below only run the daily/typecheck checks that already hold; the full web typecheck is green at the end of Task 13.)

- [ ] **Step 8: Verify the Daily adapter still compiles unchanged**

Confirm `packages/web/src/GameCanvas.tsx` is NOT edited. Its `previewTrace: (drag, steps) => …` is assignable to the new 3-arg type (fewer params is allowed), and its draw view omits `boardTick` (drawFrame ignores it).

- [ ] **Step 9: Commit (partial — web compiles after Task 13)**

```bash
git add packages/web/src/space/useBoardCanvas.ts packages/web/src/campaign/CampaignCanvas.tsx
git commit -m "feat(web): board clock, honest moving preview, and release-tick capture"
```

---

## Task 13: Render moons, orbit rings, and moving sensors

**Files:**
- Modify: `packages/web/src/space/palette.ts` (add orbit color)
- Modify: `packages/web/src/render.ts` (import `orbitPositionAt`; `CampaignRenderView.boardTick`; stable moon seed; orbiting bodies/keys/targets)

**Interfaces:**
- Consumes: `orbitPositionAt` from `@apogee/engine` (Task 1 export).
- Produces: `CampaignRenderView.boardTick: number`.

- [ ] **Step 1: Add the orbit-path color**

In `packages/web/src/space/palette.ts`, add inside `COLORS`:

```ts
  orbitPath: "rgba(150,180,255,0.16)",
```

- [ ] **Step 2: Import orbitPositionAt**

In `packages/web/src/render.ts`, add `orbitPositionAt` to the `@apogee/engine` import list.

- [ ] **Step 3: Give planets an optional stable seed position**

Change `drawPlanet` so a moving moon keeps one stable sprite (seeded by its orbit center, not its moving position):

```ts
function drawPlanet(
  ctx: CanvasRenderingContext2D,
  pos: { x: number; y: number },
  radius: number,
  seedPos: { x: number; y: number } = pos,
): void {
  const type = planetTypeFor(seedPos);
  // Stable per-position seed → each planet keeps its own look across frames.
  const seed = ((Math.round(seedPos.x) * 73856093) ^ (Math.round(seedPos.y) * 19349663)) >>> 0;
  const sprite = planetSprite(type, radius, seed);
  ctx.drawImage(sprite, pos.x - sprite.width / 2, pos.y - sprite.height / 2);
}
```

(Existing callers pass no `seedPos`, so it defaults to `pos` — daily and static campaign rendering are unchanged.)

- [ ] **Step 4: Add boardTick to the campaign view**

In `interface CampaignRenderView`, add a final field:

```ts
  animate: boolean;
  boardTick: number;
```

- [ ] **Step 5: Draw orbiting bodies with a ring**

In `drawCampaignFrame`, replace the `// Bodies: planets vs hostile blockers.` loop with:

```ts
  // Bodies: planets, hostile blockers, and orbiting moons (with an orbit-path hint).
  for (const b of level.bodies) {
    if (b.orbit) {
      ctx.strokeStyle = COLORS.orbitPath;
      ctx.setLineDash([2, 10]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(b.orbit.center.x, b.orbit.center.y, b.orbit.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      const pos = orbitPositionAt(b.orbit, view.boardTick);
      if (b.kind === "blocker") drawBlocker(ctx, pos, b.radius, view.time, view.animate);
      else drawPlanet(ctx, pos, b.radius, b.orbit.center);
    } else if (b.kind === "blocker") {
      drawBlocker(ctx, b.pos, b.radius, view.time, view.animate);
    } else {
      drawPlanet(ctx, b.pos, b.radius);
    }
  }
```

- [ ] **Step 6: Draw moving targets/keys at their current position**

In the `level.targets.forEach(...)`, add as the first line of the callback and use `pos` for both arcs:

```ts
  level.targets.forEach((t, i) => {
    const pos = t.orbit ? orbitPositionAt(t.orbit, view.boardTick) : t.pos;
    const hit = state.targetsHit[i] ?? false;
    const color = hit ? COLORS.targetHit : COLORS.target;
    ctx.fillStyle = hit ? "rgba(165, 214, 167, 0.5)" : "rgba(255, 183, 77, 0.12)";
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, t.radius, 0, Math.PI * 2);
    ctx.fill();
    glowStroke(ctx, color, hit ? 12 : 4, 3, () => {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, t.radius, 0, Math.PI * 2);
    });
  });
```

In the `level.keys.forEach(...)`, add `const pos = k.orbit ? orbitPositionAt(k.orbit, view.boardTick) : k.pos;` as the first line, and replace every `k.pos.x`/`k.pos.y` in the diamond path with `pos.x`/`pos.y`.

- [ ] **Step 7: Typecheck the whole web package (closes Task 12)**

Run: `pnpm --filter @apogee/web typecheck`
Expected: no errors (the `CampaignCanvas` `boardTick` from Task 12 now resolves).

- [ ] **Step 8: Web tests + commit**

Run: `pnpm --filter @apogee/web test`
Expected: PASS.

```bash
git add packages/web/src/space/palette.ts packages/web/src/render.ts
git commit -m "feat(web): render orbiting moons, orbit rings, and moving sensors"
```

---

## Task 14: Render wormhole portals

**Files:**
- Modify: `packages/web/src/space/palette.ts` (add tether color)
- Modify: `packages/web/src/render.ts` (add `drawPortal`; draw tether + mouths)

**Interfaces:**
- Consumes: `Portal` shape via `state.level.portals` (already typed through `CampaignLevelState`).

- [ ] **Step 1: Add the tether color**

In `packages/web/src/space/palette.ts`, add inside `COLORS`:

```ts
  portalTether: "rgba(180,160,255,0.22)",
```

- [ ] **Step 2: Add a portal draw helper**

In `packages/web/src/render.ts`, add near `drawBlocker`:

```ts
function drawPortal(
  ctx: CanvasRenderingContext2D,
  p: { pos: { x: number; y: number }; radius: number; facing: { x: number; y: number } },
  hue: number,
): void {
  const ring = `hsl(${hue}, 80%, 66%)`;
  glowStroke(ctx, ring, 12, 3, () => {
    ctx.beginPath();
    ctx.arc(p.pos.x, p.pos.y, p.radius, 0, Math.PI * 2);
  });
  // Facing arrow — the direction a probe exits going.
  const tipX = p.pos.x + p.facing.x * (p.radius + 16);
  const tipY = p.pos.y + p.facing.y * (p.radius + 16);
  glowStroke(ctx, `hsl(${hue}, 85%, 72%)`, 8, 2, () => {
    ctx.beginPath();
    ctx.moveTo(p.pos.x + p.facing.x * p.radius, p.pos.y + p.facing.y * p.radius);
    ctx.lineTo(tipX, tipY);
  });
}
```

- [ ] **Step 3: Draw the portals in drawCampaignFrame**

In `drawCampaignFrame`, immediately AFTER the bodies loop (Task 13 Step 5) and before the targets, add:

```ts
  // Wormhole portals: a faint tether per pair, then oriented mouths (hue per pair).
  const portals = level.portals ?? [];
  for (let i = 0; i < portals.length; i++) {
    const j = portals[i]!.link;
    if (i < j) {
      ctx.strokeStyle = COLORS.portalTether;
      ctx.setLineDash([2, 12]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(portals[i]!.pos.x, portals[i]!.pos.y);
      ctx.lineTo(portals[j]!.pos.x, portals[j]!.pos.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  for (let i = 0; i < portals.length; i++) {
    const pairHue = 185 + (Math.min(i, portals[i]!.link) >> 1) * 60;
    drawPortal(ctx, portals[i]!, pairHue);
  }
```

- [ ] **Step 4: Typecheck + web tests**

Run: `pnpm --filter @apogee/web typecheck`
Expected: no errors.
Run: `pnpm --filter @apogee/web test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/space/palette.ts packages/web/src/render.ts
git commit -m "feat(web): render wormhole portals with oriented mouths"
```

---

## Task 15: Manual playtest, feel, and star-threshold tuning

The automated gates prove correctness and solvability; feel and the 3★ curve are judged by playing. This is the iterate-in-the-app task.

**Files:**
- Modify (as needed): `packages/engine/src/campaign/levels.ts` (star thresholds, layout nudges)
- Modify (if a moving layout changes): `packages/engine/src/campaign/solutions.ts`

- [ ] **Step 1: Run the app**

Run: `pnpm dev`
Open the printed URL, go to Campaign, and confirm levels 16–30 appear as tiles after 15 (they unlock linearly as you clear them).

- [ ] **Step 2: Play each new chapter**

For 16–30, confirm the feel:
- Moons visibly orbit while aiming; the dashed preview updates ("breathes") as the field moves.
- A moon's pull curves the probe; you can land on a moon.
- Portals show an oriented mouth + a faint tether to their pair; entering one exits along the far mouth's arrow at the same speed.
- Reduce-motion (OS setting): moons freeze while aiming, and a launched flight still animates its recorded path. Toggle it mid-session to confirm the board loop respects the change (existing behavior).

- [ ] **Step 3: Tune star thresholds**

For each level, judge whether `starThresholds.{two,three}` reward efficiency+precision sensibly (recall `levelScore = launchesLeft × 5 + bestPrecision`). Raise the capstone (`10-3`) `three` until a 3★ demands a clean, launch-efficient clear. Edit values in `levels.ts`. Threshold-only edits don't change solvability.

- [ ] **Step 4: If any moving layout changed, refresh its solution**

If Step 2/3 moved bodies/portals/keys/goal on a moving level (not just thresholds), re-discover and re-record its solution:

Run: `$env:SOLVE=1; pnpm --filter @apogee/engine exec vitest run discover-solutions; Remove-Item Env:SOLVE`
Paste any changed sequence into `SOLUTIONS`.

- [ ] **Step 5: Final full verification**

Run: `pnpm test`
Expected: PASS across engine + web. Confirm the Daily and chapters 1–5 golden snapshots are unchanged (no "written" snapshots).
Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 6: Commit any tuning**

```bash
git add packages/engine/src/campaign/levels.ts packages/engine/src/campaign/solutions.ts
git commit -m "tune(engine): campaign 16-30 feel and star thresholds"
```

---

## Self-Review (completed by plan author)

**Spec coverage** — every spec section maps to a task:
- Moons = moving gravity, honest preview → Tasks 1, 3 (engine), 12–13 (live board + honest preview render).
- Live board / timing skill (`launchTick`) → Task 3 (engine field), 12 (clock + capture).
- Wormholes, Portal-style oriented exit + re-entry guard → Tasks 2, 3 (engine), 14 (render).
- Orbiting sensors (moving key/target) → Task 3 (engine), 13 (render); used in levels 20/21/26 (Tasks 7, 9).
- Incremental rotation + `sqrt` renormalization, `BOARD_PERIOD` → Task 1.
- Byte-identical Daily + chapters 1–5 → Tasks 0 (baseline), 3 (static path preserved), verified in 4/13/14/15.
- Interleaved 15-level ladder (16–30) → Tasks 6–10.
- Solvability via stored replay, not extended brute force → Task 5; solutions recorded in 6–10.
- Golden + determinism + mechanic unit + purity tests → Tasks 1–5 (orbit/portal math, moving sim, moving golden).
- Web live board, honest preview, capture tick, draw moons/portals/moving sensors → Tasks 12–14.

**Placeholder scan** — no "TBD/TODO/handle edge cases". Level coordinates are concrete, validated starting points with an explicit discovery+adjust procedure; solution vectors are computed artifacts recorded via a defined command (not guesses).

**Type consistency** — `Orbit`/`Portal` fields, `LaunchInput.launchTick`, `orbitPositionAt`, `isMovingLevel`, `SOLUTIONS`, `BoardDrawOpts.boardTick`, `CampaignRenderView.boardTick`, and the 3-arg `previewTrace` are defined once and consumed with the same names/signatures throughout. `advanceOrbit` accepts a structural `{cosStep,sinStep,radius}` so both `Orbit` and the working offset satisfy it.

**Known cross-task compile window** — Task 12 Step 7 edits `CampaignCanvas` to pass `boardTick`, which only typechecks once Task 13 Step 4 adds the field. This is called out in Task 12 Step 7/9 and closed in Task 13 Step 7; run the two web tasks together if executing inline.

