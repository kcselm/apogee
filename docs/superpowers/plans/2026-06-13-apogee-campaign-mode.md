# Apogee Campaign Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Angry-Birds-style level campaign (hand-authored levels with objectives, keys, and blocker planets) alongside the untouched daily game.

**Architecture:** Additive campaign layer (Approach B). Daily physics primitives are extracted and shared; a new `campaign/` engine module adds levels, mechanics, objectives, and star scoring — all inside the deterministic engine. The daily code path and its golden snapshot stay byte-identical. The web app gains a home screen, a level map, and a campaign play screen, leaving `DailyGame` (today's `App`) behaviorally unchanged.

**Tech Stack:** TypeScript (strict, `noUncheckedIndexedAccess`), pnpm workspaces, Vitest, React 19 + Vite, canvas 2D. Engine numeric code uses only `+ − × ÷ sqrt`.

**Spec:** `docs/superpowers/specs/2026-06-13-apogee-campaign-design.md`

**Branch:** `feature/campaign-mode` (already created). Baseline tests green: engine 38/38, web 5/5.

**Conventions to follow (observed in the repo):**
- Tests: `import { describe, expect, it } from "vitest";` with small factory helpers; non-null assertions (`!`) are used freely because `noUncheckedIndexedAccess` is on.
- `import type { ... }` for type-only imports.
- Engine files are tiny and single-purpose. Keep them that way.
- Run a single test file with: `pnpm --filter @apogee/engine exec vitest run tests/<file>` (or `pnpm --filter @apogee/web ...`). Run everything with `pnpm test`. Typecheck with `pnpm typecheck`.
- Commit after every green task.

---

## Task 1: Extract shared physics primitives (daily stays byte-identical)

Refactor `stepProbes` to compose from small exported primitives that the campaign step will reuse. The golden snapshot is the safety net: if the refactor changes any float, the golden test fails.

**Files:**
- Modify: `packages/engine/src/physics.ts`
- Test (existing, must stay green): `packages/engine/tests/physics.test.ts`, `packages/engine/tests/golden.test.ts`

- [ ] **Step 1: Replace `physics.ts` with the primitive-composed version**

```ts
import { DT, GRAVITY, PROBE_RADIUS, VOID_MARGIN } from "./constants";
import type { Probe, StarSystem, Vec2 } from "./types";

/** The minimal shape physics needs from a gravitating, collidable body. */
export interface GravityBody {
  pos: Vec2;
  radius: number;
  mass: number;
}

/** Net gravitational acceleration at a point. Only + - * / sqrt — determinism. */
export function gravityAt(
  bodies: readonly GravityBody[],
  x: number,
  y: number,
): { ax: number; ay: number } {
  let ax = 0;
  let ay = 0;
  for (const p of bodies) {
    const dx = p.pos.x - x;
    const dy = p.pos.y - y;
    const d2 = dx * dx + dy * dy;
    const d = Math.sqrt(d2);
    const a = (GRAVITY * p.mass) / d2;
    ax += (a * dx) / d;
    ay += (a * dy) / d;
  }
  return { ax, ay };
}

/** Advance one flying probe a single fixed step (semi-implicit Euler). */
export function integrate(bodies: readonly GravityBody[], probe: Probe): void {
  const { ax, ay } = gravityAt(bodies, probe.pos.x, probe.pos.y);
  probe.vel.x += ax * DT;
  probe.vel.y += ay * DT;
  probe.pos.x += probe.vel.x * DT;
  probe.pos.y += probe.vel.y * DT;
}

/** True when a probe overlaps a body's surface. */
export function contacts(body: GravityBody, probe: Probe): boolean {
  const dx = probe.pos.x - body.pos.x;
  const dy = probe.pos.y - body.pos.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  return d <= body.radius + PROBE_RADIUS;
}

/** Snap a probe to a body's surface, zero its velocity, mark it landed. */
export function landOn(body: GravityBody, probe: Probe): void {
  const dx = probe.pos.x - body.pos.x;
  const dy = probe.pos.y - body.pos.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  const r = body.radius + PROBE_RADIUS;
  probe.pos.x = body.pos.x + (dx / d) * r;
  probe.pos.y = body.pos.y + (dy / d) * r;
  probe.vel.x = 0;
  probe.vel.y = 0;
  probe.state = "landed";
}

/** Equal-mass elastic probe-probe collisions; knocked probes fly again. */
export function resolveCollisions(probes: Probe[]): void {
  for (let i = 0; i < probes.length; i++) {
    for (let j = i + 1; j < probes.length; j++) {
      const a = probes[i]!;
      const b = probes[j]!;
      if (a.state === "lost" || b.state === "lost") continue;
      if (a.state !== "flying" && b.state !== "flying") continue;
      const dx = b.pos.x - a.pos.x;
      const dy = b.pos.y - a.pos.y;
      const d2 = dx * dx + dy * dy;
      const minD = PROBE_RADIUS * 2;
      if (d2 >= minD * minD || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const nx = dx / d;
      const ny = dy / d;
      const half = (minD - d) / 2;
      a.pos.x -= nx * half;
      a.pos.y -= ny * half;
      b.pos.x += nx * half;
      b.pos.y += ny * half;
      const avn = a.vel.x * nx + a.vel.y * ny;
      const bvn = b.vel.x * nx + b.vel.y * ny;
      a.vel.x += (bvn - avn) * nx;
      a.vel.y += (bvn - avn) * ny;
      b.vel.x += (avn - bvn) * nx;
      b.vel.y += (avn - bvn) * ny;
      a.state = "flying";
      b.state = "flying";
    }
  }
}

/** Mark a flying probe lost if it leaves the bounds + margin. */
export function voidCheck(
  bounds: { width: number; height: number },
  probe: Probe,
): void {
  if (probe.state !== "flying") return;
  if (
    probe.pos.x < -VOID_MARGIN ||
    probe.pos.x > bounds.width + VOID_MARGIN ||
    probe.pos.y < -VOID_MARGIN ||
    probe.pos.y > bounds.height + VOID_MARGIN
  ) {
    probe.state = "lost";
  }
}

/**
 * Advance all probes one fixed timestep for the DAILY game. Behavior is
 * identical to the previous inline implementation — now composed from the
 * primitives above so the campaign step can reuse them. Mutates in place.
 */
export function stepProbes(system: StarSystem, probes: Probe[]): void {
  for (const probe of probes) {
    if (probe.state !== "flying") continue;
    integrate(system.planets, probe);
  }
  for (const probe of probes) {
    if (probe.state !== "flying") continue;
    for (const planet of system.planets) {
      if (contacts(planet, probe)) {
        landOn(planet, probe);
        break;
      }
    }
  }
  resolveCollisions(probes);
  for (const probe of probes) voidCheck(system.bounds, probe);
}
```

- [ ] **Step 2: Run the physics + golden tests — they must pass unchanged**

Run: `pnpm --filter @apogee/engine exec vitest run tests/physics.test.ts tests/golden.test.ts`
Expected: PASS, 13 tests. The golden snapshot (`tests/__snapshots__/golden.test.ts.snap`) must NOT be rewritten — if Vitest reports "1 obsolete" or a snapshot update, the refactor changed a float; revert and find the discrepancy (operation order must match the original exactly).

- [ ] **Step 3: Run the full engine suite**

Run: `pnpm --filter @apogee/engine test`
Expected: PASS, 38 tests.

- [ ] **Step 4: Commit**

```bash
git add packages/engine/src/physics.ts
git commit -m "refactor(engine): extract reusable physics primitives; daily unchanged"
```

---

## Task 2: Campaign data model and constants

Pure type declarations plus one tuning constant. No behavior yet; the gate is `typecheck`.

**Files:**
- Create: `packages/engine/src/campaign/types.ts`
- Create: `packages/engine/src/campaign/constants.ts`

- [ ] **Step 1: Create `campaign/constants.ts`**

```ts
/** Star-score points awarded per unused launch (efficiency half of the rating). */
export const LAUNCH_BONUS = 5;
```

- [ ] **Step 2: Create `campaign/types.ts`**

```ts
import type { Probe, Vec2 } from "../types";

export type BodyKind = "planet" | "blocker";

/** A gravity source. Planets are landable; blockers are lethal on contact. */
export interface Body {
  pos: Vec2;
  radius: number;
  mass: number;
  kind: BodyKind;
}

/** Fly a probe through it to collect (persists for the rest of the level). */
export interface Key {
  pos: Vec2;
  radius: number;
}

/** Reach to satisfy a `reach-goal` objective (locked until keys collected). */
export interface Goal {
  pos: Vec2;
  radius: number;
}

/** Pass a probe through every target to satisfy `hit-all-targets`. */
export interface Target {
  pos: Vec2;
  radius: number;
}

export type Objective = { kind: "reach-goal" } | { kind: "hit-all-targets" };

export interface Level {
  id: string;
  name: string;
  bodies: Body[];
  keys: Key[];
  goal?: Goal;
  targets: Target[];
  launchPos: Vec2;
  bounds: { width: number; height: number };
  launchBudget: number;
  objectives: Objective[];
  starThresholds: { two: number; three: number };
}

export interface CampaignLevelState {
  level: Level;
  probes: Probe[];
  launchesUsed: number;
  keysCollected: boolean[];
  targetsHit: boolean[];
  goalReached: boolean;
  bestPrecision: number;
}

/** A sensor pickup during one launch, surfaced for the renderer. */
export interface SensorEvent {
  step: number;
  type: "key" | "goal" | "target";
  index: number;
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @apogee/engine typecheck`
Expected: PASS (no output, exit 0).

- [ ] **Step 4: Commit**

```bash
git add packages/engine/src/campaign/types.ts packages/engine/src/campaign/constants.ts
git commit -m "feat(engine): campaign data model and tuning constant"
```

---

## Task 3: Objective evaluation

**Files:**
- Create: `packages/engine/src/campaign/objectives.ts`
- Test: `packages/engine/tests/campaign-objectives.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { evaluateObjectives, isLevelOver } from "../src/campaign/objectives";
import type { CampaignLevelState, Level } from "../src/campaign/types";

function level(partial: Partial<Level>): Level {
  return {
    id: "t",
    name: "t",
    bodies: [],
    keys: [],
    goal: undefined,
    targets: [],
    launchPos: { x: 0, y: 0 },
    bounds: { width: 1600, height: 1000 },
    launchBudget: 3,
    objectives: [],
    starThresholds: { two: 10, three: 20 },
    ...partial,
  };
}

function state(lvl: Level, partial: Partial<CampaignLevelState> = {}): CampaignLevelState {
  return {
    level: lvl,
    probes: [],
    launchesUsed: 0,
    keysCollected: lvl.keys.map(() => false),
    targetsHit: lvl.targets.map(() => false),
    goalReached: false,
    bestPrecision: 0,
    ...partial,
  };
}

describe("evaluateObjectives", () => {
  it("reach-goal is met only when goalReached", () => {
    const lvl = level({ goal: { pos: { x: 1, y: 1 }, radius: 10 }, objectives: [{ kind: "reach-goal" }] });
    expect(evaluateObjectives(state(lvl)).cleared).toBe(false);
    expect(evaluateObjectives(state(lvl, { goalReached: true })).cleared).toBe(true);
  });

  it("hit-all-targets needs every target hit (and at least one target)", () => {
    const lvl = level({
      targets: [{ pos: { x: 1, y: 1 }, radius: 5 }, { pos: { x: 2, y: 2 }, radius: 5 }],
      objectives: [{ kind: "hit-all-targets" }],
    });
    expect(evaluateObjectives(state(lvl, { targetsHit: [true, false] })).cleared).toBe(false);
    expect(evaluateObjectives(state(lvl, { targetsHit: [true, true] })).cleared).toBe(true);
  });

  it("a combined level needs all objectives", () => {
    const lvl = level({
      goal: { pos: { x: 1, y: 1 }, radius: 10 },
      targets: [{ pos: { x: 2, y: 2 }, radius: 5 }],
      objectives: [{ kind: "reach-goal" }, { kind: "hit-all-targets" }],
    });
    expect(evaluateObjectives(state(lvl, { goalReached: true, targetsHit: [false] })).cleared).toBe(false);
    expect(evaluateObjectives(state(lvl, { goalReached: true, targetsHit: [true] })).cleared).toBe(true);
  });

  it("isLevelOver is true when cleared or launches exhausted", () => {
    const lvl = level({ goal: { pos: { x: 1, y: 1 }, radius: 10 }, objectives: [{ kind: "reach-goal" }] });
    expect(isLevelOver(state(lvl))).toBe(false);
    expect(isLevelOver(state(lvl, { goalReached: true }))).toBe(true);
    expect(isLevelOver(state(lvl, { launchesUsed: 3 }))).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @apogee/engine exec vitest run tests/campaign-objectives.test.ts`
Expected: FAIL — cannot resolve `../src/campaign/objectives`.

- [ ] **Step 3: Create `campaign/objectives.ts`**

```ts
import type { CampaignLevelState } from "./types";

/** Which objectives are met, and whether the level is cleared (all met). */
export function evaluateObjectives(
  state: CampaignLevelState,
): { met: boolean[]; cleared: boolean } {
  const met = state.level.objectives.map((o) => {
    switch (o.kind) {
      case "reach-goal":
        return state.goalReached;
      case "hit-all-targets":
        return state.targetsHit.length > 0 && state.targetsHit.every(Boolean);
    }
  });
  return { met, cleared: met.length > 0 && met.every(Boolean) };
}

export function isLevelOver(state: CampaignLevelState): boolean {
  return (
    evaluateObjectives(state).cleared ||
    state.launchesUsed >= state.level.launchBudget
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @apogee/engine exec vitest run tests/campaign-objectives.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src/campaign/objectives.ts packages/engine/tests/campaign-objectives.test.ts
git commit -m "feat(engine): campaign objective evaluation"
```

---

## Task 4: Precision points and star rating

**Files:**
- Create: `packages/engine/src/campaign/scoring.ts`
- Test: `packages/engine/tests/campaign-scoring.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { precisionPoints, starRating } from "../src/campaign/scoring";
import type { CampaignLevelState, Level } from "../src/campaign/types";

function level(partial: Partial<Level> = {}): Level {
  return {
    id: "t", name: "t", bodies: [], keys: [], goal: { pos: { x: 1, y: 1 }, radius: 60 },
    targets: [], launchPos: { x: 0, y: 0 }, bounds: { width: 1600, height: 1000 },
    launchBudget: 3, objectives: [{ kind: "reach-goal" }], starThresholds: { two: 8, three: 13 },
    ...partial,
  };
}

function state(lvl: Level, partial: Partial<CampaignLevelState> = {}): CampaignLevelState {
  return {
    level: lvl, probes: [], launchesUsed: 0, keysCollected: [], targetsHit: [],
    goalReached: false, bestPrecision: 0, ...partial,
  };
}

describe("precisionPoints", () => {
  it("maps distance through the RINGS table (5 / 3 / 1 / 0)", () => {
    expect(precisionPoints(0)).toBe(5);
    expect(precisionPoints(14)).toBe(5);
    expect(precisionPoints(20)).toBe(3);
    expect(precisionPoints(40)).toBe(1);
    expect(precisionPoints(60)).toBe(0);
  });
});

describe("starRating", () => {
  it("is 0 stars when not cleared", () => {
    expect(starRating(state(level())).stars).toBe(0);
  });

  it("clearing at all earns at least 1 star", () => {
    // cleared, 0 launches left scenario: launchesUsed == budget, precision 0.
    const s = state(level(), { goalReached: true, launchesUsed: 3, bestPrecision: 0 });
    expect(starRating(s).stars).toBe(1);
  });

  it("efficiency + precision push to 2 and 3 stars via thresholds", () => {
    // 2 launches left * LAUNCH_BONUS(5) = 10, + precision 5 = 15 >= three(13) -> 3 stars
    const s3 = state(level(), { goalReached: true, launchesUsed: 1, bestPrecision: 5 });
    expect(starRating(s3)).toEqual({ stars: 3, levelScore: 15 });
    // 1 launch left * 5 = 5, + precision 3 = 8 >= two(8) but < three -> 2 stars
    const s2 = state(level(), { goalReached: true, launchesUsed: 2, bestPrecision: 3 });
    expect(starRating(s2)).toEqual({ stars: 2, levelScore: 8 });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @apogee/engine exec vitest run tests/campaign-scoring.test.ts`
Expected: FAIL — cannot resolve `../src/campaign/scoring`.

- [ ] **Step 3: Create `campaign/scoring.ts`**

```ts
import { RINGS } from "../scoring";
import { LAUNCH_BONUS } from "./constants";
import { evaluateObjectives } from "./objectives";
import type { CampaignLevelState } from "./types";

/** Bullseye points (5/3/1/0) for a probe passing `dist` from a center. */
export function precisionPoints(dist: number): number {
  for (const ring of RINGS) {
    if (dist <= ring.maxDist) return ring.points;
  }
  return 0;
}

export function starRating(
  state: CampaignLevelState,
): { stars: 0 | 1 | 2 | 3; levelScore: number } {
  const launchesLeft = state.level.launchBudget - state.launchesUsed;
  const levelScore = launchesLeft * LAUNCH_BONUS + state.bestPrecision;
  if (!evaluateObjectives(state).cleared) return { stars: 0, levelScore };
  const { two, three } = state.level.starThresholds;
  const stars = levelScore >= three ? 3 : levelScore >= two ? 2 : 1;
  return { stars, levelScore };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @apogee/engine exec vitest run tests/campaign-scoring.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src/campaign/scoring.ts packages/engine/tests/campaign-scoring.test.ts
git commit -m "feat(engine): campaign precision points and star rating"
```

---

## Task 5: The campaign simulation step

The heart of the feature: `simulateCampaignLaunch` runs the daily physics loop plus blocker death and a sensor pass (keys → targets → goal), tracking sticky progress and best precision.

**Files:**
- Create: `packages/engine/src/campaign/simulate.ts`
- Test: `packages/engine/tests/campaign-simulate.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { createLevel, simulateCampaignLaunch } from "../src/campaign/simulate";
import { evaluateObjectives } from "../src/campaign/objectives";
import type { Level } from "../src/campaign/types";

const BOUNDS = { width: 1600, height: 1000 };

function base(partial: Partial<Level>): Level {
  return {
    id: "t", name: "t", bodies: [], keys: [], goal: undefined, targets: [],
    launchPos: { x: 80, y: 500 }, bounds: BOUNDS, launchBudget: 3,
    objectives: [], starThresholds: { two: 8, three: 13 }, ...partial,
  };
}

describe("createLevel", () => {
  it("initializes sticky progress sized to keys and targets", () => {
    const lvl = base({ keys: [{ pos: { x: 1, y: 1 }, radius: 5 }], targets: [{ pos: { x: 2, y: 2 }, radius: 5 }] });
    const s = createLevel(lvl);
    expect(s.keysCollected).toEqual([false]);
    expect(s.targetsHit).toEqual([false]);
    expect(s.goalReached).toBe(false);
    expect(s.launchesUsed).toBe(0);
  });
});

describe("simulateCampaignLaunch", () => {
  it("increments launchesUsed and resolves the new probe to non-flying", () => {
    const lvl = base({ bodies: [{ pos: { x: 800, y: 500 }, radius: 60, mass: 3600, kind: "planet" }] });
    const r = simulateCampaignLaunch(createLevel(lvl), { dx: 200, dy: 0 });
    expect(r.state.launchesUsed).toBe(1);
    expect(r.state.probes[0]!.state).not.toBe("flying");
    expect(r.trace.length).toBeGreaterThan(0);
  });

  it("does not mutate the input state", () => {
    const lvl = base({ bodies: [{ pos: { x: 800, y: 500 }, radius: 60, mass: 3600, kind: "planet" }] });
    const s = createLevel(lvl);
    const before = JSON.stringify(s);
    simulateCampaignLaunch(s, { dx: 200, dy: 0 });
    expect(JSON.stringify(s)).toBe(before);
  });

  it("a blocker is lethal: contact loses the probe (no landing)", () => {
    // Blocker straight ahead; aim directly into it.
    const lvl = base({ bodies: [{ pos: { x: 400, y: 500 }, radius: 60, mass: 3600, kind: "blocker" }] });
    const r = simulateCampaignLaunch(createLevel(lvl), { dx: 200, dy: 0 });
    expect(r.state.probes[0]!.state).toBe("lost");
  });

  it("collects a key the probe flies through, and it persists across launches", () => {
    // Key on the straight path; no bodies so the probe flies straight.
    const lvl = base({ keys: [{ pos: { x: 400, y: 500 }, radius: 20 }] });
    const r1 = simulateCampaignLaunch(createLevel(lvl), { dx: 200, dy: 0 });
    expect(r1.state.keysCollected).toEqual([true]);
    // Next launch keeps it collected even if this probe misses the key.
    const r2 = simulateCampaignLaunch(r1.state, { dx: 0, dy: -200 });
    expect(r2.state.keysCollected).toEqual([true]);
  });

  it("goal stays locked until keys are collected", () => {
    const lvl = base({
      keys: [{ pos: { x: 400, y: 300 }, radius: 20 }],
      goal: { pos: { x: 400, y: 500 }, radius: 30 },
      objectives: [{ kind: "reach-goal" }],
    });
    // Fly straight through the goal but NOT the key -> goal ignored.
    const locked = simulateCampaignLaunch(createLevel(lvl), { dx: 200, dy: 0 });
    expect(locked.state.goalReached).toBe(false);
  });

  it("reaches the goal once keys are in hand and records precision", () => {
    const lvl = base({
      keys: [{ pos: { x: 300, y: 500 }, radius: 20 }],
      goal: { pos: { x: 700, y: 500 }, radius: 30 },
      objectives: [{ kind: "reach-goal" }],
    });
    // Straight shot passes the key (x=300) then the goal (x=700).
    const r = simulateCampaignLaunch(createLevel(lvl), { dx: 200, dy: 0 });
    expect(r.state.keysCollected).toEqual([true]);
    expect(r.state.goalReached).toBe(true);
    expect(r.state.bestPrecision).toBeGreaterThan(0);
    expect(evaluateObjectives(r.state).cleared).toBe(true);
    expect(r.events.some((e) => e.type === "goal")).toBe(true);
  });

  it("hits a target the probe passes through", () => {
    const lvl = base({
      targets: [{ pos: { x: 400, y: 500 }, radius: 20 }],
      objectives: [{ kind: "hit-all-targets" }],
    });
    const r = simulateCampaignLaunch(createLevel(lvl), { dx: 200, dy: 0 });
    expect(r.state.targetsHit).toEqual([true]);
  });

  it("is deterministic: identical inputs produce identical results", () => {
    const lvl = base({ bodies: [{ pos: { x: 800, y: 500 }, radius: 60, mass: 3600, kind: "planet" }] });
    const a = simulateCampaignLaunch(createLevel(lvl), { dx: 173.5, dy: -42.25 });
    const b = simulateCampaignLaunch(createLevel(lvl), { dx: 173.5, dy: -42.25 });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @apogee/engine exec vitest run tests/campaign-simulate.test.ts`
Expected: FAIL — cannot resolve `../src/campaign/simulate`.

- [ ] **Step 3: Create `campaign/simulate.ts`**

```ts
import { MAX_SPEED, MAX_STEPS, POWER_SCALE, PROBE_RADIUS } from "../constants";
import { contacts, integrate, landOn, resolveCollisions, voidCheck } from "../physics";
import type { LaunchInput, Probe, ProbeFrame } from "../types";
import { precisionPoints } from "./scoring";
import type { CampaignLevelState, Level, SensorEvent } from "./types";

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

/**
 * Run one campaign launch to completion (or maxSteps). Pure: returns new state.
 * Adds blocker death and a sensor pass (keys -> targets -> goal) on top of the
 * daily physics loop. Sticky progress (keys/targets/goal) persists across launches.
 */
export function simulateCampaignLaunch(
  state: CampaignLevelState,
  input: LaunchInput,
  maxSteps: number = MAX_STEPS,
): { state: CampaignLevelState; trace: ProbeFrame[][]; events: SensorEvent[] } {
  const level = state.level;
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

  const trace: ProbeFrame[][] = [];
  const events: SensorEvent[] = [];

  for (let step = 0; step < maxSteps; step++) {
    // 1. Integrate flying probes (planets AND blockers exert gravity).
    for (const probe of probes) {
      if (probe.state === "flying") integrate(level.bodies, probe);
    }
    // 2. Body contact: land on planets, die on blockers.
    for (const probe of probes) {
      if (probe.state !== "flying") continue;
      for (const body of level.bodies) {
        if (!contacts(body, probe)) continue;
        if (body.kind === "blocker") probe.state = "lost";
        else landOn(body, probe);
        break;
      }
    }
    // 3. Sensors (keys -> targets -> goal). Checked for any non-lost probe so a
    //    probe that lands exactly on a goal/target still registers.
    for (const probe of probes) {
      if (probe.state === "lost") continue;
      level.keys.forEach((k, i) => {
        if (!keysCollected[i] && within(probe, k.pos.x, k.pos.y, k.radius + PROBE_RADIUS)) {
          keysCollected[i] = true;
          events.push({ step, type: "key", index: i });
        }
      });
      level.targets.forEach((t, i) => {
        if (!targetsHit[i] && within(probe, t.pos.x, t.pos.y, t.radius + PROBE_RADIUS)) {
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
    // 4. Probe-probe collisions, then void check.
    resolveCollisions(probes);
    for (const probe of probes) voidCheck(level.bounds, probe);

    trace.push(probes.map((p) => ({ x: p.pos.x, y: p.pos.y, state: p.state })));
    if (probes.every((p) => p.state !== "flying")) break;
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

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @apogee/engine exec vitest run tests/campaign-simulate.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src/campaign/simulate.ts packages/engine/tests/campaign-simulate.test.ts
git commit -m "feat(engine): campaign simulation step with keys, blockers, goal, targets"
```

---

## Task 6: Campaign exports + golden determinism test

Wire the campaign module into the engine's public API and lock a fixed campaign playthrough as a snapshot.

**Files:**
- Create: `packages/engine/src/campaign/index.ts`
- Modify: `packages/engine/src/index.ts`
- Test: `packages/engine/tests/campaign-golden.test.ts`

- [ ] **Step 1: Create `campaign/index.ts`**

```ts
export * from "./types";
export { LAUNCH_BONUS } from "./constants";
export { createLevel, simulateCampaignLaunch } from "./simulate";
export { evaluateObjectives, isLevelOver } from "./objectives";
export { precisionPoints, starRating } from "./scoring";
export { LEVELS } from "./levels";
```

> Note: `./levels` does not exist yet (Task 7). This import will fail typecheck until then. If implementing strictly task-by-task, temporarily omit the `LEVELS` line and add it back in Task 7. (Subagent executing Task 7 must re-add it.)

- [ ] **Step 2: Append campaign exports to `src/index.ts`**

Add this line at the end of `packages/engine/src/index.ts`:

```ts
export * from "./campaign";
```

The file then reads:

```ts
export * from "./constants";
export * from "./types";
export { mulberry32, hashString } from "./rng";
export { gravityAt, stepProbes } from "./physics";
export { generateSystem } from "./generation";
export { RINGS, scoreProbe, scoreGame } from "./scoring";
export { simulateLaunch, createGame, createDailyGame, isGameOver } from "./game";
export * from "./campaign";
```

- [ ] **Step 3: Write the campaign golden test**

```ts
import { describe, expect, it } from "vitest";
import { createLevel, simulateCampaignLaunch } from "../src/campaign/simulate";
import { evaluateObjectives } from "../src/campaign/objectives";
import { starRating } from "../src/campaign/scoring";
import type { Level } from "../src/campaign/types";

/** A fixed, self-contained level: collect the key, then reach the goal. */
const LEVEL: Level = {
  id: "golden",
  name: "Golden",
  bodies: [{ pos: { x: 800, y: 520 }, radius: 70, mass: 4900, kind: "planet" }],
  keys: [{ pos: { x: 400, y: 380 }, radius: 24 }],
  goal: { pos: { x: 1150, y: 360 }, radius: 34 },
  targets: [],
  launchPos: { x: 80, y: 500 },
  bounds: { width: 1600, height: 1000 },
  launchBudget: 3,
  objectives: [{ kind: "reach-goal" }],
  starThresholds: { two: 6, three: 11 },
};

const INPUTS = [
  { dx: 160, dy: -120 },
  { dx: 210, dy: -40 },
];

describe("campaign golden replay", () => {
  it("a fixed level + inputs matches the locked snapshot", () => {
    let s = createLevel(LEVEL);
    for (const input of INPUTS) s = simulateCampaignLaunch(s, input).state;
    const summary = {
      probes: s.probes,
      keysCollected: s.keysCollected,
      goalReached: s.goalReached,
      bestPrecision: s.bestPrecision,
      cleared: evaluateObjectives(s).cleared,
      stars: starRating(s).stars,
    };
    expect(summary).toMatchSnapshot();
  });

  it("replaying twice is byte-identical (determinism)", () => {
    const run = () => {
      let s = createLevel(LEVEL);
      for (const input of INPUTS) s = simulateCampaignLaunch(s, input).state;
      return JSON.stringify(s);
    };
    expect(run()).toBe(run());
  });
});
```

- [ ] **Step 4: Run it (snapshot is created on first run)**

Run: `pnpm --filter @apogee/engine exec vitest run tests/campaign-golden.test.ts`
Expected: PASS, 2 tests; a new `tests/__snapshots__/campaign-golden.test.ts.snap` is written. Open it and sanity-check that `goalReached` is `true` and `stars` ≥ 1 — if not, the INPUTS above don't clear this level; adjust the two input vectors until the snapshot shows a cleared run, then re-run. (This is a one-time authoring nudge, not a placeholder.)

- [ ] **Step 5: Run the full engine suite**

Run: `pnpm --filter @apogee/engine test`
Expected: PASS (now ~54 tests). Daily golden snapshot still unchanged.

- [ ] **Step 6: Commit**

```bash
git add packages/engine/src/campaign/index.ts packages/engine/src/index.ts packages/engine/tests/campaign-golden.test.ts packages/engine/tests/__snapshots__/campaign-golden.test.ts.snap
git commit -m "feat(engine): export campaign API and lock campaign golden snapshot"
```

---

## Task 7: Authored levels + solvability harness

Provide the level data and a deterministic solver that proves every shipped level is clearable within its launch budget. This task seeds the first chapter; Task 15 fills the rest using the same harness.

**Files:**
- Create: `packages/engine/src/campaign/levels.ts`
- Create: `packages/engine/tests/campaign-solver.ts` (test helper, not shipped from index)
- Test: `packages/engine/tests/campaign-levels.test.ts`

- [ ] **Step 1: Create the solver helper `tests/campaign-solver.ts`**

```ts
import { createLevel, simulateCampaignLaunch } from "../src/campaign/simulate";
import { evaluateObjectives } from "../src/campaign/objectives";
import type { CampaignLevelState, Level } from "../src/campaign/types";
import type { LaunchInput } from "../src/types";

// Trig is allowed HERE: this is test/authoring code, never the deterministic sim.
const DIRECTIONS = 96;
const POWERS = [40, 70, 100, 140, 180, 220, 260];

function candidates(): LaunchInput[] {
  const out: LaunchInput[] = [];
  for (let d = 0; d < DIRECTIONS; d++) {
    const t = (d / DIRECTIONS) * Math.PI * 2;
    for (const p of POWERS) out.push({ dx: Math.cos(t) * p, dy: Math.sin(t) * p });
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

/**
 * Greedy progress-pruned search: a clearing launch sequence within budget, or
 * null. Every retained launch must increase progress, so depth is bounded by
 * (#keys + #targets + 1). Returns the first solution found.
 */
export function findSolution(level: Level): LaunchInput[] | null {
  const cands = candidates();
  let frontier: { state: CampaignLevelState; seq: LaunchInput[] }[] = [
    { state: createLevel(level), seq: [] },
  ];
  for (let depth = 0; depth < level.launchBudget; depth++) {
    const next: typeof frontier = [];
    const seen = new Set<number>();
    for (const node of frontier) {
      const base = progress(node.state);
      for (const input of cands) {
        const res = simulateCampaignLaunch(node.state, input);
        if (evaluateObjectives(res.state).cleared) return [...node.seq, input];
        if (progress(res.state) > base) {
          const sig = signature(res.state);
          if (!seen.has(sig)) {
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

- [ ] **Step 2: Create `campaign/levels.ts` with the first chapter**

These are starting coordinates. The solvability test (Step 4) is the gate — if any level fails, nudge its coordinates/budget until green. Keep blockers and keys away from the launch pad so the opening shot is never instantly dead.

```ts
import { WORLD_HEIGHT, WORLD_WIDTH } from "../constants";
import type { Level } from "./types";

const BOUNDS = { width: WORLD_WIDTH, height: WORLD_HEIGHT };
const LAUNCH = { x: 80, y: 500 };

function planet(x: number, y: number, radius: number) {
  return { pos: { x, y }, radius, mass: radius * radius, kind: "planet" as const };
}
function blocker(x: number, y: number, radius: number) {
  return { pos: { x, y }, radius, mass: radius * radius, kind: "blocker" as const };
}

export const LEVELS: Level[] = [
  // --- Chapter 1: reach the goal, learn gravity (1-3) ---
  {
    id: "1-1", name: "First Light",
    bodies: [planet(800, 520, 80)],
    keys: [], goal: { pos: { x: 1180, y: 360 }, radius: 40 }, targets: [],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 3,
    objectives: [{ kind: "reach-goal" }], starThresholds: { two: 6, three: 11 },
  },
  {
    id: "1-2", name: "Two Worlds",
    bodies: [planet(620, 360, 64), planet(1040, 640, 72)],
    keys: [], goal: { pos: { x: 1320, y: 360 }, radius: 38 }, targets: [],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 3,
    objectives: [{ kind: "reach-goal" }], starThresholds: { two: 6, three: 11 },
  },
  {
    id: "1-3", name: "Slingshot",
    bodies: [planet(760, 500, 96)],
    keys: [], goal: { pos: { x: 700, y: 640 }, radius: 36 }, targets: [],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 4,
    objectives: [{ kind: "reach-goal" }], starThresholds: { two: 6, three: 11 },
  },

  // --- Chapter 2: blockers (4-6) ---
  {
    id: "2-1", name: "In The Way",
    bodies: [blocker(560, 500, 70), planet(1050, 520, 80)],
    keys: [], goal: { pos: { x: 1180, y: 360 }, radius: 40 }, targets: [],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 4,
    objectives: [{ kind: "reach-goal" }], starThresholds: { two: 6, three: 11 },
  },
  {
    id: "2-2", name: "Bent Path",
    bodies: [planet(640, 360, 80), blocker(980, 560, 60)],
    keys: [], goal: { pos: { x: 1300, y: 420 }, radius: 38 }, targets: [],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 4,
    objectives: [{ kind: "reach-goal" }], starThresholds: { two: 6, three: 11 },
  },
  {
    id: "2-3", name: "Threading",
    bodies: [blocker(560, 420, 56), blocker(720, 700, 56), planet(1080, 520, 84)],
    keys: [], goal: { pos: { x: 1240, y: 360 }, radius: 38 }, targets: [],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 5,
    objectives: [{ kind: "reach-goal" }], starThresholds: { two: 6, three: 11 },
  },
];
```

- [ ] **Step 3: Write the solvability test**

```ts
import { describe, expect, it } from "vitest";
import { LEVELS } from "../src/campaign/levels";
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

  it("every level is solvable within its launch budget", () => {
    for (const lvl of LEVELS) {
      const solution = findSolution(lvl);
      expect(solution, `level ${lvl.id} is unsolvable — adjust its layout`).not.toBeNull();
      expect(solution!.length, lvl.id).toBeLessThanOrEqual(lvl.launchBudget);
    }
  });
});
```

- [ ] **Step 4: Run the solvability test**

Run: `pnpm --filter @apogee/engine exec vitest run tests/campaign-levels.test.ts`
Expected: PASS, 3 tests. If "every level is solvable" fails, the error names the level id — adjust that level's body/goal positions or raise its `launchBudget`, then re-run until green.

- [ ] **Step 5: Confirm the `LEVELS` export is present in `campaign/index.ts`**

Ensure `export { LEVELS } from "./levels";` is in `packages/engine/src/campaign/index.ts` (added in Task 6 Step 1). Run: `pnpm --filter @apogee/engine typecheck` — expected PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/engine/src/campaign/levels.ts packages/engine/tests/campaign-solver.ts packages/engine/tests/campaign-levels.test.ts packages/engine/src/campaign/index.ts
git commit -m "feat(engine): authored level chapter 1-2 and solvability harness"
```

---

## Task 8: Home screen + extract DailyGame (daily behavior unchanged)

Split today's `App` into a `DailyGame` component and a new `App` router with a home screen.

**Files:**
- Create: `packages/web/src/DailyGame.tsx` (today's `App.tsx`, renamed + `onExit`)
- Rewrite: `packages/web/src/App.tsx` (router)
- `packages/web/src/main.tsx` stays unchanged (still imports `App` from `./App`)

- [ ] **Step 1: Create `DailyGame.tsx` as the old App with an exit button**

Copy the current `App.tsx` verbatim, rename the component, add the `onExit` prop and a back button. Full file:

```tsx
import {
  LAUNCHES_PER_DAY,
  createDailyGame,
  isGameOver,
  scoreGame,
  simulateLaunch,
  type GameState,
  type LaunchInput,
  type ProbeFrame,
} from "@apogee/engine";
import { useCallback, useState } from "react";
import { todayString } from "./daily";
import { loadBest, recordScore } from "./storage";
import { GameCanvas } from "./GameCanvas";

interface PendingAnim {
  trace: ProbeFrame[][];
  next: GameState;
}

export function DailyGame({ onExit }: { onExit: () => void }) {
  const [day] = useState(todayString);
  const [game, setGame] = useState(() => createDailyGame(day));
  const [anim, setAnim] = useState<PendingAnim | null>(null);
  const [best, setBest] = useState<number | null>(() => loadBest(localStorage, day));

  const handleLaunch = useCallback(
    (input: LaunchInput) => {
      const { state, trace } = simulateLaunch(game, input);
      setAnim({ trace, next: state });
    },
    [game],
  );

  const handleAnimDone = useCallback(() => {
    if (!anim) return;
    setGame(anim.next);
    setAnim(null);
    if (isGameOver(anim.next)) {
      setBest(recordScore(localStorage, day, scoreGame(anim.next).total));
    }
  }, [anim, day]);

  const score = scoreGame(game);
  const over = isGameOver(game);

  return (
    <>
      <div className="hud">
        <button className="back" onClick={onExit}>← menu</button>
        <h1>APOGEE</h1>
        <span className="stat">{day}</span>
        <span className="stat pips">
          {"●".repeat(LAUNCHES_PER_DAY - game.launchesUsed)}
          {"○".repeat(game.launchesUsed)}
        </span>
        <span className="stat">score {score.total}</span>
      </div>
      <GameCanvas
        game={game}
        disabled={over || anim !== null}
        anim={anim?.trace ?? null}
        onLaunch={handleLaunch}
        onAnimDone={handleAnimDone}
      />
      {over && anim === null && (
        <div className="overlay">
          <div className="total">{score.total} pts</div>
          <div className="pips">{score.perProbe.join(" · ")}</div>
          {best !== null && <div className="stat">best today: {best}</div>}
          <div className="stat">come back tomorrow for a new system</div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Rewrite `App.tsx` as the router**

```tsx
import { useState } from "react";
import { DailyGame } from "./DailyGame";
import { CampaignMap } from "./campaign/CampaignMap";
import { CampaignLevel } from "./campaign/CampaignLevel";

type View =
  | { name: "home" }
  | { name: "daily" }
  | { name: "map" }
  | { name: "level"; index: number };

export function App() {
  const [view, setView] = useState<View>({ name: "home" });

  if (view.name === "daily") {
    return <DailyGame onExit={() => setView({ name: "home" })} />;
  }
  if (view.name === "map") {
    return (
      <CampaignMap
        onExit={() => setView({ name: "home" })}
        onPlay={(index) => setView({ name: "level", index })}
      />
    );
  }
  if (view.name === "level") {
    return (
      <CampaignLevel
        index={view.index}
        onExit={() => setView({ name: "map" })}
        onPlay={(index) => setView({ name: "level", index })}
      />
    );
  }
  return (
    <div className="home">
      <h1>APOGEE</h1>
      <p className="tagline">gravity is the only rule</p>
      <button onClick={() => setView({ name: "daily" })}>Daily Challenge</button>
      <button onClick={() => setView({ name: "map" })}>Campaign</button>
    </div>
  );
}
```

> `CampaignMap` and `CampaignLevel` don't exist yet (Tasks 12-13). To keep this task compiling on its own, create two one-line placeholder stubs now and replace them in their tasks:
> - `packages/web/src/campaign/CampaignMap.tsx`: `export function CampaignMap(_: { onExit: () => void; onPlay: (i: number) => void }) { return <div>map</div>; }`
> - `packages/web/src/campaign/CampaignLevel.tsx`: `export function CampaignLevel(_: { index: number; onExit: () => void; onPlay: (i: number) => void }) { return <div>level</div>; }`

- [ ] **Step 3: Typecheck and run web tests**

Run: `pnpm --filter @apogee/web typecheck && pnpm --filter @apogee/web test`
Expected: PASS (5 storage tests).

- [ ] **Step 4: Manually verify daily still plays**

Run: `pnpm dev`, open the URL, click **Daily Challenge**, play a launch, confirm it behaves exactly as before, use **← menu** to return. Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/App.tsx packages/web/src/DailyGame.tsx packages/web/src/campaign/CampaignMap.tsx packages/web/src/campaign/CampaignLevel.tsx
git commit -m "feat(web): home screen router; extract DailyGame (behavior unchanged)"
```

---

## Task 9: Campaign progress storage

**Files:**
- Create: `packages/web/src/campaign/campaignStorage.ts`
- Test: `packages/web/tests/campaignStorage.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import {
  isUnlocked,
  loadProgress,
  recordResult,
  type CampaignProgress,
} from "../src/campaign/campaignStorage";

function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    get length() {
      return map.size;
    },
  };
}

describe("campaign progress storage", () => {
  it("returns empty progress when nothing is stored", () => {
    expect(loadProgress(fakeStorage())).toEqual({});
  });

  it("records a result and reloads it", () => {
    const s = fakeStorage();
    recordResult(s, "1-1", true, 2);
    expect(loadProgress(s)["1-1"]).toEqual({ cleared: true, stars: 2 });
  });

  it("keeps the best stars and sticky cleared", () => {
    const s = fakeStorage();
    recordResult(s, "1-1", true, 2);
    recordResult(s, "1-1", false, 1); // a worse, failed retry
    expect(loadProgress(s)["1-1"]).toEqual({ cleared: true, stars: 2 });
    recordResult(s, "1-1", true, 3);
    expect(loadProgress(s)["1-1"]).toEqual({ cleared: true, stars: 3 });
  });

  it("treats corrupted storage as empty progress", () => {
    const s = fakeStorage();
    s.setItem("apogee-campaign-progress", "not json");
    expect(loadProgress(s)).toEqual({});
  });

  it("unlocks the first level, and later levels only when the previous is cleared", () => {
    const ids = ["1-1", "1-2", "1-3"];
    const progress: CampaignProgress = { "1-1": { cleared: true, stars: 1 } };
    expect(isUnlocked({}, ids, 0)).toBe(true);
    expect(isUnlocked({}, ids, 1)).toBe(false);
    expect(isUnlocked(progress, ids, 1)).toBe(true);
    expect(isUnlocked(progress, ids, 2)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @apogee/web exec vitest run tests/campaignStorage.test.ts`
Expected: FAIL — cannot resolve `../src/campaign/campaignStorage`.

- [ ] **Step 3: Create `campaign/campaignStorage.ts`**

```ts
export interface LevelProgress {
  cleared: boolean;
  stars: number;
}
export type CampaignProgress = Record<string, LevelProgress>;

const KEY = "apogee-campaign-progress";

export function loadProgress(storage: Pick<Storage, "getItem">): CampaignProgress {
  const raw = storage.getItem(KEY);
  if (raw === null) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    // Corrupted/unexpected shape -> fresh progress (matches daily storage's
    // "treat corrupted values as absent" behavior). Deliberate fallback.
    if (typeof parsed !== "object" || parsed === null) return {};
    return parsed as CampaignProgress;
  } catch {
    return {};
  }
}

/** Merge a result in, keeping best stars and sticky cleared. Returns new progress. */
export function recordResult(
  storage: Storage,
  levelId: string,
  cleared: boolean,
  stars: number,
): CampaignProgress {
  const progress = loadProgress(storage);
  const prev = progress[levelId];
  progress[levelId] = {
    cleared: cleared || (prev?.cleared ?? false),
    stars: Math.max(stars, prev?.stars ?? 0),
  };
  storage.setItem(KEY, JSON.stringify(progress));
  return progress;
}

/** Level `index` is open if it is the first or the previous level is cleared. */
export function isUnlocked(
  progress: CampaignProgress,
  levelIds: string[],
  index: number,
): boolean {
  if (index <= 0) return true;
  const prevId = levelIds[index - 1];
  return prevId !== undefined && (progress[prevId]?.cleared ?? false);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @apogee/web exec vitest run tests/campaignStorage.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/campaign/campaignStorage.ts packages/web/tests/campaignStorage.test.ts
git commit -m "feat(web): campaign progress storage with unlock logic"
```

---

## Task 10: Campaign rendering

Extend `render.ts` with a campaign draw function. Daily's `drawFrame` is untouched.

**Files:**
- Modify: `packages/web/src/render.ts` (append only — do not edit `drawFrame`)

- [ ] **Step 1: Append the campaign view type and draw function to `render.ts`**

Add these imports to the existing import block at the top (extend it; keep the existing names):

```ts
import type { CampaignLevelState, ProbeFrame } from "@apogee/engine";
```

(`ProbeFrame` is already imported — do not duplicate it. Add only `CampaignLevelState`.)

Then append to the bottom of the file:

```ts
export interface CampaignRenderView {
  state: CampaignLevelState;
  probeFrames: ProbeFrame[] | null;
  previewPath: { x: number; y: number }[] | null;
  drag: { dx: number; dy: number } | null;
}

export function drawCampaignFrame(
  ctx: CanvasRenderingContext2D,
  view: CampaignRenderView,
): void {
  const { state } = view;
  const { level } = state;
  ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  // Space + stars (shared starfield).
  ctx.fillStyle = "#0b0e1a";
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  ctx.fillStyle = "#9fa8da";
  for (const s of STARS) {
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Bodies: planets (blue) vs blockers (hostile red with a hazard ring).
  for (const b of level.bodies) {
    if (b.kind === "blocker") {
      ctx.fillStyle = "#4d2026";
      ctx.beginPath();
      ctx.arc(b.pos.x, b.pos.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#e0564a";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.strokeStyle = "rgba(224, 86, 74, 0.35)";
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.arc(b.pos.x, b.pos.y, b.radius + PROBE_RADIUS + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      ctx.fillStyle = "#26334d";
      ctx.beginPath();
      ctx.arc(b.pos.x, b.pos.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#52628a";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }

  // Targets: open marks that fill in when hit.
  level.targets.forEach((t, i) => {
    const hit = state.targetsHit[i] ?? false;
    ctx.strokeStyle = hit ? "#a5d6a7" : "#ffb74d";
    ctx.fillStyle = hit ? "rgba(165, 214, 167, 0.5)" : "rgba(255, 183, 77, 0.12)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(t.pos.x, t.pos.y, t.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  // Keys: glinting diamonds, dimmed once collected.
  level.keys.forEach((k, i) => {
    const got = state.keysCollected[i] ?? false;
    ctx.globalAlpha = got ? 0.25 : 1;
    ctx.fillStyle = "#ffd54f";
    ctx.beginPath();
    ctx.moveTo(k.pos.x, k.pos.y - k.radius);
    ctx.lineTo(k.pos.x + k.radius, k.pos.y);
    ctx.lineTo(k.pos.x, k.pos.y + k.radius);
    ctx.lineTo(k.pos.x - k.radius, k.pos.y);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  });

  // Goal: a ring/portal — dashed + locked color until keys are collected.
  if (level.goal) {
    const unlocked = state.keysCollected.every(Boolean);
    ctx.strokeStyle = unlocked ? "#80cbc4" : "#5c6b8a";
    ctx.lineWidth = 4;
    if (!unlocked) ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.arc(level.goal.pos.x, level.goal.pos.y, level.goal.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = unlocked ? "rgba(128, 203, 196, 0.18)" : "rgba(92, 107, 138, 0.12)";
    ctx.fill();
  }

  // Launch pad.
  const lp = level.launchPos;
  ctx.strokeStyle = "#80cbc4";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(lp.x, lp.y, 14, 0, Math.PI * 2);
  ctx.stroke();

  // Aiming preview + drag.
  if (view.previewPath && view.previewPath.length > 1) {
    ctx.strokeStyle = "rgba(255, 213, 79, 0.8)";
    ctx.setLineDash([6, 8]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(view.previewPath[0]!.x, view.previewPath[0]!.y);
    for (const pt of view.previewPath) ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (view.drag) {
    ctx.strokeStyle = "#80cbc4";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(lp.x, lp.y);
    ctx.lineTo(lp.x + view.drag.dx, lp.y + view.drag.dy);
    ctx.stroke();
  }

  // Probes.
  const frames: ProbeFrame[] =
    view.probeFrames ??
    state.probes.map((p) => ({ x: p.pos.x, y: p.pos.y, state: p.state }));
  for (const f of frames) {
    if (f.state === "lost") continue;
    ctx.fillStyle = f.state === "landed" ? "#a5d6a7" : "#ffffff";
    ctx.beginPath();
    ctx.arc(f.x, f.y, PROBE_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @apogee/web typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/render.ts
git commit -m "feat(web): campaign renderer (blockers, keys, goal, targets)"
```

---

## Task 11: Campaign canvas (aiming + animation)

A campaign sibling of `GameCanvas`. Mirrors its pointer/animation logic but uses `simulateCampaignLaunch` for the preview and `drawCampaignFrame` for rendering. `GameCanvas.tsx` is left untouched (daily safety).

**Files:**
- Create: `packages/web/src/campaign/CampaignCanvas.tsx`

- [ ] **Step 1: Create `CampaignCanvas.tsx`**

```tsx
import {
  PREVIEW_STEPS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  simulateCampaignLaunch,
  type CampaignLevelState,
  type LaunchInput,
  type ProbeFrame,
} from "@apogee/engine";
import { useEffect, useRef } from "react";
import { drawCampaignFrame } from "../render";

interface Props {
  state: CampaignLevelState;
  disabled: boolean;
  anim: ProbeFrame[][] | null;
  onLaunch: (input: LaunchInput) => void;
  onAnimDone: () => void;
}

function toWorld(canvas: HTMLCanvasElement, e: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) * WORLD_WIDTH) / rect.width,
    y: ((e.clientY - rect.top) * WORLD_HEIGHT) / rect.height,
  };
}

export function CampaignCanvas({ state, disabled, anim, onLaunch, onAnimDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  // Animation playback.
  useEffect(() => {
    if (!anim) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) {
      onAnimDone();
      return;
    }
    let frame = 0;
    let raf = 0;
    const tick = () => {
      const probeFrames = anim[Math.min(frame, anim.length - 1)] ?? null;
      drawCampaignFrame(ctx, { state, probeFrames, previewPath: null, drag: null });
      frame++;
      if (frame < anim.length) {
        raf = requestAnimationFrame(tick);
      } else {
        onAnimDone();
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [anim, state, onAnimDone]);

  // Idle rendering + aiming.
  useEffect(() => {
    if (anim) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const redraw = () => {
      const drag = dragRef.current;
      let previewPath: { x: number; y: number }[] | null = null;
      if (drag && (drag.dx !== 0 || drag.dy !== 0)) {
        const { trace } = simulateCampaignLaunch(state, drag, PREVIEW_STEPS);
        const newProbeIndex = state.probes.length;
        previewPath = trace
          .map((f) => f[newProbeIndex])
          .filter((f): f is ProbeFrame => f !== undefined && f.state === "flying")
          .map((f) => ({ x: f.x, y: f.y }));
      }
      drawCampaignFrame(ctx, { state, probeFrames: null, previewPath, drag });
    };

    const onDown = (e: PointerEvent) => {
      if (disabled) return;
      canvas.setPointerCapture(e.pointerId);
      dragRef.current = { dx: 0, dy: 0 };
      redraw();
    };
    const onMove = (e: PointerEvent) => {
      if (!dragRef.current) return;
      const w = toWorld(canvas, e);
      dragRef.current = {
        dx: state.level.launchPos.x - w.x,
        dy: state.level.launchPos.y - w.y,
      };
      redraw();
    };
    const onUp = () => {
      const drag = dragRef.current;
      dragRef.current = null;
      redraw();
      if (drag && (drag.dx !== 0 || drag.dy !== 0)) onLaunch(drag);
    };
    const onCancel = () => {
      dragRef.current = null;
      redraw();
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onCancel);
    redraw();
    return () => {
      dragRef.current = null;
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onCancel);
    };
  }, [state, disabled, anim, onLaunch]);

  return <canvas ref={canvasRef} width={WORLD_WIDTH} height={WORLD_HEIGHT} />;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @apogee/web typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/campaign/CampaignCanvas.tsx
git commit -m "feat(web): campaign canvas with aiming preview and animation"
```

---

## Task 12: Campaign level screen

Replace the `CampaignLevel` stub with the real play loop: objective HUD, launches remaining, level-over card with stars / retry / next.

**Files:**
- Rewrite: `packages/web/src/campaign/CampaignLevel.tsx`

- [ ] **Step 1: Rewrite `CampaignLevel.tsx`**

```tsx
import {
  LEVELS,
  createLevel,
  evaluateObjectives,
  isLevelOver,
  simulateCampaignLaunch,
  starRating,
  type CampaignLevelState,
  type LaunchInput,
  type ProbeFrame,
} from "@apogee/engine";
import { useCallback, useMemo, useState } from "react";
import { recordResult } from "./campaignStorage";
import { CampaignCanvas } from "./CampaignCanvas";

interface Props {
  index: number;
  onExit: () => void;
  onPlay: (index: number) => void;
}

interface PendingAnim {
  trace: ProbeFrame[][];
  next: CampaignLevelState;
}

export function CampaignLevel({ index, onExit, onPlay }: Props) {
  const level = LEVELS[index]!;
  // `level` is keyed in `useState` init; remounting via key (below) resets cleanly.
  const [state, setState] = useState<CampaignLevelState>(() => createLevel(level));
  const [anim, setAnim] = useState<PendingAnim | null>(null);
  const [saved, setSaved] = useState(false);

  const handleLaunch = useCallback(
    (input: LaunchInput) => {
      const { state: next, trace } = simulateCampaignLaunch(state, input);
      setAnim({ trace, next });
    },
    [state],
  );

  const handleAnimDone = useCallback(() => {
    if (!anim) return;
    const next = anim.next;
    setState(next);
    setAnim(null);
    if (isLevelOver(next) && !saved) {
      const { cleared } = evaluateObjectives(next);
      recordResult(localStorage, next.level.id, cleared, starRating(next).stars);
      setSaved(true);
    }
  }, [anim, saved]);

  const { cleared } = evaluateObjectives(state);
  const over = isLevelOver(state) && anim === null;
  const rating = starRating(state);
  const launchesLeft = level.launchBudget - state.launchesUsed;
  const hasNext = index + 1 < LEVELS.length;

  const objectiveText = useMemo(() => describeObjectives(state), [state]);

  return (
    <>
      <div className="hud">
        <button className="back" onClick={onExit}>← levels</button>
        <h1>{level.name}</h1>
        <span className="stat">{objectiveText}</span>
        <span className="stat pips">
          {"●".repeat(Math.max(0, launchesLeft))}
          {"○".repeat(state.launchesUsed)}
        </span>
      </div>
      <CampaignCanvas
        state={state}
        disabled={over || anim !== null}
        anim={anim?.trace ?? null}
        onLaunch={handleLaunch}
        onAnimDone={handleAnimDone}
      />
      {over && (
        <div className="overlay">
          <div className="total">{cleared ? "★".repeat(rating.stars) + "☆".repeat(3 - rating.stars) : "out of launches"}</div>
          <div className="stat">{cleared ? `cleared — score ${rating.levelScore}` : "objective not met"}</div>
          <div className="actions">
            <button onClick={() => onPlay(index)}>Retry</button>
            {cleared && hasNext && <button onClick={() => onPlay(index + 1)}>Next →</button>}
            <button onClick={onExit}>Levels</button>
          </div>
        </div>
      )}
    </>
  );
}

function describeObjectives(state: CampaignLevelState): string {
  const parts: string[] = [];
  if (state.level.keys.length > 0) {
    parts.push(`keys ${state.keysCollected.filter(Boolean).length}/${state.level.keys.length}`);
  }
  if (state.level.targets.length > 0) {
    parts.push(`targets ${state.targetsHit.filter(Boolean).length}/${state.level.targets.length}`);
  }
  if (state.level.objectives.some((o) => o.kind === "reach-goal")) {
    parts.push(state.goalReached ? "goal ✓" : state.keysCollected.every(Boolean) ? "reach goal" : "goal locked");
  }
  return parts.join("  ·  ");
}
```

> Remount-on-retry: `CampaignLevel` holds its play state in `useState`, so it must be **remounted** both when `index` changes and when the player retries the same index. React only remounts when the `key` changes, so drive the key with an incrementing counter in `App`. Task 12 Step 2 applies this; the resulting `App` uses:
> ```tsx
> const [playCount, setPlayCount] = useState(0);
> const play = (index: number) => { setPlayCount((n) => n + 1); setView({ name: "level", index }); };
> // ...pass onPlay={play} to BOTH CampaignMap and CampaignLevel
> // ...render the level view as:
> //   <CampaignLevel key={`${view.index}-${playCount}`} index={view.index} onExit={() => setView({ name: "map" })} onPlay={play} />
> ```
> Every "Retry"/"Next" calls `play(...)`, which bumps `playCount` and changes the key, forcing a fresh mount with fresh `createLevel` state.

- [ ] **Step 2: Apply the `App.tsx` remount fix described above**

Edit `packages/web/src/App.tsx`: add the `playCount` state and `play` helper, pass `play` as `onPlay` to both `CampaignMap` and `CampaignLevel`, and key the level view with `` key={`${view.index}-${playCount}`} ``.

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @apogee/web typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/campaign/CampaignLevel.tsx packages/web/src/App.tsx
git commit -m "feat(web): campaign level play screen with objectives and stars"
```

---

## Task 13: Campaign level map

Replace the `CampaignMap` stub with the level grid: tiles showing number, stars, lock state.

**Files:**
- Rewrite: `packages/web/src/campaign/CampaignMap.tsx`

- [ ] **Step 1: Rewrite `CampaignMap.tsx`**

```tsx
import { LEVELS } from "@apogee/engine";
import { useMemo } from "react";
import { isUnlocked, loadProgress } from "./campaignStorage";

interface Props {
  onExit: () => void;
  onPlay: (index: number) => void;
}

export function CampaignMap({ onExit, onPlay }: Props) {
  const progress = useMemo(() => loadProgress(localStorage), []);
  const ids = LEVELS.map((l) => l.id);

  return (
    <>
      <div className="hud">
        <button className="back" onClick={onExit}>← menu</button>
        <h1>Campaign</h1>
      </div>
      <div className="level-grid">
        {LEVELS.map((level, i) => {
          const unlocked = isUnlocked(progress, ids, i);
          const p = progress[level.id];
          const stars = p?.stars ?? 0;
          return (
            <button
              key={level.id}
              className={`level-tile${unlocked ? "" : " locked"}`}
              disabled={!unlocked}
              onClick={() => onPlay(i)}
            >
              <span className="num">{i + 1}</span>
              <span className="name">{level.name}</span>
              <span className="stars">
                {unlocked ? "★".repeat(stars) + "☆".repeat(3 - stars) : "🔒"}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Typecheck + web tests**

Run: `pnpm --filter @apogee/web typecheck && pnpm --filter @apogee/web test`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/campaign/CampaignMap.tsx
git commit -m "feat(web): campaign level map with unlocks and star display"
```

---

## Task 14: Styles for home, map, and overlays

**Files:**
- Modify: `packages/web/src/styles.css` (append)

- [ ] **Step 1: Append to `styles.css`**

```css
.back { background: none; border: none; color: #80cbc4; cursor: pointer; font-size: 0.9rem; }
.home { display: flex; flex-direction: column; align-items: center; gap: 16px; margin-top: 18vh; }
.home h1 { font-size: 2.4rem; letter-spacing: 0.3em; }
.home .tagline { opacity: 0.6; margin-bottom: 8px; }
.home button, .actions button, .level-tile {
  font: inherit; cursor: pointer; border-radius: 8px;
  border: 1px solid #52628a; background: #1a2238; color: #e8eaf6; padding: 10px 18px;
}
.home button:hover, .actions button:hover, .level-tile:not(.locked):hover { border-color: #80cbc4; }
.actions { display: flex; gap: 12px; justify-content: center; margin-top: 12px; }
.level-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px; max-width: 1100px; width: 100%;
}
.level-tile { display: flex; flex-direction: column; gap: 4px; align-items: flex-start; min-height: 84px; }
.level-tile .num { font-size: 1.4rem; font-weight: 700; }
.level-tile .name { opacity: 0.8; font-size: 0.85rem; }
.level-tile .stars { letter-spacing: 0.15em; color: #ffd54f; }
.level-tile.locked { opacity: 0.5; cursor: not-allowed; }
```

- [ ] **Step 2: Manual visual check**

Run: `pnpm dev`. From home: open **Campaign**, confirm the grid shows tile 1 unlocked and the rest locked. Play tile 1, confirm bodies/goal render, aim+launch animates, and the level-over card shows stars or "out of launches". Stop the server.

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/styles.css
git commit -m "style(web): home, level map, and campaign overlay styles"
```

---

## Task 15: Author the remaining levels (chapters 3–5)

Extend `LEVELS` to ~15 with the key and target mechanics, using the solvability test as the gate. Each new level must pass `campaign-levels.test.ts`.

**Files:**
- Modify: `packages/engine/src/campaign/levels.ts`
- Test (gate): `packages/engine/tests/campaign-levels.test.ts`

- [ ] **Step 1: Add chapter 3 (keys, levels 7–9) to the `LEVELS` array**

Append these entries (starting coordinates — the solver validates them). Keys gate the goal, so budget ≥ 2.

```ts
  // --- Chapter 3: collect a key, then reach the goal (7-9) ---
  {
    id: "3-1", name: "The Key",
    bodies: [planet(820, 520, 76)],
    keys: [{ pos: { x: 480, y: 300 }, radius: 28 }],
    goal: { pos: { x: 1180, y: 360 }, radius: 40 }, targets: [],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 3,
    objectives: [{ kind: "reach-goal" }], starThresholds: { two: 6, three: 11 },
  },
  {
    id: "3-2", name: "Hidden Key",
    bodies: [planet(700, 420, 84), planet(1120, 640, 70)],
    keys: [{ pos: { x: 760, y: 640 }, radius: 26 }],
    goal: { pos: { x: 1320, y: 360 }, radius: 38 }, targets: [],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 3,
    objectives: [{ kind: "reach-goal" }], starThresholds: { two: 6, three: 11 },
  },
  {
    id: "3-3", name: "Key & Guard",
    bodies: [blocker(620, 520, 60), planet(1040, 460, 80)],
    keys: [{ pos: { x: 520, y: 280 }, radius: 26 }],
    goal: { pos: { x: 1220, y: 620 }, radius: 38 }, targets: [],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 4,
    objectives: [{ kind: "reach-goal" }], starThresholds: { two: 6, three: 11 },
  },
```

- [ ] **Step 2: Add chapter 4 (targets, levels 10–12)**

```ts
  // --- Chapter 4: hit every target (10-12) ---
  {
    id: "4-1", name: "Double Tap",
    bodies: [planet(840, 520, 74)],
    keys: [], goal: undefined,
    targets: [{ pos: { x: 1120, y: 320 }, radius: 26 }, { pos: { x: 1120, y: 720 }, radius: 26 }],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 4,
    objectives: [{ kind: "hit-all-targets" }], starThresholds: { two: 6, three: 11 },
  },
  {
    id: "4-2", name: "Spread",
    bodies: [planet(700, 380, 70), planet(1000, 680, 74)],
    keys: [], goal: undefined,
    targets: [{ pos: { x: 520, y: 700 }, radius: 24 }, { pos: { x: 1280, y: 360 }, radius: 24 }, { pos: { x: 1300, y: 720 }, radius: 24 }],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 5,
    objectives: [{ kind: "hit-all-targets" }], starThresholds: { two: 6, three: 11 },
  },
  {
    id: "4-3", name: "Guarded Marks",
    bodies: [blocker(720, 520, 64), planet(1100, 520, 78)],
    keys: [], goal: undefined,
    targets: [{ pos: { x: 980, y: 300 }, radius: 24 }, { pos: { x: 980, y: 740 }, radius: 24 }],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 5,
    objectives: [{ kind: "hit-all-targets" }], starThresholds: { two: 6, three: 11 },
  },
```

- [ ] **Step 3: Add chapter 5 (combined, levels 13–15)**

```ts
  // --- Chapter 5: combine everything (13-15) ---
  {
    id: "5-1", name: "Key & Marks",
    bodies: [planet(820, 540, 76)],
    keys: [{ pos: { x: 460, y: 300 }, radius: 26 }],
    goal: { pos: { x: 1240, y: 360 }, radius: 38 },
    targets: [{ pos: { x: 1080, y: 720 }, radius: 24 }],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 5,
    objectives: [{ kind: "hit-all-targets" }, { kind: "reach-goal" }], starThresholds: { two: 8, three: 14 },
  },
  {
    id: "5-2", name: "Tight Squeeze",
    bodies: [blocker(560, 420, 56), blocker(700, 700, 56), planet(1080, 500, 82)],
    keys: [{ pos: { x: 520, y: 600 }, radius: 26 }],
    goal: { pos: { x: 1260, y: 360 }, radius: 36 }, targets: [],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 4,
    objectives: [{ kind: "reach-goal" }], starThresholds: { two: 6, three: 11 },
  },
  {
    id: "5-3", name: "Apogee",
    bodies: [blocker(620, 460, 58), planet(940, 640, 78), blocker(1180, 380, 54)],
    keys: [{ pos: { x: 500, y: 700 }, radius: 26 }],
    goal: { pos: { x: 1360, y: 640 }, radius: 36 },
    targets: [{ pos: { x: 900, y: 280 }, radius: 24 }],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 6,
    objectives: [{ kind: "hit-all-targets" }, { kind: "reach-goal" }], starThresholds: { two: 9, three: 15 },
  },
```

- [ ] **Step 4: Run the solvability gate and fix any unsolvable level**

Run: `pnpm --filter @apogee/engine exec vitest run tests/campaign-levels.test.ts`
Expected: PASS, 3 tests over all 15 levels. If a level id is reported unsolvable, adjust that level's body/key/goal/target positions (move hazards off the only viable path, enlarge a goal radius, or raise `launchBudget`) and re-run until green. The solver explores 96 directions × 7 powers per launch, so a level it can't solve is genuinely too hard / impossible — fix the layout, don't weaken the test.

- [ ] **Step 5: Run the full suite**

Run: `pnpm test`
Expected: PASS (engine + web). Daily golden snapshot unchanged.

- [ ] **Step 6: Commit**

```bash
git add packages/engine/src/campaign/levels.ts
git commit -m "feat(engine): author campaign chapters 3-5 (keys, targets, combined)"
```

---

## Task 16: Full verification and manual playtest

**Files:** none (verification only)

- [ ] **Step 1: Typecheck and test everything**

Run: `pnpm typecheck && pnpm test`
Expected: PASS across both packages. Confirm `golden.test.ts.snap` (daily) is unmodified in `git status`.

- [ ] **Step 2: Manual playtest both modes**

Run: `pnpm dev`. Verify:
- Home → **Daily Challenge** plays exactly as before; **← menu** returns.
- Home → **Campaign** shows the 15-tile grid; only level 1 unlocked initially.
- Play level 1 to a clear: stars appear; **Next →** advances; level 2 is now unlocked on the map.
- A key level: the goal renders locked (dashed) until you fly a probe through the key, then renders unlocked; reaching it clears the level.
- A blocker level: a probe touching the blocker is lost (no landing).
- A target level: each target fills in when hit; clearing requires all.
- Reload the page → campaign progress (cleared + stars) persists; daily best persists.
Stop the server.

- [ ] **Step 3: Final commit (if any playtest tweaks were needed)**

```bash
git add -A
git commit -m "chore: campaign mode playtest fixes"
```

- [ ] **Step 4: Finish the branch**

Use the superpowers:finishing-a-development-branch skill to decide how to integrate `feature/campaign-mode` (merge to master / open a PR / keep iterating).

---

## Notes for the implementer

- **Determinism is sacred.** Never call `Math.sin/cos/pow/random` or `Date.now()` inside `packages/engine/src` (the solver in `tests/` may use trig — it is not the sim). The campaign step uses only the shared primitives, which are `+ − × ÷ sqrt`.
- **Daily must not move.** If `golden.test.ts.snap` (daily) ever changes, stop — something touched the daily path. Only `campaign-golden.test.ts.snap` is new.
- **Levels are data.** Tuning difficulty = editing `levels.ts` and re-running the solvability test. No engine change needed.
- **Why a separate `CampaignCanvas` instead of reusing `GameCanvas`:** keeping daily's canvas untouched eliminates regression risk on the working game; the shared rendering primitives (starfield, probe drawing) already live in `render.ts`. This is a deliberate, spec-aligned tradeoff (daily byte-stability over DRY on ~40 lines of pointer glue).
```
