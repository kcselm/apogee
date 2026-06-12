# Apogee Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A playable, client-only daily space-curling game: seeded star system per day, 5 slingshot launches with partial trajectory preview, precision-landing scoring, local best score.

**Architecture:** pnpm monorepo with two packages. `@apogee/engine` is a pure, zero-dependency, deterministic TypeScript simulation (fixed timestep, seeded PRNG, no trig in numeric paths). `@apogee/web` is a React + Vite app with a raw canvas-2D renderer that consumes the engine. The web app never computes physics itself — it only calls the engine and draws what it returns.

**Tech Stack:** TypeScript (strict), pnpm workspaces, Vitest (engine tests), React 19 + Vite (web). No server, no TanStack Query, no Zod in Phase 1 (YAGNI — those arrive in Phase 2 with the backend per the spec).

**Spec:** `docs/superpowers/specs/2026-06-11-apogee-design.md`

**Determinism rules (apply to every engine task):**
- Numeric code in the simulation may use only `+ - * /` and `Math.sqrt` (exactly specified by IEEE 754). **Never** `Math.sin/cos/tan/pow/hypot/random` — they vary across JS engines.
- Random directions come from rejection-sampling a unit vector with the seeded PRNG (no trig).
- `LaunchInput` is a raw drag vector `{dx, dy}` — the engine derives speed via `sqrt`, so no angles exist anywhere.
- Fixed timestep `DT`; nothing in the engine reads clocks, frame times, or `Math.random()`.

## File structure

```
apogee/
├── package.json                  (root: workspace scripts)
├── pnpm-workspace.yaml
├── packages/
│   ├── engine/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   │   ├── constants.ts      (all tuning numbers, one place)
│   │   │   ├── types.ts          (Vec2, Planet, Zone, StarSystem, Probe, GameState...)
│   │   │   ├── rng.ts            (mulberry32 PRNG, FNV-1a string hash)
│   │   │   ├── physics.ts        (gravity, integration, landing, collision, void)
│   │   │   ├── generation.ts     (seeded system generation + validity checks)
│   │   │   ├── scoring.ts        (ring scoring)
│   │   │   ├── game.ts           (createGame, createDailyGame, simulateLaunch, isGameOver)
│   │   │   └── index.ts          (public exports)
│   │   └── tests/                (one test file per src module)
│   └── web/
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── index.html
│       └── src/
│           ├── main.tsx
│           ├── App.tsx           (game state machine, HUD, end screen)
│           ├── GameCanvas.tsx    (canvas, pointer input, animation loop)
│           ├── render.ts         (pure draw functions)
│           ├── daily.ts          (today's date string)
│           ├── storage.ts        (best-score persistence, storage injected)
│           └── styles.css
```

---

### Task 1: Monorepo scaffold + engine package skeleton

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `.gitignore`
- Create: `packages/engine/package.json`, `packages/engine/tsconfig.json`
- Create: `packages/engine/src/index.ts`, `packages/engine/tests/smoke.test.ts`

- [ ] **Step 1: Create root workspace files**

`package.json`:
```json
{
  "name": "apogee",
  "private": true,
  "scripts": {
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck",
    "dev": "pnpm --filter @apogee/web dev"
  }
}
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - "packages/*"
```

`.gitignore`:
```
node_modules/
dist/
*.local
```

- [ ] **Step 2: Create engine package**

`packages/engine/package.json`:
```json
{
  "name": "@apogee/engine",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^3.0.0"
  }
}
```

`packages/engine/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src", "tests"]
}
```

`packages/engine/src/index.ts`:
```ts
export const ENGINE_VERSION = "0.1.0";
```

`packages/engine/tests/smoke.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { ENGINE_VERSION } from "../src/index";

describe("engine package", () => {
  it("is wired up", () => {
    expect(ENGINE_VERSION).toBe("0.1.0");
  });
});
```

- [ ] **Step 3: Install and verify**

Run: `pnpm install` (from repo root `C:\Users\kcsel\repo\apogee`)
Run: `pnpm --filter @apogee/engine test`
Expected: 1 test passes.
Run: `pnpm --filter @apogee/engine typecheck`
Expected: exits 0, no output.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: scaffold pnpm monorepo with engine package"
```

---

### Task 2: Engine types and constants

**Files:**
- Create: `packages/engine/src/constants.ts`
- Create: `packages/engine/src/types.ts`

No tests (type-only + constants); verified by typecheck. Every later task imports from these two files — names here are canonical.

- [ ] **Step 1: Write constants**

`packages/engine/src/constants.ts`:
```ts
/** Fixed simulation timestep (seconds). Frame rate must never affect physics. */
export const DT = 1 / 60;
/** Gravitational constant, tuned for feel with mass = radius^2. */
export const GRAVITY = 5000;
export const PROBE_RADIUS = 5;
/** Launch speed cap (world units / s). */
export const MAX_SPEED = 600;
/** Drag-vector length to launch-speed multiplier. */
export const POWER_SCALE = 3;
/** Max sim steps per launch (~45s); anything still flying after is lost. */
export const MAX_STEPS = 2700;
/** Steps shown in the aiming preview (~1.5s of flight). */
export const PREVIEW_STEPS = 90;
export const LAUNCHES_PER_DAY = 5;
export const WORLD_WIDTH = 1600;
export const WORLD_HEIGHT = 1000;
/** How far beyond bounds a probe may fly before it counts as lost. */
export const VOID_MARGIN = 200;
```

- [ ] **Step 2: Write types**

`packages/engine/src/types.ts`:
```ts
export interface Vec2 {
  x: number;
  y: number;
}

export interface Planet {
  pos: Vec2;
  radius: number;
  /** = radius * radius (set at generation). */
  mass: number;
}

/** A bullseye point on a planet's surface. */
export interface Zone {
  planetIndex: number;
  center: Vec2;
}

export interface StarSystem {
  planets: Planet[];
  zones: Zone[];
  launchPos: Vec2;
  bounds: { width: number; height: number };
}

export type ProbeState = "flying" | "landed" | "lost";

export interface Probe {
  pos: Vec2;
  vel: Vec2;
  state: ProbeState;
}

/** Raw drag vector from aiming; engine derives direction and clamped speed. */
export interface LaunchInput {
  dx: number;
  dy: number;
}

/** One probe's position+state at one sim step (for animation/preview). */
export interface ProbeFrame {
  x: number;
  y: number;
  state: ProbeState;
}

export interface GameState {
  system: StarSystem;
  probes: Probe[];
  launchesUsed: number;
}
```

- [ ] **Step 3: Verify and commit**

Run: `pnpm --filter @apogee/engine typecheck`
Expected: exits 0.

```bash
git add packages/engine/src/constants.ts packages/engine/src/types.ts
git commit -m "feat(engine): add core types and tuning constants"
```

---

### Task 3: Seeded PRNG and string hash

**Files:**
- Create: `packages/engine/src/rng.ts`
- Test: `packages/engine/tests/rng.test.ts`

- [ ] **Step 1: Write the failing tests**

`packages/engine/tests/rng.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { hashString, mulberry32 } from "../src/rng";

describe("mulberry32", () => {
  it("produces the same sequence for the same seed", () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    for (let i = 0; i < 100; i++) {
      expect(a()).toBe(b());
    }
  });

  it("produces different sequences for different seeds", () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    const aVals = Array.from({ length: 10 }, () => a());
    const bVals = Array.from({ length: 10 }, () => b());
    expect(aVals).not.toEqual(bVals);
  });

  it("produces values in [0, 1)", () => {
    const rng = mulberry32(999);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("hashString", () => {
  it("is deterministic", () => {
    expect(hashString("2026-06-11")).toBe(hashString("2026-06-11"));
  });

  it("differs for different strings", () => {
    expect(hashString("2026-06-11")).not.toBe(hashString("2026-06-12"));
  });

  it("returns an unsigned 32-bit integer", () => {
    const h = hashString("apogee");
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @apogee/engine test`
Expected: FAIL — cannot resolve `../src/rng`.

- [ ] **Step 3: Implement**

`packages/engine/src/rng.ts`:
```ts
/** Mulberry32: tiny, fast, deterministic 32-bit PRNG. Generation-time only. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a 32-bit hash; turns a date string into a daily seed. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @apogee/engine test`
Expected: all rng tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src/rng.ts packages/engine/tests/rng.test.ts
git commit -m "feat(engine): seeded PRNG (mulberry32) and FNV-1a date hash"
```

---

### Task 4: Gravity and integration

**Files:**
- Create: `packages/engine/src/physics.ts`
- Test: `packages/engine/tests/physics.test.ts`

Hand-computable fixture used throughout: a planet of radius 60 (mass 3600) at distance 300 pulls with `a = GRAVITY * 3600 / 300^2 = 5000 * 3600 / 90000 = 200`.

- [ ] **Step 1: Write the failing tests**

`packages/engine/tests/physics.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { DT } from "../src/constants";
import { gravityAt, stepProbes } from "../src/physics";
import type { Planet, Probe, StarSystem } from "../src/types";

function makePlanet(x: number, y: number, radius = 60): Planet {
  return { pos: { x, y }, radius, mass: radius * radius };
}

function makeSystem(planets: Planet[]): StarSystem {
  return {
    planets,
    zones: [],
    launchPos: { x: 80, y: 500 },
    bounds: { width: 1600, height: 1000 },
  };
}

function makeProbe(x: number, y: number, vx = 0, vy = 0): Probe {
  return { pos: { x, y }, vel: { x: vx, y: vy }, state: "flying" };
}

describe("gravityAt", () => {
  it("pulls toward a single planet with a = G*m/d^2", () => {
    const planets = [makePlanet(300, 0)];
    const { ax, ay } = gravityAt(planets, 0, 0);
    expect(ax).toBeCloseTo(200, 6);
    expect(ay).toBeCloseTo(0, 6);
  });

  it("is symmetric on the other side", () => {
    const planets = [makePlanet(300, 0)];
    const { ax } = gravityAt(planets, 600, 0);
    expect(ax).toBeCloseTo(-200, 6);
  });

  it("sums contributions from multiple planets", () => {
    // Two identical planets equidistant left and right: pulls cancel.
    const planets = [makePlanet(-300, 0), makePlanet(300, 0)];
    const { ax, ay } = gravityAt(planets, 0, 0);
    expect(ax).toBeCloseTo(0, 6);
    expect(ay).toBeCloseTo(0, 6);
  });
});

describe("stepProbes integration", () => {
  it("accelerates a resting probe toward the planet (semi-implicit Euler)", () => {
    const system = makeSystem([makePlanet(300, 0)]);
    const probe = makeProbe(0, 0);
    stepProbes(system, [probe]);
    expect(probe.vel.x).toBeCloseTo(200 * DT, 6);
    expect(probe.pos.x).toBeCloseTo(200 * DT * DT, 6);
  });

  it("does not move landed or lost probes", () => {
    const system = makeSystem([makePlanet(300, 0)]);
    const landed: Probe = { pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, state: "landed" };
    const lost: Probe = { pos: { x: 0, y: 100 }, vel: { x: 0, y: 0 }, state: "lost" };
    stepProbes(system, [landed, lost]);
    expect(landed.pos).toEqual({ x: 0, y: 0 });
    expect(lost.pos).toEqual({ x: 0, y: 100 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @apogee/engine test`
Expected: FAIL — cannot resolve `../src/physics`.

- [ ] **Step 3: Implement gravity + integration only**

`packages/engine/src/physics.ts`:
```ts
import { DT, GRAVITY } from "./constants";
import type { Planet, Probe, StarSystem } from "./types";

/** Net gravitational acceleration at a point. Only + - * / sqrt — determinism. */
export function gravityAt(
  planets: Planet[],
  x: number,
  y: number,
): { ax: number; ay: number } {
  let ax = 0;
  let ay = 0;
  for (const p of planets) {
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

/** Advance all probes one fixed timestep. Mutates the probes array in place. */
export function stepProbes(system: StarSystem, probes: Probe[]): void {
  for (const probe of probes) {
    if (probe.state !== "flying") continue;
    const { ax, ay } = gravityAt(system.planets, probe.pos.x, probe.pos.y);
    probe.vel.x += ax * DT;
    probe.vel.y += ay * DT;
    probe.pos.x += probe.vel.x * DT;
    probe.pos.y += probe.vel.y * DT;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @apogee/engine test`
Expected: all physics tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src/physics.ts packages/engine/tests/physics.test.ts
git commit -m "feat(engine): gravity field and fixed-timestep integration"
```

---

### Task 5: Landing, void, and probe collisions

**Files:**
- Modify: `packages/engine/src/physics.ts` (extend `stepProbes`)
- Test: `packages/engine/tests/physics.test.ts` (append)

- [ ] **Step 1: Write the failing tests (append to physics.test.ts)**

```ts
import { PROBE_RADIUS, VOID_MARGIN } from "../src/constants";

describe("landing", () => {
  it("lands a probe touching a planet surface and snaps it to the surface", () => {
    const planet = makePlanet(300, 0);
    const system = makeSystem([planet]);
    // Just inside the landing distance, moving inward.
    const probe = makeProbe(300 - planet.radius - PROBE_RADIUS + 1, 0, 50, 0);
    stepProbes(system, [probe]);
    expect(probe.state).toBe("landed");
    const dx = probe.pos.x - planet.pos.x;
    const dy = probe.pos.y - planet.pos.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    expect(d).toBeCloseTo(planet.radius + PROBE_RADIUS, 6);
    expect(probe.vel).toEqual({ x: 0, y: 0 });
  });
});

describe("void", () => {
  it("marks a probe lost beyond bounds + margin", () => {
    const system = makeSystem([makePlanet(800, 2000)]); // far away, weak pull
    const probe = makeProbe(system.bounds.width + VOID_MARGIN + 50, 500, 1, 0);
    stepProbes(system, [probe]);
    expect(probe.state).toBe("lost");
  });

  it("does not mark a probe inside the margin", () => {
    const system = makeSystem([makePlanet(800, 2000)]);
    const probe = makeProbe(system.bounds.width + 50, 500, 0, 0);
    stepProbes(system, [probe]);
    expect(probe.state).toBe("flying");
  });
});

describe("probe-probe collision", () => {
  it("knocks a landed probe loose and swaps normal velocities (head-on)", () => {
    // No planets: pure collision physics.
    const system = makeSystem([]);
    const target: Probe = {
      pos: { x: 100, y: 0 },
      vel: { x: 0, y: 0 },
      state: "landed",
    };
    const incoming = makeProbe(100 - PROBE_RADIUS * 2 + 1, 0, 120, 0);
    // Place overlapping already so a single step triggers the collision.
    const probes = [incoming, target];
    stepProbes(system, probes);
    expect(target.state).toBe("flying");
    expect(incoming.state).toBe("flying");
    // Equal masses, head-on: velocities along the normal swap.
    expect(target.vel.x).toBeGreaterThan(100);
    expect(incoming.vel.x).toBeLessThan(20);
  });

  it("separates overlapping probes", () => {
    const system = makeSystem([]);
    const a = makeProbe(0, 0, 0, 0);
    const b = makeProbe(PROBE_RADIUS, 0, 0, 0); // heavily overlapping
    stepProbes(system, [a, b]);
    const d = Math.abs(b.pos.x - a.pos.x);
    expect(d).toBeGreaterThanOrEqual(PROBE_RADIUS * 2 - 1e-6);
  });

  it("ignores lost probes", () => {
    const system = makeSystem([]);
    const lost: Probe = { pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, state: "lost" };
    const flyer = makeProbe(1, 0, 10, 0);
    stepProbes(system, [lost, flyer]);
    expect(lost.state).toBe("lost");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @apogee/engine test`
Expected: new tests FAIL (probe never lands / never becomes lost / collision does nothing).

- [ ] **Step 3: Extend `stepProbes`**

Replace `stepProbes` in `packages/engine/src/physics.ts` with:

```ts
/**
 * Advance all probes one fixed timestep: integrate, land, collide, void-check.
 * Mutates the probes array in place.
 */
export function stepProbes(system: StarSystem, probes: Probe[]): void {
  // 1. Integrate flying probes (semi-implicit Euler).
  for (const probe of probes) {
    if (probe.state !== "flying") continue;
    const { ax, ay } = gravityAt(system.planets, probe.pos.x, probe.pos.y);
    probe.vel.x += ax * DT;
    probe.vel.y += ay * DT;
    probe.pos.x += probe.vel.x * DT;
    probe.pos.y += probe.vel.y * DT;
  }

  // 2. Planet landings: snap to surface, zero velocity, stick.
  for (const probe of probes) {
    if (probe.state !== "flying") continue;
    for (const planet of system.planets) {
      const dx = probe.pos.x - planet.pos.x;
      const dy = probe.pos.y - planet.pos.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= planet.radius + PROBE_RADIUS) {
        const r = planet.radius + PROBE_RADIUS;
        probe.pos.x = planet.pos.x + (dx / d) * r;
        probe.pos.y = planet.pos.y + (dy / d) * r;
        probe.vel.x = 0;
        probe.vel.y = 0;
        probe.state = "landed";
        break;
      }
    }
  }

  // 3. Probe-probe collisions: equal-mass elastic, knocked probes fly again.
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
      // Separate the overlap evenly.
      const half = (minD - d) / 2;
      a.pos.x -= nx * half;
      a.pos.y -= ny * half;
      b.pos.x += nx * half;
      b.pos.y += ny * half;
      // Equal-mass elastic collision: swap velocity components along the normal.
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

  // 4. Void check.
  for (const probe of probes) {
    if (probe.state !== "flying") continue;
    const { width, height } = system.bounds;
    if (
      probe.pos.x < -VOID_MARGIN ||
      probe.pos.x > width + VOID_MARGIN ||
      probe.pos.y < -VOID_MARGIN ||
      probe.pos.y > height + VOID_MARGIN
    ) {
      probe.state = "lost";
    }
  }
}
```

Update the imports at the top of `physics.ts`:
```ts
import { DT, GRAVITY, PROBE_RADIUS, VOID_MARGIN } from "./constants";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @apogee/engine test`
Expected: all tests PASS (including Task 4's).

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src/physics.ts packages/engine/tests/physics.test.ts
git commit -m "feat(engine): landing, void detection, and elastic probe collisions"
```

---

### Task 6: simulateLaunch with trace

**Files:**
- Create: `packages/engine/src/game.ts`
- Test: `packages/engine/tests/game.test.ts`

- [ ] **Step 1: Write the failing tests**

`packages/engine/tests/game.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { MAX_SPEED, PREVIEW_STEPS } from "../src/constants";
import { simulateLaunch } from "../src/game";
import type { GameState, Planet, StarSystem } from "../src/types";

function makePlanet(x: number, y: number, radius = 60): Planet {
  return { pos: { x, y }, radius, mass: radius * radius };
}

function makeState(planets: Planet[]): GameState {
  const system: StarSystem = {
    planets,
    zones: [],
    launchPos: { x: 80, y: 500 },
    bounds: { width: 1600, height: 1000 },
  };
  return { system, probes: [], launchesUsed: 0 };
}

describe("simulateLaunch", () => {
  it("adds a probe, increments launchesUsed, and resolves to a non-flying state", () => {
    const state = makeState([makePlanet(800, 500)]);
    const result = simulateLaunch(state, { dx: 200, dy: 0 });
    expect(result.state.launchesUsed).toBe(1);
    expect(result.state.probes).toHaveLength(1);
    expect(result.state.probes[0]!.state).not.toBe("flying");
    expect(result.trace.length).toBeGreaterThan(0);
  });

  it("does not mutate the input state", () => {
    const state = makeState([makePlanet(800, 500)]);
    const before = JSON.stringify(state);
    simulateLaunch(state, { dx: 200, dy: 0 });
    expect(JSON.stringify(state)).toBe(before);
  });

  it("clamps launch speed to MAX_SPEED", () => {
    const state = makeState([makePlanet(800, 2000, 40)]); // weak, far pull
    const result = simulateLaunch(state, { dx: 100000, dy: 0 }, 1);
    const frame = result.trace[0]![0]!;
    // After one step at clamped speed, x advanced by at most MAX_SPEED*DT (+ tiny gravity).
    expect(frame.x - 80).toBeLessThanOrEqual(MAX_SPEED / 60 + 1);
  });

  it("respects maxSteps for previews", () => {
    const state = makeState([makePlanet(800, 2000, 40)]);
    const result = simulateLaunch(state, { dx: 50, dy: -50 }, PREVIEW_STEPS);
    expect(result.trace.length).toBeLessThanOrEqual(PREVIEW_STEPS);
  });

  it("is deterministic: identical inputs produce identical results", () => {
    const a = simulateLaunch(makeState([makePlanet(800, 500)]), { dx: 173.5, dy: -42.25 });
    const b = simulateLaunch(makeState([makePlanet(800, 500)]), { dx: 173.5, dy: -42.25 });
    expect(a).toEqual(b);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @apogee/engine test`
Expected: FAIL — cannot resolve `../src/game`.

- [ ] **Step 3: Implement**

`packages/engine/src/game.ts`:
```ts
import { MAX_SPEED, MAX_STEPS, POWER_SCALE } from "./constants";
import { stepProbes } from "./physics";
import type { GameState, LaunchInput, Probe, ProbeFrame } from "./types";

function cloneProbe(p: Probe): Probe {
  return { pos: { ...p.pos }, vel: { ...p.vel }, state: p.state };
}

/**
 * Run one launch to completion (or maxSteps). Pure: returns a new state.
 * The trace holds every probe's frame at every step, for animation/preview.
 */
export function simulateLaunch(
  state: GameState,
  input: LaunchInput,
  maxSteps: number = MAX_STEPS,
): { state: GameState; trace: ProbeFrame[][] } {
  const len = Math.sqrt(input.dx * input.dx + input.dy * input.dy);
  const speed = Math.min(len * POWER_SCALE, MAX_SPEED);
  const probes = state.probes.map(cloneProbe);
  probes.push({
    pos: { ...state.system.launchPos },
    vel: len === 0 ? { x: 0, y: 0 } : { x: (input.dx / len) * speed, y: (input.dy / len) * speed },
    state: "flying",
  });

  const trace: ProbeFrame[][] = [];
  for (let step = 0; step < maxSteps; step++) {
    stepProbes(state.system, probes);
    trace.push(probes.map((p) => ({ x: p.pos.x, y: p.pos.y, state: p.state })));
    if (probes.every((p) => p.state !== "flying")) break;
  }
  // Anything still flying after the cap is lost to deep space (spec: endless
  // flight guard). Previews pass a small maxSteps and discard the state.
  for (const p of probes) {
    if (p.state === "flying") p.state = "lost";
  }

  return {
    state: { system: state.system, probes, launchesUsed: state.launchesUsed + 1 },
    trace,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @apogee/engine test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src/game.ts packages/engine/tests/game.test.ts
git commit -m "feat(engine): simulateLaunch with full-flight trace and speed clamp"
```

---

### Task 7: System generation

**Files:**
- Create: `packages/engine/src/generation.ts`
- Test: `packages/engine/tests/generation.test.ts`

- [ ] **Step 1: Write the failing tests**

`packages/engine/tests/generation.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { PROBE_RADIUS, WORLD_HEIGHT, WORLD_WIDTH } from "../src/constants";
import { generateSystem } from "../src/generation";

describe("generateSystem", () => {
  it("is deterministic for the same seed", () => {
    expect(generateSystem(42)).toEqual(generateSystem(42));
  });

  it("differs across seeds", () => {
    expect(generateSystem(1)).not.toEqual(generateSystem(2));
  });

  it("produces valid systems for 500 consecutive seeds", () => {
    for (let seed = 0; seed < 500; seed++) {
      const sys = generateSystem(seed);
      expect(sys.planets.length).toBeGreaterThanOrEqual(2);
      expect(sys.planets.length).toBeLessThanOrEqual(3);
      expect(sys.zones.length).toBe(3);
      // Planets inside the world with breathing room.
      for (const p of sys.planets) {
        expect(p.pos.x - p.radius).toBeGreaterThan(0);
        expect(p.pos.x + p.radius).toBeLessThan(WORLD_WIDTH);
        expect(p.pos.y - p.radius).toBeGreaterThan(0);
        expect(p.pos.y + p.radius).toBeLessThan(WORLD_HEIGHT);
        expect(p.mass).toBeCloseTo(p.radius * p.radius, 6);
      }
      // No overlapping planets (with corridor gap).
      for (let i = 0; i < sys.planets.length; i++) {
        for (let j = i + 1; j < sys.planets.length; j++) {
          const a = sys.planets[i]!;
          const b = sys.planets[j]!;
          const dx = a.pos.x - b.pos.x;
          const dy = a.pos.y - b.pos.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          expect(d).toBeGreaterThanOrEqual(a.radius + b.radius + 180);
        }
      }
      // Launch position clear of planets.
      for (const p of sys.planets) {
        const dx = sys.launchPos.x - p.pos.x;
        const dy = sys.launchPos.y - p.pos.y;
        expect(Math.sqrt(dx * dx + dy * dy)).toBeGreaterThanOrEqual(p.radius + 150);
      }
      // Zones sit exactly on their planet's surface.
      for (const z of sys.zones) {
        const planet = sys.planets[z.planetIndex]!;
        const dx = z.center.x - planet.pos.x;
        const dy = z.center.y - planet.pos.y;
        expect(Math.sqrt(dx * dx + dy * dy)).toBeCloseTo(planet.radius, 4);
      }
      expect(PROBE_RADIUS).toBeLessThan(14); // probes can reach the 5-ring (sanity)
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @apogee/engine test`
Expected: FAIL — cannot resolve `../src/generation`.

- [ ] **Step 3: Implement**

`packages/engine/src/generation.ts`:
```ts
import { WORLD_HEIGHT, WORLD_WIDTH } from "./constants";
import { mulberry32 } from "./rng";
import type { Planet, StarSystem, Vec2, Zone } from "./types";

const LAUNCH_POS: Vec2 = { x: 80, y: 500 };
const ZONE_COUNT = 3;
const PLANET_GAP = 180;
const LAUNCH_CLEARANCE = 150;

/** Random unit vector WITHOUT trig (determinism): rejection-sample the disc. */
function randUnitVec(rng: () => number): Vec2 {
  for (;;) {
    const x = rng() * 2 - 1;
    const y = rng() * 2 - 1;
    const d2 = x * x + y * y;
    if (d2 >= 0.01 && d2 <= 1) {
      const d = Math.sqrt(d2);
      return { x: x / d, y: y / d };
    }
  }
}

function isValidLayout(planets: Planet[]): boolean {
  for (let i = 0; i < planets.length; i++) {
    const a = planets[i]!;
    if (
      a.pos.x - a.radius <= 0 ||
      a.pos.x + a.radius >= WORLD_WIDTH ||
      a.pos.y - a.radius <= 0 ||
      a.pos.y + a.radius >= WORLD_HEIGHT
    ) {
      return false;
    }
    const lx = LAUNCH_POS.x - a.pos.x;
    const ly = LAUNCH_POS.y - a.pos.y;
    if (Math.sqrt(lx * lx + ly * ly) < a.radius + LAUNCH_CLEARANCE) return false;
    for (let j = i + 1; j < planets.length; j++) {
      const b = planets[j]!;
      const dx = a.pos.x - b.pos.x;
      const dy = a.pos.y - b.pos.y;
      if (Math.sqrt(dx * dx + dy * dy) < a.radius + b.radius + PLANET_GAP) return false;
    }
  }
  return true;
}

/** Deterministic daily system. Re-rolls from derived seeds until valid. */
export function generateSystem(seed: number): StarSystem {
  for (let attempt = 0; ; attempt++) {
    const rng = mulberry32((seed + attempt * 0x9e3779b9) >>> 0);
    const planetCount = 2 + Math.floor(rng() * 2); // 2 or 3
    const planets: Planet[] = [];
    for (let i = 0; i < planetCount; i++) {
      const radius = 40 + rng() * 50;
      planets.push({
        pos: {
          x: 300 + rng() * (WORLD_WIDTH - 500),
          y: 150 + rng() * (WORLD_HEIGHT - 300),
        },
        radius,
        mass: radius * radius,
      });
    }
    if (!isValidLayout(planets)) continue;

    const zones: Zone[] = [];
    for (let i = 0; i < ZONE_COUNT; i++) {
      const planetIndex = Math.floor(rng() * planets.length);
      const planet = planets[planetIndex]!;
      const dir = randUnitVec(rng);
      zones.push({
        planetIndex,
        center: {
          x: planet.pos.x + dir.x * planet.radius,
          y: planet.pos.y + dir.y * planet.radius,
        },
      });
    }

    return {
      planets,
      zones,
      launchPos: { ...LAUNCH_POS },
      bounds: { width: WORLD_WIDTH, height: WORLD_HEIGHT },
    };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @apogee/engine test`
Expected: all PASS (500-seed loop takes well under a second).

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src/generation.ts packages/engine/tests/generation.test.ts
git commit -m "feat(engine): seeded star-system generation with validity re-rolls"
```

---

### Task 8: Scoring

**Files:**
- Create: `packages/engine/src/scoring.ts`
- Test: `packages/engine/tests/scoring.test.ts`

- [ ] **Step 1: Write the failing tests**

`packages/engine/tests/scoring.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { RINGS, scoreGame, scoreProbe } from "../src/scoring";
import type { GameState, Probe, StarSystem } from "../src/types";

const system: StarSystem = {
  planets: [{ pos: { x: 500, y: 500 }, radius: 60, mass: 3600 }],
  zones: [{ planetIndex: 0, center: { x: 560, y: 500 } }], // east surface point
  launchPos: { x: 80, y: 500 },
  bounds: { width: 1600, height: 1000 },
};

function landedAt(x: number, y: number): Probe {
  return { pos: { x, y }, vel: { x: 0, y: 0 }, state: "landed" };
}

describe("scoreProbe", () => {
  it("scores 5 inside the bullseye ring", () => {
    expect(scoreProbe(landedAt(565, 505), system)).toBe(5); // d ≈ 7.07
  });

  it("scores 3 in the middle ring", () => {
    expect(scoreProbe(landedAt(560, 520), system)).toBe(3); // d = 20
  });

  it("scores 1 in the outer ring", () => {
    expect(scoreProbe(landedAt(560, 540), system)).toBe(1); // d = 40
  });

  it("scores 0 outside all rings", () => {
    expect(scoreProbe(landedAt(560, 600), system)).toBe(0); // d = 100
  });

  it("scores 0 for lost probes regardless of position", () => {
    const lost: Probe = { pos: { x: 560, y: 500 }, vel: { x: 0, y: 0 }, state: "lost" };
    expect(scoreProbe(lost, system)).toBe(0);
  });

  it("ring thresholds are ordered tightest-first", () => {
    expect(RINGS[0]!.maxDist).toBeLessThan(RINGS[1]!.maxDist);
    expect(RINGS[1]!.maxDist).toBeLessThan(RINGS[2]!.maxDist);
  });
});

describe("scoreGame", () => {
  it("totals per-probe scores in launch order", () => {
    const state: GameState = {
      system,
      probes: [landedAt(565, 505), landedAt(560, 540)],
      launchesUsed: 2,
    };
    expect(scoreGame(state)).toEqual({ total: 6, perProbe: [5, 1] });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @apogee/engine test`
Expected: FAIL — cannot resolve `../src/scoring`.

- [ ] **Step 3: Implement**

`packages/engine/src/scoring.ts`:
```ts
import type { GameState, Probe, StarSystem } from "./types";

/** Bullseye rings: distance from zone center → points. Tightest first. */
export const RINGS = [
  { maxDist: 14, points: 5 },
  { maxDist: 30, points: 3 },
  { maxDist: 55, points: 1 },
] as const;

export function scoreProbe(probe: Probe, system: StarSystem): number {
  if (probe.state !== "landed") return 0;
  let best = 0;
  for (const zone of system.zones) {
    const dx = probe.pos.x - zone.center.x;
    const dy = probe.pos.y - zone.center.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    for (const ring of RINGS) {
      if (d <= ring.maxDist) {
        if (ring.points > best) best = ring.points;
        break;
      }
    }
  }
  return best;
}

export function scoreGame(state: GameState): { total: number; perProbe: number[] } {
  const perProbe = state.probes.map((p) => scoreProbe(p, state.system));
  return { total: perProbe.reduce((sum, n) => sum + n, 0), perProbe };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @apogee/engine test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src/scoring.ts packages/engine/tests/scoring.test.ts
git commit -m "feat(engine): bullseye ring scoring"
```

---

### Task 9: Game API, public exports, and golden replay

**Files:**
- Modify: `packages/engine/src/game.ts` (add `createGame`, `createDailyGame`, `isGameOver`)
- Modify: `packages/engine/src/index.ts` (public API)
- Test: `packages/engine/tests/game.test.ts` (append), `packages/engine/tests/golden.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `packages/engine/tests/game.test.ts`:
```ts
import { createDailyGame, createGame, isGameOver } from "../src/game";
import { LAUNCHES_PER_DAY } from "../src/constants";

describe("createGame / createDailyGame", () => {
  it("creates a fresh game from a seed", () => {
    const game = createGame(7);
    expect(game.probes).toEqual([]);
    expect(game.launchesUsed).toBe(0);
    expect(game.system.planets.length).toBeGreaterThanOrEqual(2);
  });

  it("same date string always produces the same system", () => {
    expect(createDailyGame("2026-06-11")).toEqual(createDailyGame("2026-06-11"));
  });

  it("different dates produce different systems", () => {
    expect(createDailyGame("2026-06-11").system).not.toEqual(
      createDailyGame("2026-06-12").system,
    );
  });
});

describe("isGameOver", () => {
  it("is false before and true after LAUNCHES_PER_DAY launches", () => {
    const game = createGame(7);
    expect(isGameOver(game)).toBe(false);
    expect(isGameOver({ ...game, launchesUsed: LAUNCHES_PER_DAY })).toBe(true);
  });
});
```

Create `packages/engine/tests/golden.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { createDailyGame, simulateLaunch } from "../src/game";
import { scoreGame } from "../src/scoring";

/**
 * Golden replay: a fixed day + fixed inputs locked in as a snapshot.
 * Any physics/generation/scoring change that alters outcomes fails this test —
 * which is exactly what we want: such changes must be deliberate
 * (delete the snapshot and re-commit it alongside the change).
 */
const INPUTS = [
  { dx: 180, dy: -40 },
  { dx: 120, dy: 60 },
  { dx: 200, dy: 0 },
  { dx: 90, dy: -110 },
  { dx: 160, dy: 25 },
];

describe("golden replay", () => {
  it("full playthrough of 2026-06-11 matches the locked snapshot", () => {
    let game = createDailyGame("2026-06-11");
    for (const input of INPUTS) {
      game = simulateLaunch(game, input).state;
    }
    expect(game.launchesUsed).toBe(5);
    for (const p of game.probes) expect(p.state).not.toBe("flying");
    expect({ probes: game.probes, score: scoreGame(game) }).toMatchSnapshot();
  });

  it("replaying twice gives byte-identical results (determinism)", () => {
    const run = () => {
      let game = createDailyGame("2026-06-11");
      for (const input of INPUTS) game = simulateLaunch(game, input).state;
      return game;
    };
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @apogee/engine test`
Expected: FAIL — `createGame`, `createDailyGame`, `isGameOver` not exported from `../src/game`.

- [ ] **Step 3: Implement**

Add to `packages/engine/src/game.ts` (below `simulateLaunch`):
```ts
import { LAUNCHES_PER_DAY } from "./constants";
import { generateSystem } from "./generation";
import { hashString } from "./rng";

export function createGame(seed: number): GameState {
  return { system: generateSystem(seed), probes: [], launchesUsed: 0 };
}

export function createDailyGame(dateString: string): GameState {
  return createGame(hashString(dateString));
}

export function isGameOver(state: GameState): boolean {
  return state.launchesUsed >= LAUNCHES_PER_DAY;
}
```
(Merge the new imports into the existing import statements at the top of the file.)

Replace `packages/engine/src/index.ts`:
```ts
export * from "./constants";
export * from "./types";
export { mulberry32, hashString } from "./rng";
export { gravityAt, stepProbes } from "./physics";
export { generateSystem } from "./generation";
export { RINGS, scoreProbe, scoreGame } from "./scoring";
export { simulateLaunch, createGame, createDailyGame, isGameOver } from "./game";
```

Delete `packages/engine/tests/smoke.test.ts` and remove `ENGINE_VERSION` (superseded by real tests).

- [ ] **Step 4: Run tests — first run writes the snapshot, second run verifies**

Run: `pnpm --filter @apogee/engine test`
Expected: PASS (snapshot file created under `packages/engine/tests/__snapshots__/`).
Run again: `pnpm --filter @apogee/engine test`
Expected: PASS (snapshot now enforced).
Run: `pnpm --filter @apogee/engine typecheck`
Expected: exits 0.

- [ ] **Step 5: Commit (include the snapshot file — it IS the golden record)**

```bash
git add -A packages/engine
git commit -m "feat(engine): game API, public exports, golden replay snapshot"
```

---

### Task 10: Web scaffold + static system rendering

**Files:**
- Create: `packages/web/package.json`, `packages/web/tsconfig.json`, `packages/web/vite.config.ts`, `packages/web/index.html`
- Create: `packages/web/src/main.tsx`, `packages/web/src/App.tsx`, `packages/web/src/GameCanvas.tsx`, `packages/web/src/render.ts`, `packages/web/src/daily.ts`, `packages/web/src/styles.css`

Verification for web tasks is manual (canvas UI); engine purity means physics correctness is already covered by tests. Pure web helpers (`storage.ts` in Task 13) still get unit tests.

- [ ] **Step 1: Create package config**

`packages/web/package.json`:
```json
{
  "name": "@apogee/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@apogee/engine": "workspace:*",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^5.0.0",
    "typescript": "^5.6.0",
    "vite": "^7.0.0",
    "vitest": "^3.0.0"
  }
}
```

`packages/web/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "skipLibCheck": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": ["src"]
}
```

`packages/web/vite.config.ts`:
```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
});
```

`packages/web/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Apogee</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Create app shell and daily helper**

`packages/web/src/daily.ts`:
```ts
/** UTC date string — everyone worldwide plays the same board (per spec). */
export function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}
```

`packages/web/src/main.tsx`:
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`packages/web/src/styles.css`:
```css
* { box-sizing: border-box; margin: 0; }
body { background: #0b0e1a; color: #e8eaf6; font-family: system-ui, sans-serif; }
#root { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 16px; }
canvas { width: 100%; max-width: 1100px; border-radius: 8px; touch-action: none; cursor: crosshair; }
.hud { display: flex; gap: 24px; align-items: baseline; max-width: 1100px; width: 100%; }
.hud h1 { font-size: 1.3rem; letter-spacing: 0.2em; }
.hud .stat { font-variant-numeric: tabular-nums; opacity: 0.9; }
.overlay { text-align: center; padding: 12px; }
.overlay .total { font-size: 2.2rem; font-weight: 700; }
.pips { letter-spacing: 0.3em; }
```

`packages/web/src/App.tsx` (Phase: static render — interaction comes in Tasks 11–13):
```tsx
import { createDailyGame } from "@apogee/engine";
import { useState } from "react";
import { todayString } from "./daily";
import { GameCanvas } from "./GameCanvas";

export function App() {
  const [day] = useState(todayString);
  const [game] = useState(() => createDailyGame(day));

  return (
    <>
      <div className="hud">
        <h1>APOGEE</h1>
        <span className="stat">{day}</span>
      </div>
      <GameCanvas game={game} />
    </>
  );
}
```

- [ ] **Step 3: Create the renderer**

`packages/web/src/render.ts`:
```ts
import {
  PROBE_RADIUS,
  RINGS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  mulberry32,
  type GameState,
  type ProbeFrame,
} from "@apogee/engine";

/** Fixed decorative starfield (render-only; never touches the sim). */
const STARS: { x: number; y: number; r: number }[] = (() => {
  const rng = mulberry32(0xa11ce);
  return Array.from({ length: 140 }, () => ({
    x: rng() * WORLD_WIDTH,
    y: rng() * WORLD_HEIGHT,
    r: 0.5 + rng() * 1.2,
  }));
})();

const RING_COLORS = ["#ffd54f", "#4fc3f7", "#7986cb"]; // 5 / 3 / 1 points

export interface RenderView {
  game: GameState;
  /** Live positions during animation; falls back to game.probes when null. */
  probeFrames: ProbeFrame[] | null;
  /** New-probe preview path while aiming. */
  previewPath: { x: number; y: number }[] | null;
  /** Current drag vector while aiming (drawn at the launch pad). */
  drag: { dx: number; dy: number } | null;
}

export function drawFrame(ctx: CanvasRenderingContext2D, view: RenderView): void {
  const { game } = view;
  ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  // Space + stars
  ctx.fillStyle = "#0b0e1a";
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  ctx.fillStyle = "#9fa8da";
  for (const s of STARS) {
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Zone rings (under planets' rims, over space)
  for (const zone of game.system.zones) {
    for (let i = RINGS.length - 1; i >= 0; i--) {
      ctx.strokeStyle = RING_COLORS[i] ?? "#fff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(zone.center.x, zone.center.y, RINGS[i]!.maxDist, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // Planets
  for (const p of game.system.planets) {
    ctx.fillStyle = "#26334d";
    ctx.beginPath();
    ctx.arc(p.pos.x, p.pos.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#52628a";
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // Launch pad
  const lp = game.system.launchPos;
  ctx.strokeStyle = "#80cbc4";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(lp.x, lp.y, 14, 0, Math.PI * 2);
  ctx.stroke();

  // Aiming: preview path + drag indicator
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

  // Probes (animated frames take precedence over settled state)
  const frames: ProbeFrame[] =
    view.probeFrames ??
    game.probes.map((p) => ({ x: p.pos.x, y: p.pos.y, state: p.state }));
  for (const f of frames) {
    if (f.state === "lost") continue;
    ctx.fillStyle = f.state === "landed" ? "#a5d6a7" : "#ffffff";
    ctx.beginPath();
    ctx.arc(f.x, f.y, PROBE_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }
}
```

(`Math.PI`/`arc` here are fine — rendering is allowed to use anything; the determinism rules apply only to the engine package.)

- [ ] **Step 4: Create the canvas component (static for now)**

`packages/web/src/GameCanvas.tsx`:
```tsx
import { WORLD_HEIGHT, WORLD_WIDTH, type GameState } from "@apogee/engine";
import { useEffect, useRef } from "react";
import { drawFrame } from "./render";

interface Props {
  game: GameState;
}

export function GameCanvas({ game }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    drawFrame(ctx, { game, probeFrames: null, previewPath: null, drag: null });
  }, [game]);

  return <canvas ref={canvasRef} width={WORLD_WIDTH} height={WORLD_HEIGHT} />;
}
```

- [ ] **Step 5: Install and verify manually**

Run: `pnpm install` (root — links the new web package)
Run: `pnpm dev`
Open the printed localhost URL. Expected: dark starfield, 2–3 ringed planets with colored bullseye rings on their surfaces, teal launch circle on the left. Refresh — identical layout (deterministic daily seed).
Run: `pnpm --filter @apogee/web typecheck`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(web): vite/react scaffold and static daily-system canvas render"
```

---

### Task 11: Aiming with live partial preview

**Files:**
- Modify: `packages/web/src/GameCanvas.tsx` (full replacement below)
- Modify: `packages/web/src/App.tsx` (full replacement below)

Slingshot aiming: press anywhere on the canvas and pull — the launch vector is **launchPos − pointer** (pull back, fire opposite, Angry Birds style). While dragging, the engine simulates `PREVIEW_STEPS` and the renderer draws the new probe's dashed path.

- [ ] **Step 1: Replace GameCanvas with the interactive version**

`packages/web/src/GameCanvas.tsx`:
```tsx
import {
  PREVIEW_STEPS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  simulateLaunch,
  type GameState,
  type LaunchInput,
} from "@apogee/engine";
import { useEffect, useRef } from "react";
import { drawFrame } from "./render";

interface Props {
  game: GameState;
  /** When true (game over / animating), input is ignored. */
  disabled: boolean;
  onLaunch: (input: LaunchInput) => void;
}

/** Convert a pointer event to world coordinates (canvas is CSS-scaled). */
function toWorld(canvas: HTMLCanvasElement, e: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) * WORLD_WIDTH) / rect.width,
    y: ((e.clientY - rect.top) * WORLD_HEIGHT) / rect.height,
  };
}

export function GameCanvas({ game, disabled, onLaunch }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const redraw = () => {
      const drag = dragRef.current;
      let previewPath: { x: number; y: number }[] | null = null;
      if (drag && (drag.dx !== 0 || drag.dy !== 0)) {
        const { trace } = simulateLaunch(game, drag, PREVIEW_STEPS);
        const newProbeIndex = game.probes.length;
        previewPath = trace
          .map((frame) => frame[newProbeIndex])
          .filter((f) => f !== undefined && f.state === "flying")
          .map((f) => ({ x: f!.x, y: f!.y }));
      }
      drawFrame(ctx, { game, probeFrames: null, previewPath, drag });
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
      // Slingshot: pull back from the pad, launch the opposite way.
      dragRef.current = {
        dx: game.system.launchPos.x - w.x,
        dy: game.system.launchPos.y - w.y,
      };
      redraw();
    };
    const onUp = () => {
      const drag = dragRef.current;
      dragRef.current = null;
      redraw();
      if (drag && (drag.dx !== 0 || drag.dy !== 0)) onLaunch(drag);
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    redraw();
    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
    };
  }, [game, disabled, onLaunch]);

  return <canvas ref={canvasRef} width={WORLD_WIDTH} height={WORLD_HEIGHT} />;
}
```

- [ ] **Step 2: Wire App to receive launches (logged only, for now)**

`packages/web/src/App.tsx`:
```tsx
import { createDailyGame, type LaunchInput } from "@apogee/engine";
import { useCallback, useState } from "react";
import { todayString } from "./daily";
import { GameCanvas } from "./GameCanvas";

export function App() {
  const [day] = useState(todayString);
  const [game] = useState(() => createDailyGame(day));

  const handleLaunch = useCallback((input: LaunchInput) => {
    console.log("launch", input); // Task 12 replaces this with real progression
  }, []);

  return (
    <>
      <div className="hud">
        <h1>APOGEE</h1>
        <span className="stat">{day}</span>
      </div>
      <GameCanvas game={game} disabled={false} onLaunch={handleLaunch} />
    </>
  );
}
```

- [ ] **Step 3: Verify manually**

Run: `pnpm dev`
Expected: press-and-drag anywhere shows a teal pull line from the launch pad and a dashed yellow preview arc that **bends near planets**; longer pulls reach further (capped); release logs `launch {dx, dy}` to the console.
Run: `pnpm --filter @apogee/web typecheck`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add packages/web/src
git commit -m "feat(web): slingshot aiming with live partial trajectory preview"
```

---

### Task 12: Flight animation and game progression

**Files:**
- Modify: `packages/web/src/App.tsx` (full replacement below)
- Modify: `packages/web/src/GameCanvas.tsx` (add animation playback — full replacement below)

Flow: release → `simulateLaunch` returns `{state, trace}` → App stores `{trace, next}` as the pending animation → GameCanvas plays the trace at one sim step per display frame → on completion App commits the new state.

- [ ] **Step 1: Replace App with real progression**

`packages/web/src/App.tsx`:
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
import { GameCanvas } from "./GameCanvas";

interface PendingAnim {
  trace: ProbeFrame[][];
  next: GameState;
}

export function App() {
  const [day] = useState(todayString);
  const [game, setGame] = useState(() => createDailyGame(day));
  const [anim, setAnim] = useState<PendingAnim | null>(null);

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
  }, [anim]);

  const score = scoreGame(game);
  const over = isGameOver(game);

  return (
    <>
      <div className="hud">
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
    </>
  );
}
```

- [ ] **Step 2: Replace GameCanvas with animation playback**

`packages/web/src/GameCanvas.tsx`:
```tsx
import {
  PREVIEW_STEPS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  simulateLaunch,
  type GameState,
  type LaunchInput,
  type ProbeFrame,
} from "@apogee/engine";
import { useEffect, useRef } from "react";
import { drawFrame } from "./render";

interface Props {
  game: GameState;
  disabled: boolean;
  /** Trace to play back, or null when idle. */
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

export function GameCanvas({ game, disabled, anim, onLaunch, onAnimDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  // Animation playback: one sim step per display frame (60Hz ≈ real time).
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
      drawFrame(ctx, { game, probeFrames, previewPath: null, drag: null });
      frame++;
      if (frame < anim.length) {
        raf = requestAnimationFrame(tick);
      } else {
        onAnimDone();
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [anim, game, onAnimDone]);

  // Idle rendering + aiming input.
  useEffect(() => {
    if (anim) return; // animation effect owns the canvas right now
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const redraw = () => {
      const drag = dragRef.current;
      let previewPath: { x: number; y: number }[] | null = null;
      if (drag && (drag.dx !== 0 || drag.dy !== 0)) {
        const { trace } = simulateLaunch(game, drag, PREVIEW_STEPS);
        const newProbeIndex = game.probes.length;
        previewPath = trace
          .map((f) => f[newProbeIndex])
          .filter((f): f is ProbeFrame => f !== undefined && f.state === "flying")
          .map((f) => ({ x: f.x, y: f.y }));
      }
      drawFrame(ctx, { game, probeFrames: null, previewPath, drag });
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
        dx: game.system.launchPos.x - w.x,
        dy: game.system.launchPos.y - w.y,
      };
      redraw();
    };
    const onUp = () => {
      const drag = dragRef.current;
      dragRef.current = null;
      redraw();
      if (drag && (drag.dx !== 0 || drag.dy !== 0)) onLaunch(drag);
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    redraw();
    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
    };
  }, [game, disabled, anim, onLaunch]);

  return <canvas ref={canvasRef} width={WORLD_WIDTH} height={WORLD_HEIGHT} />;
}
```

- [ ] **Step 3: Verify manually**

Run: `pnpm dev`
Expected:
- Release a shot → probe flies along a curved path in real time, lands on a planet (turns green) or drifts off and disappears.
- HUD pips decrease; score updates after landing in a ring.
- A second shot can collide with the first landed probe and knock it loose.
- After 5 launches, input is ignored.
- Aiming is blocked during flight animation.

Run: `pnpm --filter @apogee/web typecheck`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add packages/web/src
git commit -m "feat(web): flight animation and five-launch game progression"
```

---

### Task 13: End screen and local best score

**Files:**
- Create: `packages/web/src/storage.ts`
- Test: `packages/web/tests/storage.test.ts`
- Modify: `packages/web/src/App.tsx` (add end overlay — diff shown below)

- [ ] **Step 1: Write the failing tests**

`packages/web/tests/storage.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { loadBest, recordScore } from "../src/storage";

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

describe("best-score storage", () => {
  it("returns null when nothing is stored", () => {
    expect(loadBest(fakeStorage(), "2026-06-11")).toBeNull();
  });

  it("records and reloads a score", () => {
    const s = fakeStorage();
    expect(recordScore(s, "2026-06-11", 12)).toBe(12);
    expect(loadBest(s, "2026-06-11")).toBe(12);
  });

  it("keeps the higher score", () => {
    const s = fakeStorage();
    recordScore(s, "2026-06-11", 12);
    expect(recordScore(s, "2026-06-11", 8)).toBe(12);
    expect(recordScore(s, "2026-06-11", 15)).toBe(15);
  });

  it("is per-day", () => {
    const s = fakeStorage();
    recordScore(s, "2026-06-11", 12);
    expect(loadBest(s, "2026-06-12")).toBeNull();
  });

  it("treats corrupted values as absent", () => {
    const s = fakeStorage();
    s.setItem("apogee-best-2026-06-11", "garbage");
    expect(loadBest(s, "2026-06-11")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @apogee/web test`
Expected: FAIL — cannot resolve `../src/storage`.

- [ ] **Step 3: Implement storage**

`packages/web/src/storage.ts`:
```ts
function key(day: string): string {
  return `apogee-best-${day}`;
}

export function loadBest(storage: Pick<Storage, "getItem">, day: string): number | null {
  const raw = storage.getItem(key(day));
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Records the score if it beats the stored best; returns the resulting best. */
export function recordScore(storage: Storage, day: string, score: number): number {
  const prev = loadBest(storage, day);
  const best = prev === null ? score : Math.max(prev, score);
  storage.setItem(key(day), String(best));
  return best;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @apogee/web test`
Expected: all storage tests PASS.

- [ ] **Step 5: Add the end overlay to App**

In `packages/web/src/App.tsx`, add the import:
```tsx
import { recordScore } from "./storage";
```

Replace `handleAnimDone` with a version that records the final score:
```tsx
  const handleAnimDone = useCallback(() => {
    if (!anim) return;
    setGame(anim.next);
    setAnim(null);
    if (isGameOver(anim.next)) {
      setBest(recordScore(localStorage, day, scoreGame(anim.next).total));
    }
  }, [anim, day]);
```

Add the `best` state next to the other `useState` calls:
```tsx
  const [best, setBest] = useState<number | null>(() => loadBest(localStorage, day));
```
(and extend the storage import: `import { loadBest, recordScore } from "./storage";`)

Add the overlay just before the closing fragment tag, after `<GameCanvas ... />`:
```tsx
      {over && anim === null && (
        <div className="overlay">
          <div className="total">{score.total} pts</div>
          <div className="pips">{score.perProbe.join(" · ")}</div>
          {best !== null && <div className="stat">best today: {best}</div>}
          <div className="stat">come back tomorrow for a new system</div>
        </div>
      )}
```

- [ ] **Step 6: Verify manually**

Run: `pnpm dev`
Expected: finish 5 launches → overlay shows total, per-launch points, today's best. Reload the page mid-game → game restarts (known Phase 1 limitation, see Task 14 notes) but best-of-day persists after a finished run.
Run: `pnpm --filter @apogee/web typecheck`
Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add packages/web/src packages/web/tests
git commit -m "feat(web): end screen with per-day best score persistence"
```

---

### Task 14: Final verification, README, tuning notes

**Files:**
- Create: `README.md`
- Modify: tuning constants only if playtest demands it

- [ ] **Step 1: Run the full suite**

Run: `pnpm test` (root)
Expected: all engine + web tests PASS.
Run: `pnpm typecheck`
Expected: exits 0.
Run: `pnpm --filter @apogee/web build`
Expected: production build succeeds.

- [ ] **Step 2: Manual playtest checklist**

Run `pnpm dev` and verify each:
- [ ] Daily system renders identically after refresh.
- [ ] Preview arc visibly bends near planets and is clearly partial (doesn't reveal the landing).
- [ ] A max-power pull is clamped (pulling further stops adding speed).
- [ ] A probe can slingshot around a planet (aim past a planet's edge at high power).
- [ ] Landing in the gold ring scores 5, blue 3, indigo 1 — HUD total matches.
- [ ] A shot can knock a landed probe loose; it re-lands or is lost.
- [ ] An off-map shot is lost and scores 0.
- [ ] After 5 launches the overlay appears; input is dead.
- [ ] Touch input works (open dev tools device emulation).

**Tuning gate:** if shots feel floaty or uncontrollable, adjust only `GRAVITY`, `POWER_SCALE`, `MAX_SPEED` in `constants.ts`, then delete `packages/engine/tests/__snapshots__/` and re-run `pnpm test` twice (regenerate + verify golden snapshot). Commit constants and snapshot together.

- [ ] **Step 3: Write README**

`README.md`:
```markdown
# Apogee

A daily space-curling game. Every day, everyone gets the same tiny star
system. Five slingshot launches, gravity does the rest — land in scoring
rings, dodge the void, beat your friends.

Spec: `docs/superpowers/specs/2026-06-11-apogee-design.md`

## Develop

- `pnpm install`
- `pnpm dev` — run the game (packages/web)
- `pnpm test` — engine + web tests
- `pnpm typecheck`

## Architecture

- `packages/engine` — pure, deterministic simulation. Zero deps. Only
  `+ - * / sqrt` in numeric code (cross-engine float determinism).
  Same seed + same inputs → identical outcome, everywhere.
- `packages/web` — React + Vite + canvas renderer. Calls the engine,
  draws the results, computes no physics itself.

## Phase 1 scope (current)

Solo, client-only. Known limitations, by design:
- No mid-game persistence: reloading restarts today's run (best score persists).
- No leaderboard/share — Phase 2 (server, replay verification).
- No head-to-head — Phase 3.
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: README with phase 1 scope and architecture notes"
```

---

## Self-review notes (done at plan-writing time)

- **Spec coverage:** daily seed from UTC date (Task 9/10 `daily.ts`), partial preview (Tasks 6/11), void + endless-flight guard (Tasks 5/6), collisions knock probes loose (Task 5), ring scoring (Task 8), deterministic generation with re-rolls (Task 7), golden replay + determinism double-run (Task 9), fixed timestep with rAF playback (Task 12), float-determinism discipline (header rules + no-trig implementations throughout). Phase 2/3 spec items (server, share grids, H2H) intentionally out of scope.
- **Deliberate scope cuts vs spec:** cross-*browser* golden tests (spec's #1 risk) can't run in Vitest alone; the golden snapshot + the only-`sqrt` discipline is the Phase 1 mitigation, and the README documents the limitation. Mid-game persistence omitted (noted in README).
- **Type consistency check:** `LaunchInput {dx,dy}`, `ProbeFrame {x,y,state}`, `simulateLaunch(state, input, maxSteps?) → {state, trace}`, `scoreGame → {total, perProbe}` used identically across Tasks 6, 8, 9, 11, 12, 13. `GameCanvas` props change across Tasks 10→11→12 by design; each task shows the full file.
```
