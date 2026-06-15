# Deep Space Visual Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Apogee an atmospheric, professional "Deep Space" look — a shared animated cosmos behind every screen, enriched planets/rings/probes on a transparent game canvas, and polished chrome — without touching the deterministic engine.

**Architecture:** A fixed full-viewport `<SpaceBackdrop>` canvas renders the shared cosmos (nebula + parallax starfield + shooting stars) behind all screens. The game canvas becomes transparent and overlays only the interactive system, driven by a single continuous `requestAnimationFrame` loop (shared between the daily and campaign boards via a `useBoardCanvas` hook). All new randomness is render-only, seeded by the engine's existing `mulberry32`. Motion is gated by `prefers-reduced-motion` and paused when the tab is hidden.

**Tech Stack:** TypeScript (strict, `noUncheckedIndexedAccess` on), React 19, Vite 7, Vitest 3 (node env), Canvas 2D. pnpm workspaces (`@apogee/engine`, `@apogee/web`).

**Spec:** `docs/superpowers/specs/2026-06-14-deep-space-polish-design.md`

---

## Before you start

1. **This plan only touches `packages/web`.** The engine stays byte-for-byte unchanged; its golden tests must stay green (that's the proof we didn't touch physics).
2. **Reconcile the working tree first.** There are pre-existing uncommitted changes (`packages/engine/tests/__snapshots__/*.snap`, `packages/web/src/styles.css`). Commit or stash them so visual work builds on a clean base. Then confirm a green baseline:
   - Run: `pnpm install` then `pnpm test` and `pnpm typecheck`
   - Expected: all tests pass, no type errors.
3. **Conventions:** match existing commit style (`feat(web):`, `test(web):`, `refactor(web):`, `style(web):`). End every commit message with the trailer:
   ```
   Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
   ```
4. **Test commands** (from repo root):
   - Single file: `pnpm --filter @apogee/web exec vitest run tests/space/<file>.test.ts`
   - Web suite: `pnpm --filter @apogee/web test`
   - Typecheck web: `pnpm --filter @apogee/web typecheck`
   - Dev server (manual visual checks): `pnpm dev` then open the printed `http://localhost:5173`
5. **Manual-verification tasks** have no automated test by design (node test env has no canvas; the repo's pattern is to unit-test pure logic and verify visuals by playing). Each such task lists exact things to observe.

---

## File structure

| File | Responsibility | Tested |
|---|---|---|
| `packages/web/src/space/motion.ts` | `prefers-reduced-motion` detection + the pure `shouldAnimate` decision | unit |
| `packages/web/src/space/trail.ts` | Bounded ring buffer for probe trails | unit |
| `packages/web/src/space/effects.ts` | `Burst` type + pure prune/progress helpers for impact bursts | unit |
| `packages/web/src/space/starfield.ts` | Seeded starfield generation + twinkle + parallax math | unit |
| `packages/web/src/space/shootingStars.ts` | Deterministic shooting-star schedule | unit |
| `packages/web/src/space/planetStyle.ts` | Deterministic planet-type assignment + per-type palettes | unit |
| `packages/web/src/space/palette.ts` | Shared canvas color constants | typecheck |
| `packages/web/src/space/cosmos.ts` | Imperative backdrop drawing (nebula cache, starfield, shooting stars) | manual |
| `packages/web/src/space/SpaceBackdrop.tsx` | Full-viewport backdrop component + shared rAF clock + reduced-motion/visibility | manual |
| `packages/web/src/space/useBoardCanvas.ts` | Shared board render loop + aiming + trails + bursts | manual |
| `packages/web/src/render.ts` | Enriched system drawing (planets, rings, probes, trails, bursts), transparent bg | manual |
| `packages/web/src/GameCanvas.tsx` | Daily board — thin wrapper over `useBoardCanvas` | manual |
| `packages/web/src/campaign/CampaignCanvas.tsx` | Campaign board — thin wrapper over `useBoardCanvas` | manual |
| `packages/web/src/App.tsx` | Mounts `<SpaceBackdrop>`; screen fade transitions | manual |
| `packages/web/src/CountUp.tsx` | Animated number for the game-over total | manual |
| `packages/web/src/styles.css` | Palette vars, glassy chrome, overlays, mission tiles, transitions | manual |
| `packages/web/src/DailyGame.tsx`, `campaign/CampaignLevel.tsx`, `campaign/CampaignMap.tsx` | Small markup/class tweaks for new chrome | manual |

---

# Phase A — Pure foundation (no visual change)

These are pure modules with full TDD. After Phase A the app looks identical but has tested building blocks.

## Task 1: Motion decision helper

**Files:**
- Create: `packages/web/src/space/motion.ts`
- Test: `packages/web/tests/space/motion.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/web/tests/space/motion.test.ts
import { describe, expect, it } from "vitest";
import { shouldAnimate } from "../../src/space/motion";

describe("shouldAnimate", () => {
  it("animates only when motion is allowed and tab is visible", () => {
    expect(shouldAnimate(false, false)).toBe(true);
  });
  it("does not animate when reduced motion is requested", () => {
    expect(shouldAnimate(true, false)).toBe(false);
  });
  it("does not animate when the tab is hidden", () => {
    expect(shouldAnimate(false, true)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @apogee/web exec vitest run tests/space/motion.test.ts`
Expected: FAIL — cannot find module `../../src/space/motion`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/web/src/space/motion.ts

/** True when ambient motion should run (motion allowed AND tab visible). */
export function shouldAnimate(reduceMotion: boolean, hidden: boolean): boolean {
  return !reduceMotion && !hidden;
}

/** Reads the OS "reduce motion" preference. Safe in non-DOM (returns false). */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Subscribe to changes in the reduce-motion preference. Returns an unsubscribe. */
export function watchReducedMotion(cb: (reduce: boolean) => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  const handler = () => cb(mq.matches);
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @apogee/web exec vitest run tests/space/motion.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/space/motion.ts packages/web/tests/space/motion.test.ts
git commit -m "test(web): add reduced-motion decision helper"
```

## Task 2: Probe trail ring buffer

**Files:**
- Create: `packages/web/src/space/trail.ts`
- Test: `packages/web/tests/space/trail.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/web/tests/space/trail.test.ts
import { describe, expect, it } from "vitest";
import { createTrail, pushTrail, clearTrail } from "../../src/space/trail";

describe("trail ring buffer", () => {
  it("keeps points in push order, newest last", () => {
    const t = createTrail(3);
    pushTrail(t, 1, 1);
    pushTrail(t, 2, 2);
    expect(t.points).toEqual([{ x: 1, y: 1 }, { x: 2, y: 2 }]);
  });
  it("drops the oldest point past capacity", () => {
    const t = createTrail(2);
    pushTrail(t, 1, 1);
    pushTrail(t, 2, 2);
    pushTrail(t, 3, 3);
    expect(t.points).toEqual([{ x: 2, y: 2 }, { x: 3, y: 3 }]);
  });
  it("clears", () => {
    const t = createTrail(2);
    pushTrail(t, 1, 1);
    clearTrail(t);
    expect(t.points).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @apogee/web exec vitest run tests/space/trail.test.ts`
Expected: FAIL — cannot find module `../../src/space/trail`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/web/src/space/trail.ts
export interface TrailPoint {
  x: number;
  y: number;
}

export interface Trail {
  points: TrailPoint[];
  cap: number;
}

export function createTrail(cap = 18): Trail {
  return { points: [], cap };
}

export function pushTrail(t: Trail, x: number, y: number): void {
  t.points.push({ x, y });
  if (t.points.length > t.cap) t.points.shift();
}

export function clearTrail(t: Trail): void {
  t.points.length = 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @apogee/web exec vitest run tests/space/trail.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/space/trail.ts packages/web/tests/space/trail.test.ts
git commit -m "test(web): add probe trail ring buffer"
```

## Task 3: Impact-burst effect helpers

**Files:**
- Create: `packages/web/src/space/effects.ts`
- Test: `packages/web/tests/space/effects.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/web/tests/space/effects.test.ts
import { describe, expect, it } from "vitest";
import { pruneBursts, burstProgress, BURST_LIFE, type Burst } from "../../src/space/effects";

const burst = (start: number): Burst => ({ x: 0, y: 0, start, kind: "land" });

describe("burst effects", () => {
  it("keeps bursts within their lifetime and drops expired ones", () => {
    const list = [burst(0), burst(500)];
    expect(pruneBursts(list, 400)).toHaveLength(2);
    expect(pruneBursts(list, BURST_LIFE + 1)).toEqual([burst(500)]);
  });
  it("reports progress clamped to 0..1", () => {
    expect(burstProgress(burst(0), -10)).toBe(0);
    expect(burstProgress(burst(0), BURST_LIFE / 2)).toBeCloseTo(0.5, 5);
    expect(burstProgress(burst(0), BURST_LIFE * 2)).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @apogee/web exec vitest run tests/space/effects.test.ts`
Expected: FAIL — cannot find module `../../src/space/effects`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/web/src/space/effects.ts

/** A short-lived expanding ring drawn where a probe lands or is lost. */
export interface Burst {
  x: number;
  y: number;
  start: number; // ms (loop time) when the burst began
  kind: "land" | "lost";
}

/** Burst lifetime in ms. */
export const BURST_LIFE = 600;

/** Drop bursts older than `life`. */
export function pruneBursts(list: Burst[], time: number, life = BURST_LIFE): Burst[] {
  return list.filter((b) => time - b.start < life);
}

/** 0 at spawn → 1 at end of life (clamped). */
export function burstProgress(b: Burst, time: number, life = BURST_LIFE): number {
  const p = (time - b.start) / life;
  return p < 0 ? 0 : p > 1 ? 1 : p;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @apogee/web exec vitest run tests/space/effects.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/space/effects.ts packages/web/tests/space/effects.test.ts
git commit -m "test(web): add impact-burst effect helpers"
```

## Task 4: Starfield generation + twinkle + parallax

**Files:**
- Create: `packages/web/src/space/starfield.ts`
- Test: `packages/web/tests/space/starfield.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/web/tests/space/starfield.test.ts
import { describe, expect, it } from "vitest";
import { generateStarfield, twinkleAlpha, parallax } from "../../src/space/starfield";

describe("starfield", () => {
  it("is deterministic for a given seed", () => {
    const a = generateStarfield(7, 200, 100, 12);
    const b = generateStarfield(7, 200, 100, 12);
    expect(a).toEqual(b);
  });
  it("places the requested count within bounds", () => {
    const f = generateStarfield(7, 200, 100, 30);
    expect(f.stars).toHaveLength(30);
    for (const s of f.stars) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThan(200);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThan(100);
    }
  });
  it("keeps twinkle alpha in (0.5, 1]", () => {
    const f = generateStarfield(7, 200, 100, 12);
    for (const t of [0, 500, 1234, 99999]) {
      for (const s of f.stars) {
        const a = twinkleAlpha(s, t);
        expect(a).toBeGreaterThan(0.5);
        expect(a).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
  });
  it("parallax: no drag → pure vertical drift at t=0; deeper layers shift more with drag", () => {
    expect(parallax(0.5, null, 0)).toEqual({ x: 0, y: 2 });
    const near = parallax(0.8, { dx: 100, dy: 0 }, 0).x;
    const far = parallax(0.4, { dx: 100, dy: 0 }, 0).x;
    expect(near).toBeLessThan(far); // both negative; near shifts more
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @apogee/web exec vitest run tests/space/starfield.test.ts`
Expected: FAIL — cannot find module `../../src/space/starfield`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/web/src/space/starfield.ts
import { mulberry32 } from "@apogee/engine";

export interface Star {
  x: number;
  y: number;
  r: number;
  depth: number; // parallax factor (far → near)
  phase: number; // twinkle phase offset
  twinkle: number; // twinkle amplitude 0.3..1
  tint: string;
}

export interface Starfield {
  stars: Star[];
  width: number;
  height: number;
}

/** Parallax depths, one per layer (far, mid, near). */
const DEPTHS = [0.15, 0.4, 0.8];

export function generateStarfield(
  seed: number,
  width: number,
  height: number,
  count = 180,
): Starfield {
  const rng = mulberry32(seed >>> 0);
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    const depth = DEPTHS[i % DEPTHS.length]!;
    stars.push({
      x: rng() * width,
      y: rng() * height,
      r: 0.4 + rng() * (0.6 + depth * 1.6),
      depth,
      phase: rng() * Math.PI * 2,
      twinkle: 0.3 + rng() * 0.7,
      tint: pickTint(rng()),
    });
  }
  return { stars, width, height };
}

function pickTint(t: number): string {
  if (t < 0.7) return "#ffffff";
  if (t < 0.85) return "#cfe0ff";
  if (t < 0.95) return "#ffe6c4";
  return "#ffd1e0";
}

/** Per-star brightness oscillation in (0.55, 1]. Render-only Math.sin is fine. */
export function twinkleAlpha(star: Star, timeMs: number): number {
  const v = Math.sin(timeMs * 0.001 * (0.6 + star.depth) + star.phase);
  return 1 - star.twinkle * 0.45 * (0.5 - 0.5 * v);
}

/** Screen-space offset for a layer given the current aim drag + slow ambient drift. */
export function parallax(
  depth: number,
  drag: { dx: number; dy: number } | null,
  timeMs: number,
): { x: number; y: number } {
  const dx = drag ? -drag.dx : 0;
  const dy = drag ? -drag.dy : 0;
  return {
    x: dx * depth * 0.02 + Math.sin(timeMs * 0.00005) * depth * 6,
    y: dy * depth * 0.02 + Math.cos(timeMs * 0.00004) * depth * 4,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @apogee/web exec vitest run tests/space/starfield.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/space/starfield.ts packages/web/tests/space/starfield.test.ts
git commit -m "test(web): add seeded starfield with twinkle and parallax"
```

## Task 5: Shooting-star schedule

**Files:**
- Create: `packages/web/src/space/shootingStars.ts`
- Test: `packages/web/tests/space/shootingStars.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/web/tests/space/shootingStars.test.ts
import { describe, expect, it } from "vitest";
import { activeShootingStars } from "../../src/space/shootingStars";

describe("activeShootingStars", () => {
  it("is deterministic for the same inputs", () => {
    for (const t of [0, 3000, 7200, 26000]) {
      expect(activeShootingStars(42, 1600, 1000, t)).toEqual(
        activeShootingStars(42, 1600, 1000, t),
      );
    }
  });
  it("returns at most two and progress stays in 0..1", () => {
    for (let t = 0; t < 60000; t += 137) {
      const stars = activeShootingStars(42, 1600, 1000, t);
      expect(stars.length).toBeLessThanOrEqual(2);
      for (const s of stars) {
        expect(s.progress).toBeGreaterThanOrEqual(0);
        expect(s.progress).toBeLessThanOrEqual(1);
      }
    }
  });
  it("produces at least one star over a long window", () => {
    let seen = 0;
    for (let t = 0; t < 60000; t += 50) seen += activeShootingStars(42, 1600, 1000, t).length;
    expect(seen).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @apogee/web exec vitest run tests/space/shootingStars.test.ts`
Expected: FAIL — cannot find module `../../src/space/shootingStars`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/web/src/space/shootingStars.ts
import { mulberry32 } from "@apogee/engine";

export interface ShootingStar {
  sx: number; // start x
  sy: number; // start y
  dx: number; // total travel x
  dy: number; // total travel y
  len: number; // tail length (px)
  progress: number; // 0..1 along travel
}

const INTERVAL = 6500; // ms between potential spawns
const DURATION = 1100; // ms a star is visible
const SPAWN_CHANCE = 0.6; // fraction of slots that actually spawn

export function activeShootingStars(
  seed: number,
  width: number,
  height: number,
  time: number,
): ShootingStar[] {
  const out: ShootingStar[] = [];
  const slot = Math.floor(time / INTERVAL);
  for (let s = slot - 1; s <= slot; s++) {
    if (s < 0) continue;
    const rng = mulberry32((seed ^ (s * 2654435761)) >>> 0);
    if (rng() > SPAWN_CHANCE) continue;
    const spawn = s * INTERVAL + rng() * (INTERVAL - DURATION);
    const age = time - spawn;
    if (age < 0 || age > DURATION) continue;
    const progress = age / DURATION;
    const angle = 0.25 + rng() * 0.5; // shallow downward streaks
    const travel = width * 0.5;
    out.push({
      sx: rng() * width * 0.7,
      sy: rng() * height * 0.4,
      dx: Math.cos(angle) * travel,
      dy: Math.sin(angle) * travel,
      len: 60 + rng() * 60,
      progress,
    });
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @apogee/web exec vitest run tests/space/shootingStars.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/space/shootingStars.ts packages/web/tests/space/shootingStars.test.ts
git commit -m "test(web): add deterministic shooting-star schedule"
```

## Task 6: Planet-type assignment + palettes

**Files:**
- Create: `packages/web/src/space/planetStyle.ts`
- Test: `packages/web/tests/space/planetStyle.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/web/tests/space/planetStyle.test.ts
import { describe, expect, it } from "vitest";
import { planetTypeFor, PLANET_PALETTES } from "../../src/space/planetStyle";

describe("planetTypeFor", () => {
  it("is deterministic for a given position", () => {
    expect(planetTypeFor({ x: 800, y: 520 })).toBe(planetTypeFor({ x: 800, y: 520 }));
  });
  it("produces all three types across a grid", () => {
    const seen = new Set<string>();
    for (let x = 0; x < 1600; x += 80) {
      for (let y = 0; y < 1000; y += 80) seen.add(planetTypeFor({ x, y }));
    }
    expect(seen).toEqual(new Set(["gasGiant", "rocky", "ice"]));
  });
  it("has a palette for every type", () => {
    for (const type of ["gasGiant", "rocky", "ice"] as const) {
      expect(PLANET_PALETTES[type]).toBeDefined();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @apogee/web exec vitest run tests/space/planetStyle.test.ts`
Expected: FAIL — cannot find module `../../src/space/planetStyle`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/web/src/space/planetStyle.ts
import { mulberry32 } from "@apogee/engine";

export type PlanetType = "gasGiant" | "rocky" | "ice";

export interface PlanetPalette {
  core: string;
  mid: string;
  edge: string;
  halo: string; // atmosphere glow color
}

export const PLANET_PALETTES: Record<PlanetType, PlanetPalette> = {
  gasGiant: { core: "#d6b48a", mid: "#b07c54", edge: "#2c1c12", halo: "rgba(230,170,110,0.40)" },
  rocky: { core: "#8b93a6", mid: "#545d72", edge: "#262c3c", halo: "rgba(150,170,210,0.22)" },
  ice: { core: "#d8f6ff", mid: "#6fc0d8", edge: "#173b52", halo: "rgba(120,220,255,0.42)" },
};

/**
 * Deterministic planet type from world position (which is itself seed-derived
 * upstream), so the look is stable per board without touching the engine.
 */
export function planetTypeFor(pos: { x: number; y: number }, seed = 0x9e37): PlanetType {
  const key = ((Math.round(pos.x) * 73856093) ^ (Math.round(pos.y) * 19349663) ^ seed) >>> 0;
  const r = mulberry32(key)();
  return r < 0.34 ? "gasGiant" : r < 0.67 ? "rocky" : "ice";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @apogee/web exec vitest run tests/space/planetStyle.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/space/planetStyle.ts packages/web/tests/space/planetStyle.test.ts
git commit -m "test(web): add deterministic planet-type styling"
```

## Task 7: Shared canvas palette constants

**Files:**
- Create: `packages/web/src/space/palette.ts`

- [ ] **Step 1: Write the constants**

```ts
// packages/web/src/space/palette.ts

/** Canvas colors shared by render.ts and cosmos.ts. Mirrors the chrome palette. */
export const COLORS = {
  ringPoints: ["#ffd54f", "#4fc3f7", "#7986cb"], // 5 / 3 / 1 points
  pad: "#80cbc4",
  probe: "#ffffff",
  probeLanded: "#a5d6a7",
  preview: "rgba(255, 213, 79, 0.85)",
  blockerBody: "#4d2026",
  blockerRim: "#e0564a",
  goalLocked: "#5c6b8a",
  goalOpen: "#80cbc4",
  key: "#ffd54f",
  target: "#ffb74d",
  targetHit: "#a5d6a7",
} as const;
```

- [ ] **Step 2: Verify it typechecks**

Run: `pnpm --filter @apogee/web typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/space/palette.ts
git commit -m "feat(web): add shared canvas palette constants"
```

---

# Phase B — Shared cosmos backdrop (first visible change)

## Task 8: Cosmos drawing module

**Files:**
- Create: `packages/web/src/space/cosmos.ts`

Manual verification only (drawing). It is exercised by Task 9.

- [ ] **Step 1: Write the implementation**

```ts
// packages/web/src/space/cosmos.ts
import { activeShootingStars } from "./shootingStars";
import { parallax, twinkleAlpha, type Starfield } from "./starfield";

export interface NebulaCache {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

/** Paint the nebula once into an offscreen canvas; we blit it each frame. */
export function createNebula(width: number, height: number): NebulaCache {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(width));
  canvas.height = Math.max(1, Math.floor(height));
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#06070f";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const span = Math.max(canvas.width, canvas.height);
  const blobs = [
    { x: canvas.width * 0.72, y: canvas.height * 0.16, r: span * 0.5, c: "rgba(138,78,178,0.35)" },
    { x: canvas.width * 0.14, y: canvas.height * 0.9, r: span * 0.55, c: "rgba(40,98,176,0.33)" },
    { x: canvas.width * 0.5, y: canvas.height * 0.55, r: span * 0.45, c: "rgba(36,150,150,0.14)" },
  ];
  for (const b of blobs) {
    const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
    g.addColorStop(0, b.c);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  return { canvas, width, height };
}

export interface BackdropOpts {
  width: number;
  height: number;
  nebula: NebulaCache;
  field: Starfield;
  seed: number;
  time: number;
  drag: { dx: number; dy: number } | null;
  animate: boolean;
}

export function drawBackdrop(ctx: CanvasRenderingContext2D, o: BackdropOpts): void {
  ctx.clearRect(0, 0, o.width, o.height);

  // Nebula — slow drift, drawn slightly oversized so edges never show.
  const driftX = o.animate ? Math.sin(o.time * 0.00003) * 14 : 0;
  const driftY = o.animate ? Math.cos(o.time * 0.000023) * 10 : 0;
  ctx.drawImage(o.nebula.canvas, driftX - 14, driftY - 10, o.width + 28, o.height + 20);

  // Stars — twinkle + parallax per depth.
  for (const s of o.field.stars) {
    const off = o.animate ? parallax(s.depth, o.drag, o.time) : { x: 0, y: 0 };
    ctx.globalAlpha = o.animate ? twinkleAlpha(s, o.time) : 0.8;
    ctx.fillStyle = s.tint;
    ctx.beginPath();
    ctx.arc(s.x + off.x, s.y + off.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Shooting stars (ambient only).
  if (o.animate) {
    for (const sh of activeShootingStars(o.seed, o.width, o.height, o.time)) {
      const hx = sh.sx + sh.dx * sh.progress;
      const hy = sh.sy + sh.dy * sh.progress;
      const ux = sh.dx === 0 && sh.dy === 0 ? 0 : sh.dx / Math.sqrt(sh.dx * sh.dx + sh.dy * sh.dy);
      const uy = sh.dx === 0 && sh.dy === 0 ? 0 : sh.dy / Math.sqrt(sh.dx * sh.dx + sh.dy * sh.dy);
      const tx = hx - ux * sh.len;
      const ty = hy - uy * sh.len;
      const grad = ctx.createLinearGradient(tx, ty, hx, hy);
      grad.addColorStop(0, "rgba(255,255,255,0)");
      grad.addColorStop(1, "rgba(255,255,255,0.9)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(hx, hy);
      ctx.stroke();
    }
  }
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `pnpm --filter @apogee/web typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/space/cosmos.ts
git commit -m "feat(web): add cosmos backdrop drawing"
```

## Task 9: SpaceBackdrop component + mount behind all screens

**Files:**
- Create: `packages/web/src/space/SpaceBackdrop.tsx`
- Modify: `packages/web/src/App.tsx`
- Modify: `packages/web/src/styles.css`

- [ ] **Step 1: Write the component**

```tsx
// packages/web/src/space/SpaceBackdrop.tsx
import { useEffect, useRef } from "react";
import { createNebula, drawBackdrop, type NebulaCache } from "./cosmos";
import { generateStarfield, type Starfield } from "./starfield";
import { prefersReducedMotion, watchReducedMotion } from "./motion";

/** Stable seed for the shared sky ("cosmos"). */
const SEED = 0xc05705;

export function SpaceBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let nebula: NebulaCache;
    let field: Starfield;
    let reduce = prefersReducedMotion();
    let raf = 0;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      nebula = createNebula(width, height);
      field = generateStarfield(SEED, width, height);
    };

    const frame = (t: number) => {
      drawBackdrop(ctx, {
        width,
        height,
        nebula,
        field,
        seed: SEED,
        time: t,
        drag: null,
        animate: !reduce && !document.hidden,
      });
      if (!reduce && !document.hidden) raf = requestAnimationFrame(frame);
      else raf = 0;
    };

    const start = () => {
      cancelAnimationFrame(raf);
      if (!reduce && !document.hidden) raf = requestAnimationFrame(frame);
      else frame(0); // one static paint
    };

    const onResize = () => {
      resize();
      if (!raf) frame(0);
    };
    const onVisibility = () => start();
    const unwatch = watchReducedMotion((r) => {
      reduce = r;
      start();
    });

    resize();
    start();
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      unwatch();
    };
  }, []);

  return <canvas ref={ref} className="space-backdrop" aria-hidden="true" />;
}
```

- [ ] **Step 2: Mount it in App.tsx**

Edit `packages/web/src/App.tsx`. Add the import after the existing imports:

```tsx
import { SpaceBackdrop } from "./space/SpaceBackdrop";
```

Then wrap the returned views so the backdrop is always present. Change the top of the component body from:

```tsx
export function App() {
  const [view, setView] = useState<View>({ name: "home" });
  const [playCount, setPlayCount] = useState(0);

  const play = (index: number) => {
    setPlayCount((n) => n + 1);
    setView({ name: "level", index });
  };

  if (view.name === "daily") {
```

to (extract the view switch into a helper and render the backdrop alongside it):

```tsx
export function App() {
  const [view, setView] = useState<View>({ name: "home" });
  const [playCount, setPlayCount] = useState(0);

  const play = (index: number) => {
    setPlayCount((n) => n + 1);
    setView({ name: "level", index });
  };

  const screen = () => {
    if (view.name === "daily") {
```

Then change each `return <X .../>;` inside the former `if` blocks to `return <X .../>;` unchanged BUT move them inside `screen()`, and replace the final `return (<div className="home">...)` with `return (...)` inside `screen()`. Finally, after `screen()` is defined, the component returns:

```tsx
  return (
    <>
      <SpaceBackdrop />
      {screen()}
    </>
  );
}
```

The complete rewritten `App.tsx` body is:

```tsx
export function App() {
  const [view, setView] = useState<View>({ name: "home" });
  const [playCount, setPlayCount] = useState(0);

  const play = (index: number) => {
    setPlayCount((n) => n + 1);
    setView({ name: "level", index });
  };

  const screen = () => {
    if (view.name === "daily") {
      return <DailyGame onExit={() => setView({ name: "home" })} />;
    }
    if (view.name === "map") {
      return <CampaignMap onExit={() => setView({ name: "home" })} onPlay={play} />;
    }
    if (view.name === "level") {
      return (
        <CampaignLevel
          key={`${view.index}-${playCount}`}
          index={view.index}
          onExit={() => setView({ name: "map" })}
          onPlay={play}
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
  };

  return (
    <>
      <SpaceBackdrop />
      {screen()}
    </>
  );
}
```

- [ ] **Step 3: Add backdrop CSS + make the app shell transparent**

In `packages/web/src/styles.css`, change the `body` rule and add backdrop rules. Replace:

```css
body { background: #0b0e1a; color: #e8eaf6; font-family: system-ui, sans-serif; }
```

with:

```css
body { background: #06070f; color: #e8eaf6; font-family: system-ui, sans-serif; }
.space-backdrop {
  position: fixed; inset: 0; z-index: -1; pointer-events: none; display: block;
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @apogee/web typecheck`
Expected: no errors.

- [ ] **Step 5: Manual verification**

Run: `pnpm dev` and open the URL.
Expected:
- The **home screen** shows a nebula + twinkling stars behind the title; occasional shooting stars streak across.
- Resize the window — the sky refills with no visible seams.
- Open DevTools → Rendering → emulate `prefers-reduced-motion: reduce` (or OS setting), reload: stars are static, no shooting stars, no drift.
- Switch to another browser tab for a few seconds and back: animation paused while hidden, resumes on return (verify CPU drop in DevTools Performance if unsure).
- The game board screens still render as before (canvas still opaque for now — that's expected; we fix it in Task 11).

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/space/SpaceBackdrop.tsx packages/web/src/App.tsx packages/web/src/styles.css
git commit -m "feat(web): shared animated cosmos backdrop behind all screens"
```

---

# Phase C — Enriched game board

## Task 10: Shared board render loop (behavior-preserving refactor)

Unify the daily and campaign canvases onto one continuous-rAF hook. **No visual change yet** — time/trail/bursts are threaded through but unused; the canvas stays opaque. This isolates the riskiest change.

**Files:**
- Modify: `packages/web/src/render.ts` (extend view interfaces + signatures; body unchanged)
- Create: `packages/web/src/space/useBoardCanvas.ts`
- Modify: `packages/web/src/GameCanvas.tsx` (rewrite as thin wrapper)
- Modify: `packages/web/src/campaign/CampaignCanvas.tsx` (rewrite as thin wrapper)

- [ ] **Step 1: Extend the render view interfaces**

In `packages/web/src/render.ts`, add the import at the top (after the existing engine import block):

```ts
import type { Burst } from "./space/effects";
```

Change `RenderView` from:

```ts
export interface RenderView {
  game: GameState;
  /** Live positions during animation; falls back to game.probes when null. */
  probeFrames: ProbeFrame[] | null;
  /** New-probe preview path while aiming. */
  previewPath: { x: number; y: number }[] | null;
  /** Current drag vector while aiming (drawn at the launch pad). */
  drag: { dx: number; dy: number } | null;
}
```

to:

```ts
export interface RenderView {
  game: GameState;
  /** Live positions during animation; falls back to game.probes when null. */
  probeFrames: ProbeFrame[] | null;
  /** New-probe preview path while aiming. */
  previewPath: { x: number; y: number }[] | null;
  /** Current drag vector while aiming (drawn at the launch pad). */
  drag: { dx: number; dy: number } | null;
  /** Recent positions of the in-flight probe (oldest→newest), or null. */
  trail: { x: number; y: number }[] | null;
  /** Active impact bursts to draw. */
  bursts: Burst[];
  /** Loop time in ms (frozen at 0 under reduced motion). */
  time: number;
  /** Whether ambient motion is enabled this frame. */
  animate: boolean;
}
```

Change `CampaignRenderView` from:

```ts
export interface CampaignRenderView {
  state: CampaignLevelState;
  probeFrames: ProbeFrame[] | null;
  previewPath: { x: number; y: number }[] | null;
  drag: { dx: number; dy: number } | null;
}
```

to:

```ts
export interface CampaignRenderView {
  state: CampaignLevelState;
  probeFrames: ProbeFrame[] | null;
  previewPath: { x: number; y: number }[] | null;
  drag: { dx: number; dy: number } | null;
  trail: { x: number; y: number }[] | null;
  bursts: Burst[];
  time: number;
  animate: boolean;
}
```

Leave the bodies of `drawFrame` / `drawCampaignFrame` unchanged for now (they simply ignore the new fields). The file still compiles because the new fields are only read in later tasks.

- [ ] **Step 2: Write the shared hook**

```ts
// packages/web/src/space/useBoardCanvas.ts
import { type LaunchInput, type ProbeFrame, PREVIEW_STEPS } from "@apogee/engine";
import { useEffect, useRef } from "react";
import { type Burst, pruneBursts } from "./effects";
import { prefersReducedMotion } from "./motion";
import { clearTrail, createTrail, pushTrail } from "./trail";

export interface BoardDrawOpts {
  probeFrames: ProbeFrame[] | null;
  previewPath: { x: number; y: number }[] | null;
  drag: { dx: number; dy: number } | null;
  trail: { x: number; y: number }[] | null;
  bursts: Burst[];
  time: number;
  animate: boolean;
}

/** Per-board adapter: where the launch pad is, how to preview, and how to draw. */
export interface BoardAdapter {
  launchPos: { x: number; y: number };
  /** Index of the just-launched probe in preview/anim frame arrays. */
  probeIndex: number;
  /** Live-sim a preview trace for the given drag. */
  previewTrace: (drag: LaunchInput, steps: number) => ProbeFrame[][];
  /** Draw one frame. */
  draw: (ctx: CanvasRenderingContext2D, opts: BoardDrawOpts) => void;
}

export interface UseBoardCanvas {
  disabled: boolean;
  anim: ProbeFrame[][] | null;
  onLaunch: (input: LaunchInput) => void;
  onAnimDone: () => void;
  adapter: BoardAdapter;
  worldWidth: number;
  worldHeight: number;
}

function toWorld(
  canvas: HTMLCanvasElement,
  e: PointerEvent,
  w: number,
  h: number,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) * w) / rect.width,
    y: ((e.clientY - rect.top) * h) / rect.height,
  };
}

export function useBoardCanvas(opts: UseBoardCanvas) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const trailRef = useRef(createTrail());
  const burstsRef = useRef<Burst[]>([]);
  const frameIdxRef = useRef(0);
  const prevStateRef = useRef<ProbeFrame["state"]>("flying");

  // Refs kept fresh every render so the persistent loop reads current values.
  const animRef = useRef(opts.anim);
  const adapterRef = useRef(opts.adapter);
  const cbRef = useRef({ onLaunch: opts.onLaunch, onAnimDone: opts.onAnimDone, disabled: opts.disabled });
  adapterRef.current = opts.adapter;
  cbRef.current = { onLaunch: opts.onLaunch, onAnimDone: opts.onAnimDone, disabled: opts.disabled };

  // Detect a newly-started animation (reset playback + trail + transition tracking).
  if (opts.anim !== animRef.current) {
    animRef.current = opts.anim;
    frameIdxRef.current = 0;
    prevStateRef.current = "flying";
    clearTrail(trailRef.current);
  }

  // Kick the loop when a new animation arrives (needed in reduced-motion idle).
  const kickRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (opts.anim) kickRef.current();
  }, [opts.anim]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduce = prefersReducedMotion();
    let raf = 0;

    const computePreview = (): { x: number; y: number }[] | null => {
      const drag = dragRef.current;
      if (!drag || (drag.dx === 0 && drag.dy === 0)) return null;
      const adapter = adapterRef.current;
      const trace = adapter.previewTrace(drag, PREVIEW_STEPS);
      return trace
        .map((f) => f[adapter.probeIndex])
        .filter((f): f is ProbeFrame => f !== undefined && f.state === "flying")
        .map((f) => ({ x: f.x, y: f.y }));
    };

    const render = (time: number) => {
      const adapter = adapterRef.current;
      const anim = animRef.current;
      const t = reduce ? 0 : time;
      burstsRef.current = pruneBursts(burstsRef.current, time);
      if (anim) {
        const i = Math.min(frameIdxRef.current, anim.length - 1);
        const probeFrames = anim[i] ?? null;
        const pf = probeFrames?.[adapter.probeIndex];
        if (pf) {
          if (!reduce && pf.state === "flying") pushTrail(trailRef.current, pf.x, pf.y);
          if (pf.state !== prevStateRef.current && pf.state !== "flying") {
            if (!reduce) {
              burstsRef.current.push({
                x: pf.x,
                y: pf.y,
                start: time,
                kind: pf.state === "landed" ? "land" : "lost",
              });
            }
            prevStateRef.current = pf.state;
          }
        }
        adapter.draw(ctx, {
          probeFrames,
          previewPath: null,
          drag: null,
          trail: reduce ? null : trailRef.current.points.slice(),
          bursts: burstsRef.current,
          time: t,
          animate: !reduce,
        });
        frameIdxRef.current++;
        if (frameIdxRef.current >= anim.length) {
          animRef.current = null;
          clearTrail(trailRef.current);
          cbRef.current.onAnimDone();
        }
      } else {
        adapter.draw(ctx, {
          probeFrames: null,
          previewPath: computePreview(),
          drag: dragRef.current,
          trail: null,
          bursts: burstsRef.current,
          time: t,
          animate: !reduce,
        });
      }
    };

    const wantLoop = () =>
      animRef.current !== null ||
      dragRef.current !== null ||
      burstsRef.current.length > 0 ||
      !reduce;

    const loop = (time: number) => {
      render(time);
      raf = wantLoop() ? requestAnimationFrame(loop) : 0;
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(loop);
    };
    kickRef.current = kick;

    const onDown = (e: PointerEvent) => {
      if (cbRef.current.disabled || animRef.current) return;
      canvas.setPointerCapture(e.pointerId);
      dragRef.current = { dx: 0, dy: 0 };
      kick();
    };
    const onMove = (e: PointerEvent) => {
      if (!dragRef.current) return;
      const w = toWorld(canvas, e, opts.worldWidth, opts.worldHeight);
      const lp = adapterRef.current.launchPos;
      dragRef.current = { dx: lp.x - w.x, dy: lp.y - w.y };
      kick();
    };
    const onUp = () => {
      const drag = dragRef.current;
      dragRef.current = null;
      kick();
      if (drag && (drag.dx !== 0 || drag.dy !== 0)) cbRef.current.onLaunch(drag);
    };
    const onCancel = () => {
      dragRef.current = null;
      kick();
    };

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onCancel);
    kick();

    return () => {
      kickRef.current = () => {};
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onCancel);
    };
  }, [opts.worldWidth, opts.worldHeight]);

  return canvasRef;
}
```

- [ ] **Step 3: Rewrite `GameCanvas.tsx` as a thin wrapper**

Replace the entire contents of `packages/web/src/GameCanvas.tsx` with:

```tsx
import {
  WORLD_HEIGHT,
  WORLD_WIDTH,
  simulateLaunch,
  type GameState,
  type LaunchInput,
  type ProbeFrame,
} from "@apogee/engine";
import { drawFrame } from "./render";
import { useBoardCanvas, type BoardDrawOpts } from "./space/useBoardCanvas";

interface Props {
  game: GameState;
  disabled: boolean;
  anim: ProbeFrame[][] | null;
  onLaunch: (input: LaunchInput) => void;
  onAnimDone: () => void;
}

export function GameCanvas({ game, disabled, anim, onLaunch, onAnimDone }: Props) {
  const canvasRef = useBoardCanvas({
    disabled,
    anim,
    onLaunch,
    onAnimDone,
    worldWidth: WORLD_WIDTH,
    worldHeight: WORLD_HEIGHT,
    adapter: {
      launchPos: game.system.launchPos,
      probeIndex: game.probes.length,
      previewTrace: (drag, steps) => simulateLaunch(game, drag, steps).trace,
      draw: (ctx, o: BoardDrawOpts) =>
        drawFrame(ctx, {
          game,
          probeFrames: o.probeFrames,
          previewPath: o.previewPath,
          drag: o.drag,
          trail: o.trail,
          bursts: o.bursts,
          time: o.time,
          animate: o.animate,
        }),
    },
  });

  return <canvas ref={canvasRef} width={WORLD_WIDTH} height={WORLD_HEIGHT} />;
}
```

- [ ] **Step 4: Rewrite `CampaignCanvas.tsx` as a thin wrapper**

Replace the entire contents of `packages/web/src/campaign/CampaignCanvas.tsx` with:

```tsx
import {
  WORLD_HEIGHT,
  WORLD_WIDTH,
  simulateCampaignLaunch,
  type CampaignLevelState,
  type LaunchInput,
  type ProbeFrame,
} from "@apogee/engine";
import { drawCampaignFrame } from "../render";
import { useBoardCanvas, type BoardDrawOpts } from "../space/useBoardCanvas";

interface Props {
  state: CampaignLevelState;
  disabled: boolean;
  anim: ProbeFrame[][] | null;
  onLaunch: (input: LaunchInput) => void;
  onAnimDone: () => void;
}

export function CampaignCanvas({ state, disabled, anim, onLaunch, onAnimDone }: Props) {
  const canvasRef = useBoardCanvas({
    disabled,
    anim,
    onLaunch,
    onAnimDone,
    worldWidth: WORLD_WIDTH,
    worldHeight: WORLD_HEIGHT,
    adapter: {
      launchPos: state.level.launchPos,
      probeIndex: state.probes.length,
      previewTrace: (drag, steps) => simulateCampaignLaunch(state, drag, steps).trace,
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
        }),
    },
  });

  return <canvas ref={canvasRef} width={WORLD_WIDTH} height={WORLD_HEIGHT} />;
}
```

- [ ] **Step 5: Typecheck + existing tests**

Run: `pnpm --filter @apogee/web typecheck && pnpm --filter @apogee/web test`
Expected: no type errors; all existing tests pass.

- [ ] **Step 6: Manual verification (behavior unchanged)**

Run: `pnpm dev`.
Expected — gameplay works exactly as before:
- Daily: drag from the pad shows the dashed preview; release launches; the probe animates; score updates; 5 launches then game-over overlay.
- Campaign: pick a level, same aiming/launch/animation; objectives/stars still register.
- No console errors; rapid re-aiming and quick successive launches behave normally.

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/render.ts packages/web/src/space/useBoardCanvas.ts packages/web/src/GameCanvas.tsx packages/web/src/campaign/CampaignCanvas.tsx
git commit -m "refactor(web): unify board canvases on a continuous render loop"
```

## Task 11: Transparent board + near-field dust

Now let the cosmos show through the board and add parallaxing foreground dust. Touches both draw functions.

**Files:**
- Modify: `packages/web/src/render.ts`

- [ ] **Step 1: Replace the starfield constant with dust + add helpers**

In `packages/web/src/render.ts`, replace this block:

```ts
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
```

with:

```ts
/** Near-field dust (render-only); parallaxes with the aim drag for depth. */
const DUST: { x: number; y: number; r: number }[] = (() => {
  const rng = mulberry32(0xd057);
  return Array.from({ length: 28 }, () => ({
    x: rng() * WORLD_WIDTH,
    y: rng() * WORLD_HEIGHT,
    r: 0.6 + rng() * 1.4,
  }));
})();

const RING_COLORS = COLORS.ringPoints;

function drawDust(
  ctx: CanvasRenderingContext2D,
  drag: { dx: number; dy: number } | null,
  animate: boolean,
): void {
  const ox = animate && drag ? -drag.dx * 0.012 : 0;
  const oy = animate && drag ? -drag.dy * 0.012 : 0;
  ctx.fillStyle = "rgba(200,215,255,0.5)";
  for (const d of DUST) {
    ctx.beginPath();
    ctx.arc(d.x + ox, d.y + oy, d.r, 0, Math.PI * 2);
    ctx.fill();
  }
}
```

Add the palette import near the top of the file (after the engine import):

```ts
import { COLORS } from "./space/palette";
```

- [ ] **Step 2: Make `drawFrame` transparent + draw dust**

In `drawFrame`, replace:

```ts
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
```

with:

```ts
  ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  // Transparent over the shared cosmos backdrop; only near-field dust here.
  drawDust(ctx, view.drag, view.animate);
```

- [ ] **Step 3: Make `drawCampaignFrame` transparent + draw dust**

In `drawCampaignFrame`, replace:

```ts
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
```

with:

```ts
  ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  // Transparent over the shared cosmos backdrop; only near-field dust here.
  drawDust(ctx, view.drag, view.animate);
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @apogee/web typecheck`
Expected: no errors (the now-unused `mulberry32` import is still used by `DUST`; confirm no "unused import" error — if `mulberry32` is reported unused, it means a copy/paste slip, keep it since `DUST` uses it).

- [ ] **Step 5: Manual verification**

Run: `pnpm dev`.
Expected:
- The game board now shows the **same nebula + stars** as the home screen behind the planets/rings.
- While dragging to aim, the foreground dust shifts slightly (parallax). Under reduced motion it holds still.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/render.ts
git commit -m "feat(web): transparent board over cosmos with parallax dust"
```

## Task 12: Planet types + atmosphere glow

**Files:**
- Modify: `packages/web/src/render.ts`

- [ ] **Step 1: Add the planet/blocker helpers**

Add the import near the top of `render.ts`:

```ts
import { PLANET_PALETTES, planetTypeFor } from "./space/planetStyle";
```

Add these helpers above `drawFrame`:

```ts
function drawPlanet(
  ctx: CanvasRenderingContext2D,
  pos: { x: number; y: number },
  radius: number,
): void {
  const type = planetTypeFor(pos);
  const pal = PLANET_PALETTES[type];

  // Atmosphere halo.
  const haloR = radius * 1.5;
  const halo = ctx.createRadialGradient(pos.x, pos.y, radius * 0.85, pos.x, pos.y, haloR);
  halo.addColorStop(0, pal.halo);
  halo.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, haloR, 0, Math.PI * 2);
  ctx.fill();

  // Body.
  const g = ctx.createRadialGradient(
    pos.x - radius * 0.3,
    pos.y - radius * 0.35,
    radius * 0.1,
    pos.x,
    pos.y,
    radius,
  );
  g.addColorStop(0, pal.core);
  g.addColorStop(0.5, pal.mid);
  g.addColorStop(1, pal.edge);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
  ctx.fill();

  // Gas-giant banding (clipped to the disc).
  if (type === "gasGiant") {
    ctx.save();
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = radius * 0.12;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(pos.x - radius, pos.y + i * radius * 0.28);
      ctx.lineTo(pos.x + radius, pos.y + i * radius * 0.28 + radius * 0.1);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Terminator shadow.
  const term = ctx.createRadialGradient(
    pos.x + radius * 0.5,
    pos.y + radius * 0.5,
    radius * 0.2,
    pos.x,
    pos.y,
    radius,
  );
  term.addColorStop(0, "rgba(0,0,0,0)");
  term.addColorStop(1, "rgba(0,0,10,0.55)");
  ctx.fillStyle = term;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
  ctx.fill();

  // Rim light.
  ctx.strokeStyle = "rgba(180,200,240,0.25)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
  ctx.stroke();
}

function drawBlocker(
  ctx: CanvasRenderingContext2D,
  pos: { x: number; y: number },
  radius: number,
  time: number,
  animate: boolean,
): void {
  const g = ctx.createRadialGradient(
    pos.x - radius * 0.3,
    pos.y - radius * 0.3,
    radius * 0.1,
    pos.x,
    pos.y,
    radius,
  );
  g.addColorStop(0, "#7a2a2f");
  g.addColorStop(0.6, COLORS.blockerBody);
  g.addColorStop(1, "#1a0a0c");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.shadowColor = COLORS.blockerRim;
  ctx.shadowBlur = 10;
  ctx.strokeStyle = COLORS.blockerRim;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Pulsing hazard ring.
  const pulse = animate ? 0.35 + 0.15 * Math.sin(time * 0.005) : 0.35;
  ctx.strokeStyle = `rgba(224, 86, 74, ${pulse})`;
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, radius + PROBE_RADIUS + 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}
```

- [ ] **Step 2: Use `drawPlanet` in `drawFrame`**

In `drawFrame`, replace the planets block:

```ts
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
```

with:

```ts
  // Planets
  for (const p of game.system.planets) {
    drawPlanet(ctx, p.pos, p.radius);
  }
```

- [ ] **Step 3: Use `drawPlanet`/`drawBlocker` in `drawCampaignFrame`**

In `drawCampaignFrame`, replace the bodies block:

```ts
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
```

with:

```ts
  // Bodies: planets vs hostile blockers.
  for (const b of level.bodies) {
    if (b.kind === "blocker") {
      drawBlocker(ctx, b.pos, b.radius, view.time, view.animate);
    } else {
      drawPlanet(ctx, b.pos, b.radius);
    }
  }
```

- [ ] **Step 4: Typecheck + manual verification**

Run: `pnpm --filter @apogee/web typecheck`
Expected: no errors.

Run: `pnpm dev`.
Expected: planets render as shaded spheres with atmosphere halos and varied types (gas giant with bands, rocky, ice). Campaign blockers glow red with a pulsing hazard ring (steady under reduced motion).

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/render.ts
git commit -m "feat(web): atmospheric planet types and hostile blockers"
```

## Task 13: Glowing rings, goal, keys, targets

**Files:**
- Modify: `packages/web/src/render.ts`

- [ ] **Step 1: Add a glow-stroke helper**

Add above `drawFrame` in `render.ts`:

```ts
function glowStroke(
  ctx: CanvasRenderingContext2D,
  color: string,
  blur: number,
  lineWidth: number,
  path: () => void,
): void {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  path();
  ctx.stroke();
  ctx.restore();
}
```

- [ ] **Step 2: Glow the daily scoring rings**

In `drawFrame`, replace the zone-rings block:

```ts
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
```

with:

```ts
  // Zone rings — glowing, semantic 5/3/1 colors.
  for (const zone of game.system.zones) {
    for (let i = RINGS.length - 1; i >= 0; i--) {
      const color = RING_COLORS[i] ?? "#fff";
      glowStroke(ctx, color, 8, 2, () => {
        ctx.beginPath();
        ctx.arc(zone.center.x, zone.center.y, RINGS[i]!.maxDist, 0, Math.PI * 2);
      });
    }
  }
```

- [ ] **Step 3: Replace the campaign targets/keys/goal blocks**

In `drawCampaignFrame`, replace the targets block:

```ts
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
```

with:

```ts
  // Targets: open marks that fill + glow when hit.
  level.targets.forEach((t, i) => {
    const hit = state.targetsHit[i] ?? false;
    const color = hit ? COLORS.targetHit : COLORS.target;
    ctx.fillStyle = hit ? "rgba(165, 214, 167, 0.5)" : "rgba(255, 183, 77, 0.12)";
    ctx.beginPath();
    ctx.arc(t.pos.x, t.pos.y, t.radius, 0, Math.PI * 2);
    ctx.fill();
    glowStroke(ctx, color, hit ? 12 : 4, 3, () => {
      ctx.beginPath();
      ctx.arc(t.pos.x, t.pos.y, t.radius, 0, Math.PI * 2);
    });
  });
```

Replace the keys block:

```ts
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
```

with:

```ts
  // Keys: glinting diamonds, dimmed once collected.
  level.keys.forEach((k, i) => {
    const got = state.keysCollected[i] ?? false;
    const glint = view.animate && !got ? 0.6 + 0.4 * Math.sin(view.time * 0.004 + i) : 1;
    ctx.globalAlpha = got ? 0.25 : 1;
    ctx.save();
    if (!got) {
      ctx.shadowColor = COLORS.key;
      ctx.shadowBlur = 10 * glint;
    }
    ctx.fillStyle = COLORS.key;
    ctx.beginPath();
    ctx.moveTo(k.pos.x, k.pos.y - k.radius);
    ctx.lineTo(k.pos.x + k.radius, k.pos.y);
    ctx.lineTo(k.pos.x, k.pos.y + k.radius);
    ctx.lineTo(k.pos.x - k.radius, k.pos.y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  });
```

Replace the goal block:

```ts
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
```

with:

```ts
  // Goal portal: dim + dashed when locked; glowing + slowly rotating when open.
  if (level.goal) {
    const goal = level.goal;
    const unlocked = state.keysCollected.every(Boolean);
    ctx.fillStyle = unlocked ? "rgba(128, 203, 196, 0.18)" : "rgba(92, 107, 138, 0.12)";
    ctx.beginPath();
    ctx.arc(goal.pos.x, goal.pos.y, goal.radius, 0, Math.PI * 2);
    ctx.fill();
    if (unlocked) {
      const rot = view.animate ? view.time * 0.001 : 0;
      ctx.save();
      ctx.translate(goal.pos.x, goal.pos.y);
      ctx.rotate(rot);
      ctx.shadowColor = COLORS.goalOpen;
      ctx.shadowBlur = 14;
      ctx.strokeStyle = COLORS.goalOpen;
      ctx.lineWidth = 4;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.arc(0, 0, goal.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      ctx.setLineDash([]);
    } else {
      ctx.strokeStyle = COLORS.goalLocked;
      ctx.lineWidth = 4;
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.arc(goal.pos.x, goal.pos.y, goal.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
```

- [ ] **Step 4: Typecheck + manual verification**

Run: `pnpm --filter @apogee/web typecheck`
Expected: no errors.

Run: `pnpm dev`.
Expected: scoring rings glow in their 5/3/1 colors; campaign keys glint (steady under reduced motion) and dim when collected; targets glow green when hit; the goal is dim/dashed when locked and a glowing, slowly rotating portal once all keys are collected.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/render.ts
git commit -m "feat(web): glowing rings, goal portal, keys, and targets"
```

## Task 14: Glowing probes + flight trails

**Files:**
- Modify: `packages/web/src/render.ts`

- [ ] **Step 1: Add probe + trail helpers**

Add above `drawFrame` in `render.ts`:

```ts
function drawTrail(
  ctx: CanvasRenderingContext2D,
  trail: { x: number; y: number }[] | null,
): void {
  if (!trail || trail.length < 2) return;
  let prev = trail[0]!;
  for (let i = 1; i < trail.length; i++) {
    const p = trail[i]!;
    const a = i / trail.length;
    ctx.strokeStyle = `rgba(180,210,255,${a * 0.5})`;
    ctx.lineWidth = a * PROBE_RADIUS * 1.2;
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    prev = p;
  }
}

function drawProbe(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  landed: boolean,
  time: number,
  animate: boolean,
): void {
  const pulse = animate && landed ? 1 + 0.15 * Math.sin(time * 0.006) : 1;
  ctx.save();
  ctx.shadowColor = landed ? "rgba(165,214,167,0.9)" : "rgba(200,220,255,0.95)";
  ctx.shadowBlur = landed ? 12 : 9;
  ctx.fillStyle = landed ? COLORS.probeLanded : COLORS.probe;
  ctx.beginPath();
  ctx.arc(x, y, PROBE_RADIUS * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
```

- [ ] **Step 2: Use them in `drawFrame`**

In `drawFrame`, replace the probes block:

```ts
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
```

with:

```ts
  // In-flight trail, then probes.
  drawTrail(ctx, view.trail);
  const frames: ProbeFrame[] =
    view.probeFrames ??
    game.probes.map((p) => ({ x: p.pos.x, y: p.pos.y, state: p.state }));
  for (const f of frames) {
    if (f.state === "lost") continue;
    drawProbe(ctx, f.x, f.y, f.state === "landed", view.time, view.animate);
  }
```

- [ ] **Step 3: Use them in `drawCampaignFrame`**

In `drawCampaignFrame`, replace the probes block:

```ts
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
```

with:

```ts
  // In-flight trail, then probes.
  drawTrail(ctx, view.trail);
  const frames: ProbeFrame[] =
    view.probeFrames ??
    state.probes.map((p) => ({ x: p.pos.x, y: p.pos.y, state: p.state }));
  for (const f of frames) {
    if (f.state === "lost") continue;
    drawProbe(ctx, f.x, f.y, f.state === "landed", view.time, view.animate);
  }
```

- [ ] **Step 4: Typecheck + manual verification**

Run: `pnpm --filter @apogee/web typecheck`
Expected: no errors.

Run: `pnpm dev`.
Expected: launched probes glow and leave a fading trail in flight; settled landed probes glow green and gently pulse (steady under reduced motion; no trail under reduced motion).

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/render.ts
git commit -m "feat(web): glowing probes with flight trails"
```

## Task 15: Impact bursts on land/loss

The hook already records bursts (Task 10). Now draw them.

**Files:**
- Modify: `packages/web/src/render.ts`

- [ ] **Step 1: Add the burst helper**

Add the import near the top of `render.ts`:

```ts
import { burstProgress } from "./space/effects";
```

Add above `drawFrame`:

```ts
function drawBursts(
  ctx: CanvasRenderingContext2D,
  bursts: { x: number; y: number; start: number; kind: "land" | "lost" }[],
  time: number,
): void {
  for (const b of bursts) {
    const p = burstProgress(b, time);
    const r = PROBE_RADIUS + p * PROBE_RADIUS * 5;
    const fade = 1 - p;
    ctx.strokeStyle =
      b.kind === "land" ? `rgba(165,214,167,${fade * 0.8})` : `rgba(224,86,74,${fade * 0.8})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
}
```

- [ ] **Step 2: Draw bursts in both functions**

In `drawFrame`, immediately after the probes loop (the `for (const f of frames)` block from Task 14), add:

```ts
  drawBursts(ctx, view.bursts, view.time);
```

In `drawCampaignFrame`, immediately after its probes loop, add the same line:

```ts
  drawBursts(ctx, view.bursts, view.time);
```

- [ ] **Step 3: Typecheck + manual verification**

Run: `pnpm --filter @apogee/web typecheck`
Expected: no errors.

Run: `pnpm dev`.
Expected: when a probe lands, a green ring briefly expands and fades at the landing point; when a probe is lost (flies off / hits a blocker), a red ring expands. None under reduced motion.

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/render.ts
git commit -m "feat(web): impact bursts on probe land and loss"
```

---

# Phase D — Chrome polish

## Task 16: Palette variables, home wordmark, glassy buttons

**Files:**
- Modify: `packages/web/src/styles.css`

- [ ] **Step 1: Add palette variables at the top of `styles.css`**

Add at the very top of the file (before the `*` rule):

```css
:root {
  --bg-deep: #06070f;
  --ink: #e8eaf6;
  --muted: #9fb0d8;
  --accent: #80cbc4;
  --accent-glow: rgba(128, 203, 196, 0.5);
  --edge: rgba(128, 170, 230, 0.45);
  --glass: linear-gradient(180deg, rgba(40, 55, 95, 0.5), rgba(20, 28, 52, 0.5));
}
```

- [ ] **Step 2: Restyle the home screen + buttons**

Replace:

```css
.home { display: flex; flex-direction: column; align-items: center; gap: 16px; margin-top: 18vh; }
.home h1 { font-size: 2.4rem; letter-spacing: 0.3em; }
.home .tagline { opacity: 0.6; margin-bottom: 8px; }
.home button, .actions button, .level-tile {
  font: inherit; cursor: pointer; border-radius: 8px;
  border: 1px solid #52628a; background: #1a2238; color: #e8eaf6; padding: 10px 18px;
}
.home button:hover, .actions button:hover, .level-tile:not(.locked):hover { border-color: #80cbc4; }
```

with:

```css
.home { display: flex; flex-direction: column; align-items: center; gap: 16px; margin-top: 18vh; }
.home h1 {
  font-size: 3rem; font-weight: 800; letter-spacing: 0.34em; color: #eaf0ff;
  text-shadow: 0 0 18px rgba(120, 170, 255, 0.55), 0 0 40px rgba(120, 150, 255, 0.25);
}
.home .tagline { color: var(--muted); opacity: 0.8; letter-spacing: 0.08em; margin-bottom: 8px; }
.home button, .actions button, .level-tile {
  font: inherit; cursor: pointer; border-radius: 10px; color: var(--ink);
  border: 1px solid var(--edge); background: var(--glass);
  -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px);
  padding: 11px 22px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 0 18px rgba(80, 120, 210, 0.18);
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.1s ease;
}
.home button:hover, .actions button:hover, .level-tile:not(.locked):hover {
  border-color: var(--accent); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 0 22px var(--accent-glow);
}
.home button:active, .actions button:active { transform: translateY(1px); }
```

- [ ] **Step 2: Typecheck (CSS has none) + manual verification**

Run: `pnpm dev`.
Expected: the home title glows; both buttons are glassy with a soft glow that intensifies on hover and depress slightly when clicked.

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/styles.css
git commit -m "style(web): glowing home wordmark and glassy buttons"
```

## Task 17: HUD refinement

**Files:**
- Modify: `packages/web/src/styles.css`

- [ ] **Step 1: Restyle the HUD**

Replace:

```css
.hud { display: flex; gap: 24px; align-items: baseline; max-width: 1100px; width: 100%; }
.hud h1 { font-size: 1.3rem; letter-spacing: 0.2em; }
.hud .stat { font-variant-numeric: tabular-nums; opacity: 0.9; }
```

with:

```css
.hud {
  display: flex; gap: 24px; align-items: baseline; max-width: 1100px; width: 100%;
  padding-bottom: 8px; border-bottom: 1px solid rgba(128, 170, 230, 0.18);
}
.hud h1 {
  font-size: 1.3rem; letter-spacing: 0.2em;
  text-shadow: 0 0 14px rgba(120, 170, 255, 0.4);
}
.hud .stat { font-variant-numeric: tabular-nums; color: var(--muted); }
.hud .pips { color: var(--accent); letter-spacing: 0.15em; }
```

- [ ] **Step 2: Manual verification**

Run: `pnpm dev`, open a daily game and a campaign level.
Expected: the HUD has a subtle underline divider, the title glows faintly, stats use the muted color with tabular numbers, and launch pips use the accent color.

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/styles.css
git commit -m "style(web): refine HUD typography and divider"
```

## Task 18: Glass game-over panels + score count-up

**Files:**
- Create: `packages/web/src/CountUp.tsx`
- Modify: `packages/web/src/DailyGame.tsx`
- Modify: `packages/web/src/campaign/CampaignLevel.tsx`
- Modify: `packages/web/src/styles.css`

- [ ] **Step 1: Write the CountUp component**

```tsx
// packages/web/src/CountUp.tsx
import { useEffect, useState } from "react";
import { prefersReducedMotion } from "./space/motion";

/** Animates from 0 to `value` over `durationMs`. Instant under reduced motion. */
export function CountUp({ value, durationMs = 700 }: { value: number; durationMs?: number }) {
  const [n, setN] = useState(() => (prefersReducedMotion() ? value : 0));

  useEffect(() => {
    if (prefersReducedMotion()) {
      setN(value);
      return;
    }
    let raf = 0;
    let startTs: number | null = null;
    const tick = (ts: number) => {
      if (startTs === null) startTs = ts;
      const t = Math.min(1, (ts - startTs) / durationMs);
      const eased = 1 - (1 - t) * (1 - t);
      setN(Math.round(value * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);

  return <>{n}</>;
}
```

- [ ] **Step 2: Use the glass panel + count-up in `DailyGame.tsx`**

In `packages/web/src/DailyGame.tsx`, add the import:

```tsx
import { CountUp } from "./CountUp";
```

Replace the overlay JSX:

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

with:

```tsx
      {over && anim === null && (
        <div className="overlay">
          <div className="panel">
            <div className="total"><CountUp value={score.total} /> pts</div>
            <div className="pips">{score.perProbe.join(" · ")}</div>
            {best !== null && <div className="stat">best today: {best}</div>}
            <div className="stat">come back tomorrow for a new system</div>
          </div>
        </div>
      )}
```

- [ ] **Step 3: Use the glass panel in `CampaignLevel.tsx`**

In `packages/web/src/campaign/CampaignLevel.tsx`, replace the overlay JSX:

```tsx
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
```

with:

```tsx
      {over && (
        <div className="overlay">
          <div className="panel">
            <div className="total">{cleared ? "★".repeat(rating.stars) + "☆".repeat(3 - rating.stars) : "out of launches"}</div>
            <div className="stat">{cleared ? `cleared — score ${rating.levelScore}` : "objective not met"}</div>
            <div className="actions">
              <button onClick={() => onPlay(index)}>Retry</button>
              {cleared && hasNext && <button onClick={() => onPlay(index + 1)}>Next →</button>}
              <button onClick={onExit}>Levels</button>
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 4: Add overlay/panel CSS**

In `packages/web/src/styles.css`, replace:

```css
.overlay {
  position: fixed; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 10px; text-align: center; padding: 24px;
  background: rgba(11, 14, 26, 0.72);
}
.overlay .total { font-size: 2.2rem; font-weight: 700; }
```

with:

```css
.overlay {
  position: fixed; inset: 0;
  display: flex; align-items: center; justify-content: center;
  text-align: center; padding: 24px;
  background: rgba(6, 7, 15, 0.55);
  -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
  animation: overlay-in 0.25s ease both;
}
.overlay .panel {
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  padding: 28px 36px; border-radius: 16px;
  background: var(--glass); border: 1px solid var(--edge);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 12px 40px rgba(0, 0, 0, 0.45), 0 0 30px rgba(80, 120, 210, 0.15);
}
.overlay .total {
  font-size: 2.4rem; font-weight: 800; font-variant-numeric: tabular-nums;
  text-shadow: 0 0 18px rgba(120, 170, 255, 0.4);
}
@keyframes overlay-in { from { opacity: 0; } to { opacity: 1; } }
```

- [ ] **Step 5: Typecheck + manual verification**

Run: `pnpm --filter @apogee/web typecheck`
Expected: no errors.

Run: `pnpm dev`.
Expected: finishing a daily run fades in a blurred glass panel; the total counts up from 0 (instant under reduced motion). Campaign clear/fail shows the same glass panel with the action buttons.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/CountUp.tsx packages/web/src/DailyGame.tsx packages/web/src/campaign/CampaignLevel.tsx packages/web/src/styles.css
git commit -m "feat(web): glass game-over panels with score count-up"
```

## Task 19: Campaign mission-card tiles

**Files:**
- Modify: `packages/web/src/styles.css`

- [ ] **Step 1: Restyle the level grid + tiles**

Replace:

```css
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

with:

```css
.level-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 14px; max-width: 1100px; width: 100%;
}
.level-tile {
  display: flex; flex-direction: column; gap: 4px; align-items: flex-start; min-height: 92px;
}
.level-tile:not(.locked) {
  border-color: var(--accent); box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 0 16px rgba(80, 120, 210, 0.2);
}
.level-tile .num { font-size: 1.5rem; font-weight: 800; }
.level-tile .name { color: var(--muted); font-size: 0.85rem; }
.level-tile .stars { letter-spacing: 0.15em; color: #ffd54f; text-shadow: 0 0 10px rgba(255, 213, 79, 0.4); }
.level-tile.locked { opacity: 0.45; cursor: not-allowed; box-shadow: none; }
```

- [ ] **Step 2: Manual verification**

Run: `pnpm dev`, open Campaign.
Expected: unlocked levels are glassy cards with a soft glow and glowing star rows; locked levels are dimmed with the lock and no glow.

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/styles.css
git commit -m "style(web): glassy campaign mission cards"
```

## Task 20: Screen fade transitions

**Files:**
- Modify: `packages/web/src/App.tsx`
- Modify: `packages/web/src/styles.css`

- [ ] **Step 1: Wrap the screen in a keyed fade container**

In `packages/web/src/App.tsx`, change the final return from:

```tsx
  return (
    <>
      <SpaceBackdrop />
      {screen()}
    </>
  );
}
```

to:

```tsx
  return (
    <>
      <SpaceBackdrop />
      <div className="screen-fade" key={view.name === "level" ? `level-${view.index}-${playCount}` : view.name}>
        {screen()}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Add the fade CSS**

In `packages/web/src/styles.css`, add at the end:

```css
.screen-fade {
  display: contents;
  animation: screen-in 0.3s ease both;
}
@keyframes screen-in { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .screen-fade, .overlay { animation: none; }
}
```

> Note: `display: contents` lets the existing flex layout of `#root` apply to the children unchanged, so the wrapper adds the fade without altering layout. The animation applies to the descendants via the wrapper's animated opacity inheritance; if your browser does not animate `display: contents` containers, change `.screen-fade` to `display: block; width: 100%;` and verify layout still centers.

Because `display: contents` does not itself paint, if the fade does not visibly run, use this alternative that keeps centering:

```css
.screen-fade {
  width: 100%; display: flex; flex-direction: column; align-items: center; gap: 12px;
  animation: screen-in 0.3s ease both;
}
```

Pick whichever renders the fade correctly in `pnpm dev` (verify in Step 3).

- [ ] **Step 3: Typecheck + manual verification**

Run: `pnpm --filter @apogee/web typecheck`
Expected: no errors.

Run: `pnpm dev`.
Expected: navigating home → daily → campaign → level fades the incoming screen in over the persistent sky (the backdrop does not flicker or reset between screens). Under reduced motion, screens switch instantly with no fade. Confirm layout (centering of home, HUD, grid) is unchanged.

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/App.tsx packages/web/src/styles.css
git commit -m "feat(web): cross-fade screens over the shared sky"
```

---

# Phase E — Verification

## Task 21: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the whole test suite + typecheck + build**

Run: `pnpm test`
Expected: all engine and web tests pass (engine golden/determinism tests green — proof the engine is untouched).

Run: `pnpm typecheck`
Expected: no errors in any package.

Run: `pnpm --filter @apogee/web build`
Expected: `tsc --noEmit` clean and Vite build succeeds.

- [ ] **Step 2: Manual matrix**

Run: `pnpm dev`. Verify each cell:

| Scenario | Expected |
|---|---|
| Home (desktop) | Nebula + twinkling stars + occasional shooting star; glowing wordmark; glassy buttons. |
| Daily play | Backdrop shows through board; planets shaded with halos; rings glow; aiming shows dashed preview + dust parallax; probe glows + trails; land/loss bursts; glass game-over panel with count-up. |
| Campaign map | Glassy mission cards, glow on unlocked, locked dimmed. |
| Campaign level | Blockers glow/pulse; keys glint; goal locked→open portal; objectives/stars still register correctly. |
| Mobile viewport (DevTools device toolbar, ~390px) | Board fits; touch drag aims/launches; effects perform smoothly. |
| `prefers-reduced-motion: reduce` | No twinkle/drift/shooting stars/trails/bursts/parallax/count-up/fades; scene is static but still enriched (gradients + glow); gameplay fully works. |
| Hidden tab | Switch away ~10s; backdrop loop pauses (CPU drops) and resumes on return. |

- [ ] **Step 3: Confirm engine cleanliness**

Run: `git status --short`
Expected: no changes under `packages/engine/`. If any appear, revert them — the engine must remain untouched.

- [ ] **Step 4: Final commit (if any verification fixes were needed)**

```bash
git add -A packages/web
git commit -m "chore(web): deep space polish verification fixes"
```

(If no fixes were needed, skip this commit.)

---

## Self-review notes (author)

- **Spec coverage:** backdrop/nebula/starfield/shooting-stars (Tasks 4,5,8,9); planet types + glow (6,12); blockers (12); rings/goal/keys/targets (13); probes/trails/bursts (2,3,14,15); parallax dust (11); continuous loop + reduced-motion + visibility (1,9,10); chrome home/HUD/overlay/map/transitions (16–20); performance (offscreen nebula in 8, caps in 4/2, pause-on-hidden in 9/10); accessibility reduced-motion across 9,10,18,20. Files match Section 8 of the spec.
- **Engine untouched:** every task is under `packages/web`; Task 21 Step 3 asserts it.
- **Type consistency:** `BoardDrawOpts` fields (`probeFrames`,`previewPath`,`drag`,`trail`,`bursts`,`time`,`animate`) match the extended `RenderView`/`CampaignRenderView`; `Burst` is defined once in `effects.ts` and imported by `render.ts` and `useBoardCanvas.ts`; `planetTypeFor`/`PLANET_PALETTES` names consistent across Task 6 and 12.
- **Parked (out of scope, per spec):** Phase 2 share-image re-compositing, sound, themeable palettes, pickup bursts for keys/targets/goal (only probe land/loss bursts implemented).
