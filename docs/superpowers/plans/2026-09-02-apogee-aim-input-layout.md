# Apogee Aim Input & Board Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A stray tap never wastes a launch, max power is reachable on every device, and a 390×844 phone shows the whole board with the HUD on one line.

**Architecture:** Web-only, no engine change. Two new pure modules under `packages/web/src/space/`: `aim.ts` (relative pull from the press point, 10-unit minimum to fire, 200-unit drawn cap) and `orientation.ts` (portrait turns the 1600×1000 world 90° counter-clockwise via a canvas transform plus an inverse pointer map). The shared `useBoardCanvas` hook consumes both, so the Daily board gets the same gestures for free. Renderers keep drawing in world units; the rubber band is drawn from the press point and a direction tick at the pad. CSS makes `.hud` a single non-wrapping row with an icon-only back button. Spec: `docs/superpowers/specs/2026-09-01-apogee-aim-input-layout-design.md`.

**Tech Stack:** TypeScript 5, Vitest 3, React 19, Vite 7, pnpm workspaces. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-01-apogee-aim-input-layout-design.md`

## Global Constraints

- Work on the existing `feat/fun-debt` branch in the main working tree (sprints stack there until sprint 4 ships `main`). The two untracked `packages/engine/tests/_*.test.ts` scratch files break `pnpm typecheck`; expect `tsc` errors **only** from those two files and never touch them.
- **No engine file changes.** `packages/engine/**` is untouched; `git log --oneline 89fd6bd..HEAD -- packages/engine` must stay empty. Engine tests, goldens, and recorded solutions are unaffected.
- `LaunchInput` semantics are unchanged: `dx`/`dy` remain the pull in world units, launch always originates at the pad.
- Constants from the spec, verbatim: `MIN_PULL = 10` (world units; a shorter release cancels), `MAX_PULL = MAX_SPEED / POWER_SCALE` (= 200, drawing cap only). No pull gain: screen distance maps 1:1 to engine drag units.
- Portrait mapping, verbatim: `canvas = (y, WORLD_WIDTH − x)`; inverse `world = (WORLD_WIDTH − cy, cx)`; canvas transform `ctx.setTransform(0, −1, 1, 0, 0, WORLD_WIDTH)`. Portrait iff viewport height > width.
- The engine launches along `+(dx, dy)` (velocity = normalized drag × speed), so the pull `origin − pointer` points from the pointer toward the press point: pull back, shoot forward.
- No text drawn on the canvas (captions stay DOM so the portrait rotation is a pure transform). The cosmos backdrop is a separate viewport-sized canvas and never rotates.
- Run tests from the repo root with `pnpm --filter @apogee/web exec vitest run <name>`; the full gate is `pnpm test && pnpm typecheck`.
- End every commit message with the line `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

## File structure

| File | Responsibility | Change |
|---|---|---|
| `packages/web/src/space/aim.ts` | pure pull model: `MIN_PULL`, `MAX_PULL`, `AimDrag`, `pullVector`, `pullLength`, `shouldFire`, `clampPull` | new |
| `packages/web/src/space/orientation.ts` | pure orientation: `pickOrientation`, `canvasSize`, `worldToCanvas`, `canvasToWorld`, `canvasTransform` | new |
| `packages/web/src/space/useBoardCanvas.ts` | board input + playback loop (shared by Daily and Campaign) | relative pull, min-pull cancel, orientation-aware pointer map + canvas transform, resize handling; drops `worldWidth`/`worldHeight` opts |
| `packages/web/src/render.ts` | canvas drawing | `drag` becomes `AimDrag`; one `drawAim` helper (band from the press point + direction tick at the pad) replaces the duplicated band code |
| `packages/web/src/GameCanvas.tsx`, `packages/web/src/campaign/CampaignCanvas.tsx` | board adapters | drop `worldWidth`/`worldHeight` and the JSX `width`/`height` attributes (the hook owns canvas size now) |
| `packages/web/src/styles.css` | layout | `.hud` single row, `.back` icon button, narrow-phone media query |
| `packages/web/src/campaign/CampaignLevel.tsx`, `packages/web/src/DailyGame.tsx`, `packages/web/src/campaign/CampaignMap.tsx` | screens | icon-only back button with `aria-label` |
| `packages/web/tests/space/aim.test.ts`, `packages/web/tests/space/orientation.test.ts` | web unit tests | new |

---

### Task 1: Pure pull model (`aim.ts`)

**Files:**
- Create: `packages/web/src/space/aim.ts`
- Test: `packages/web/tests/space/aim.test.ts`

**Interfaces:**
- Consumes: `MAX_SPEED`, `POWER_SCALE`, `type Vec2` from `@apogee/engine`.
- Produces (Tasks 2 and 4 rely on these exact names):
  - `MIN_PULL: 10`, `MAX_PULL: 200`
  - `interface Pull { dx: number; dy: number }`
  - `interface AimDrag extends Pull { origin: Vec2 }` — a drag in progress: press point (world units) + pull so far
  - `pullVector(origin: Vec2, pointer: Vec2): Pull` — `origin − pointer`
  - `pullLength(p: Pull): number`
  - `shouldFire(p: Pull): boolean` — `pullLength(p) >= MIN_PULL`
  - `clampPull(p: Pull): Pull` — same direction, length capped at `MAX_PULL`; returns `p` itself when already within the cap

- [ ] **Step 1: Write the failing tests**

Create `packages/web/tests/space/aim.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MAX_SPEED, POWER_SCALE } from "@apogee/engine";
import {
  MAX_PULL,
  MIN_PULL,
  clampPull,
  pullLength,
  pullVector,
  shouldFire,
} from "../../src/space/aim";

describe("pullVector", () => {
  it("is origin minus pointer: pull back to shoot forward", () => {
    expect(pullVector({ x: 100, y: 200 }, { x: 40, y: 230 })).toEqual({ dx: 60, dy: -30 });
  });
  it("is zero when the pointer has not moved", () => {
    expect(pullVector({ x: 5, y: 5 }, { x: 5, y: 5 })).toEqual({ dx: 0, dy: 0 });
  });
});

describe("pullLength", () => {
  it("is the Euclidean length", () => {
    expect(pullLength({ dx: 3, dy: 4 })).toBe(5);
    expect(pullLength({ dx: 0, dy: 0 })).toBe(0);
  });
});

describe("shouldFire", () => {
  it("never fires a zero pull", () => {
    expect(shouldFire({ dx: 0, dy: 0 })).toBe(false);
  });
  it("is false just under MIN_PULL", () => {
    expect(MIN_PULL).toBe(10);
    expect(shouldFire({ dx: 9.99, dy: 0 })).toBe(false);
    expect(shouldFire({ dx: 6, dy: 7.9 })).toBe(false); // length ≈ 9.92
  });
  it("is true at exactly MIN_PULL and beyond", () => {
    expect(shouldFire({ dx: 10, dy: 0 })).toBe(true);
    expect(shouldFire({ dx: 6, dy: 8 })).toBe(true); // length 10
    expect(shouldFire({ dx: -150, dy: 20 })).toBe(true);
  });
});

describe("clampPull", () => {
  it("caps at MAX_PULL, the engine's speed cap in drag units", () => {
    expect(MAX_PULL).toBe(MAX_SPEED / POWER_SCALE);
    expect(MAX_PULL).toBe(200);
  });
  it("leaves a pull within the cap unchanged", () => {
    expect(clampPull({ dx: 3, dy: 4 })).toEqual({ dx: 3, dy: 4 });
    expect(clampPull({ dx: 120, dy: -160 })).toEqual({ dx: 120, dy: -160 }); // length 200
  });
  it("preserves direction and caps the length", () => {
    const c = clampPull({ dx: 300, dy: -400 }); // length 500
    expect(pullLength(c)).toBeCloseTo(200, 9);
    expect(c.dx / c.dy).toBeCloseTo(300 / -400, 9);
    expect(c.dx).toBeGreaterThan(0);
    expect(c.dy).toBeLessThan(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @apogee/web exec vitest run aim`

Expected: FAIL — cannot resolve `../../src/space/aim`.

- [ ] **Step 3: Implement the module**

Create `packages/web/src/space/aim.ts`:

```ts
import { MAX_SPEED, POWER_SCALE, type Vec2 } from "@apogee/engine";

/** World units of pull below which a release cancels instead of launching. */
export const MIN_PULL = 10;
/** Longest pull worth drawing: the engine's speed cap, in drag units. */
export const MAX_PULL = MAX_SPEED / POWER_SCALE;

export interface Pull {
  dx: number;
  dy: number;
}

/** A drag in progress: where the board was pressed (world units) and the pull so far. */
export interface AimDrag extends Pull {
  origin: Vec2;
}

/**
 * Pull from the press point toward the current pointer, both in world units.
 * `origin − pointer`: pulling back (away from the target) points the pull at
 * the target, the slingshot way. The engine launches along +(dx, dy).
 */
export function pullVector(origin: Vec2, pointer: Vec2): Pull {
  return { dx: origin.x - pointer.x, dy: origin.y - pointer.y };
}

export function pullLength(p: Pull): number {
  return Math.sqrt(p.dx * p.dx + p.dy * p.dy);
}

/** A release launches only when the pull is at least MIN_PULL long. */
export function shouldFire(p: Pull): boolean {
  return pullLength(p) >= MIN_PULL;
}

/** Same direction, length capped at MAX_PULL — for drawing only; the engine clamps speed itself. */
export function clampPull(p: Pull): Pull {
  const len = pullLength(p);
  if (len <= MAX_PULL) return p;
  const k = MAX_PULL / len;
  return { dx: p.dx * k, dy: p.dy * k };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @apogee/web exec vitest run aim`

Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/space/aim.ts packages/web/tests/space/aim.test.ts
git commit -m "feat(web): pure pull model — relative origin, 10-unit minimum, 200-unit drawn cap

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Relative pull in the hook and renderers

**Files:**
- Modify: `packages/web/src/space/useBoardCanvas.ts`
- Modify: `packages/web/src/render.ts`

**Interfaces:**
- Consumes: `AimDrag`, `pullVector`, `shouldFire`, `clampPull`, `pullLength` from Task 1.
- Produces: `BoardDrawOpts.drag: AimDrag | null`; `RenderView.drag: AimDrag | null`; `CampaignRenderView.drag: AimDrag | null`. The adapters (`GameCanvas.tsx`, `CampaignCanvas.tsx`) already pass `drag: o.drag` straight through, so they need no edit here — types flow. `drawDust` keeps its `{ dx; dy } | null` parameter; an `AimDrag` is assignable to it.

- [ ] **Step 1: Change the hook's drag state to a relative pull**

In `packages/web/src/space/useBoardCanvas.ts`:

Add the import after the `react` import:

```ts
import { type AimDrag, pullVector, shouldFire } from "./aim";
```

In `BoardDrawOpts`, replace the `drag` line:

```ts
  /** The aim gesture in world units (press point + pull so far), or null when not aiming. */
  drag: AimDrag | null;
```

Replace the `dragRef` declaration:

```ts
  const dragRef = useRef<AimDrag | null>(null);
```

Replace `computePreview` (the preview only shows a pull that would actually fire; the engine gets the raw pull and clamps speed itself):

```ts
    const computePreview = (): { x: number; y: number }[] | null => {
      const drag = dragRef.current;
      if (!drag || !shouldFire(drag)) return null;
      const adapter = adapterRef.current;
      const trace = adapter.previewTrace({ dx: drag.dx, dy: drag.dy }, PREVIEW_STEPS, tickRef.current);
      return trace
        .map((f) => f[adapter.probeIndex])
        .filter((f): f is ProbeFrame => f !== undefined && f.state === "flying")
        .map((f) => ({ x: f.x, y: f.y }));
    };
```

Replace `onDown`, `onMove`, and `onUp`:

```ts
    const onDown = (e: PointerEvent) => {
      // `disabled` (from the parent) lags one render behind anim start, so also
      // gate on animRef to never begin a drag mid-animation.
      if (cbRef.current.disabled || animRef.current) return;
      canvas.setPointerCapture(e.pointerId);
      // Press anywhere on the board: the pull is measured from here, the launch
      // still leaves the pad. A far-off tap therefore starts at zero, not at max.
      dragRef.current = { origin: toWorld(canvas, e, opts.worldWidth, opts.worldHeight), dx: 0, dy: 0 };
      kick();
    };
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const pointer = toWorld(canvas, e, opts.worldWidth, opts.worldHeight);
      dragRef.current = { origin: drag.origin, ...pullVector(drag.origin, pointer) };
      kick();
    };
    const onUp = () => {
      const drag = dragRef.current;
      dragRef.current = null;
      kick();
      // Under MIN_PULL the release is a cancel: no launch consumed, no burst.
      if (drag && shouldFire(drag)) {
        lastLaunchTickRef.current = tickRef.current;
        cbRef.current.onLaunch({ dx: drag.dx, dy: drag.dy, launchTick: tickRef.current });
      }
    };
```

`onCancel`, the loop, and everything else stay as they are.

- [ ] **Step 2: Draw the band from the press point and a direction tick at the pad**

In `packages/web/src/render.ts`:

Add the import after the `./space/effects` imports:

```ts
import { type AimDrag, clampPull, pullLength, shouldFire } from "./space/aim";
```

After `const RING_COLORS = COLORS.ringPoints;` add:

```ts
/** Radius of the launch-pad ring. */
const PAD_RADIUS = 14;
/** Length of the launch-direction tick drawn out from the pad ring while aiming. */
const AIM_TICK = 18;

/**
 * The aim gesture. The rubber band runs from the press point to the pointer
 * (capped at MAX_PULL, so it shows what the engine will do), so the finger
 * sees its own gesture wherever it pressed. The tick at the pad shows the
 * launch direction and appears only once the pull is long enough to fire.
 * The dashed preview path is drawn separately: it is the engine's trace.
 */
function drawAim(
  ctx: CanvasRenderingContext2D,
  pad: { x: number; y: number },
  drag: AimDrag | null,
): void {
  if (!drag) return;
  const len = pullLength(drag);
  if (len === 0) return;
  const band = clampPull(drag);
  ctx.strokeStyle = COLORS.pad;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(drag.origin.x, drag.origin.y);
  ctx.lineTo(drag.origin.x - band.dx, drag.origin.y - band.dy);
  ctx.stroke();
  if (!shouldFire(drag)) return;
  const ux = drag.dx / len;
  const uy = drag.dy / len;
  ctx.beginPath();
  ctx.moveTo(pad.x + ux * PAD_RADIUS, pad.y + uy * PAD_RADIUS);
  ctx.lineTo(pad.x + ux * (PAD_RADIUS + AIM_TICK), pad.y + uy * (PAD_RADIUS + AIM_TICK));
  ctx.stroke();
}
```

In `RenderView` replace the `drag` line:

```ts
  /** The aim gesture (press point + pull) while aiming, or null. */
  drag: AimDrag | null;
```

In `CampaignRenderView` replace the `drag` line the same way:

```ts
  drag: AimDrag | null;
```

In `drawFrame`, replace the launch-pad + aiming block (from `// Launch pad` through the closing `}` of `if (view.drag) { ... }`) with:

```ts
  // Launch pad
  const lp = game.system.launchPos;
  ctx.strokeStyle = COLORS.pad;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(lp.x, lp.y, PAD_RADIUS, 0, Math.PI * 2);
  ctx.stroke();

  // Aiming: preview path + gesture
  if (view.previewPath && view.previewPath.length > 1) {
    strokePreviewPath(ctx, view.previewPath);
  }
  drawAim(ctx, lp, view.drag);
```

In `drawCampaignFrame`, replace the launch-pad + aiming block (from `// Launch pad.` through the closing `}` of `if (view.drag) { ... }`) with:

```ts
  // Launch pad.
  const lp = level.launchPos;
  ctx.strokeStyle = COLORS.pad;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(lp.x, lp.y, PAD_RADIUS, 0, Math.PI * 2);
  ctx.stroke();

  // Aiming preview + gesture.
  if (view.previewPath && view.previewPath.length > 1) {
    strokePreviewPath(ctx, view.previewPath);
  }
  drawAim(ctx, lp, view.drag);
```

- [ ] **Step 3: Typecheck and run the web suite**

Run: `pnpm --filter @apogee/web typecheck && pnpm --filter @apogee/web test`

Expected: PASS. (No hook test exists — the hook is DOM-bound, as today.)

- [ ] **Step 4: Check it by eye**

`pnpm dev` → Campaign → level 1. Expected:
- A click on the board without moving does nothing (pips unchanged, no burst).
- A press far from the pad followed by a 3 px wobble does nothing on release.
- Pressing anywhere and pulling draws the band from where you pressed; the dashed preview and the tick both start at the pad; the launch leaves the pad in the tick's direction.
- Pulling well past 200 units: the band stops growing, the launch is at cap speed.
- Daily Challenge: same gestures.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/space/useBoardCanvas.ts packages/web/src/render.ts
git commit -m "feat(web): relative pull from the press point; sub-10-unit releases cancel

The pull is origin − pointer instead of pad − pointer, so a far-off tap starts at zero power rather than max, and max power is reachable from anywhere with room to pull. The band is drawn from the press point; a tick at the pad shows the launch direction.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Pure orientation module (`orientation.ts`)

**Files:**
- Create: `packages/web/src/space/orientation.ts`
- Test: `packages/web/tests/space/orientation.test.ts`

**Interfaces:**
- Consumes: `WORLD_WIDTH`, `WORLD_HEIGHT`, `type Vec2` from `@apogee/engine`.
- Produces (Task 4 relies on these exact names):
  - `type Orientation = "landscape" | "portrait"`
  - `pickOrientation(viewportW: number, viewportH: number): Orientation` — portrait iff `viewportH > viewportW`
  - `canvasSize(o: Orientation): { width: number; height: number }` — 1600×1000 or 1000×1600
  - `worldToCanvas(o: Orientation, p: Vec2): Vec2` — portrait: `(y, WORLD_WIDTH − x)`
  - `canvasToWorld(o: Orientation, p: Vec2): Vec2` — portrait: `(WORLD_WIDTH − cy, cx)`
  - `canvasTransform(o: Orientation): [number, number, number, number, number, number]` — `worldToCanvas` as the `(a, b, c, d, e, f)` arguments of `ctx.setTransform`

- [ ] **Step 1: Write the failing tests**

Create `packages/web/tests/space/orientation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { WORLD_HEIGHT, WORLD_WIDTH } from "@apogee/engine";
import {
  canvasSize,
  canvasToWorld,
  canvasTransform,
  pickOrientation,
  worldToCanvas,
  type Orientation,
} from "../../src/space/orientation";

const ORIENTATIONS: Orientation[] = ["landscape", "portrait"];
const POINTS = [
  { x: 0, y: 0 },
  { x: 80, y: 500 },
  { x: 1600, y: 1000 },
  { x: 1234.5, y: 67.25 },
];

describe("pickOrientation", () => {
  it("is portrait only when the viewport is taller than it is wide", () => {
    expect(pickOrientation(390, 844)).toBe("portrait");
    expect(pickOrientation(844, 390)).toBe("landscape");
    expect(pickOrientation(800, 800)).toBe("landscape");
  });
});

describe("canvasSize", () => {
  it("is the world in landscape and the world on its side in portrait", () => {
    expect(WORLD_WIDTH).toBe(1600);
    expect(WORLD_HEIGHT).toBe(1000);
    expect(canvasSize("landscape")).toEqual({ width: 1600, height: 1000 });
    expect(canvasSize("portrait")).toEqual({ width: 1000, height: 1600 });
  });
});

describe("worldToCanvas / canvasToWorld", () => {
  it("is the identity in landscape", () => {
    for (const p of POINTS) {
      expect(worldToCanvas("landscape", p)).toEqual(p);
      expect(canvasToWorld("landscape", p)).toEqual(p);
    }
  });
  it("puts the pad (80, 500) bottom-center in portrait", () => {
    expect(worldToCanvas("portrait", { x: 80, y: 500 })).toEqual({ x: 500, y: 1520 });
  });
  it("maps world +x (toward the goals) to canvas −y (up) in portrait", () => {
    const a = worldToCanvas("portrait", { x: 100, y: 500 });
    const b = worldToCanvas("portrait", { x: 200, y: 500 });
    expect(b.x).toBe(a.x);
    expect(b.y).toBeLessThan(a.y);
  });
  it("maps the world's top edge to the canvas's left edge in portrait", () => {
    expect(worldToCanvas("portrait", { x: 700, y: 0 }).x).toBe(0);
    expect(worldToCanvas("portrait", { x: 700, y: WORLD_HEIGHT }).x).toBe(WORLD_HEIGHT);
  });
  it("keeps every world corner inside the portrait canvas", () => {
    const { width, height } = canvasSize("portrait");
    for (const p of [{ x: 0, y: 0 }, { x: 1600, y: 0 }, { x: 0, y: 1000 }, { x: 1600, y: 1000 }]) {
      const c = worldToCanvas("portrait", p);
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x).toBeLessThanOrEqual(width);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeLessThanOrEqual(height);
    }
  });
  it("round-trips in both orientations", () => {
    for (const o of ORIENTATIONS) {
      for (const p of POINTS) {
        expect(canvasToWorld(o, worldToCanvas(o, p))).toEqual(p);
        expect(worldToCanvas(o, canvasToWorld(o, p))).toEqual(p);
      }
    }
  });
});

describe("canvasTransform", () => {
  it("is worldToCanvas as a setTransform(a, b, c, d, e, f) matrix", () => {
    for (const o of ORIENTATIONS) {
      const [a, b, c, d, e, f] = canvasTransform(o);
      for (const p of POINTS) {
        expect({ x: a * p.x + c * p.y + e, y: b * p.x + d * p.y + f }).toEqual(worldToCanvas(o, p));
      }
    }
  });
  it("is the spec's matrix in portrait", () => {
    expect(canvasTransform("portrait")).toEqual([0, -1, 1, 0, 0, WORLD_WIDTH]);
    expect(canvasTransform("landscape")).toEqual([1, 0, 0, 1, 0, 0]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @apogee/web exec vitest run orientation`

Expected: FAIL — cannot resolve `../../src/space/orientation`.

- [ ] **Step 3: Implement the module**

Create `packages/web/src/space/orientation.ts`:

```ts
import { WORLD_HEIGHT, WORLD_WIDTH, type Vec2 } from "@apogee/engine";

export type Orientation = "landscape" | "portrait";

/** Portrait whenever the viewport is taller than it is wide. */
export function pickOrientation(viewportW: number, viewportH: number): Orientation {
  return viewportH > viewportW ? "portrait" : "landscape";
}

/** Canvas pixel size: the world as-is, or turned on its side. */
export function canvasSize(o: Orientation): { width: number; height: number } {
  return o === "portrait"
    ? { width: WORLD_HEIGHT, height: WORLD_WIDTH }
    : { width: WORLD_WIDTH, height: WORLD_HEIGHT };
}

/**
 * World → canvas. Portrait turns the board 90° counter-clockwise: world +x
 * (toward the goals) becomes canvas −y (up), the world's top edge becomes the
 * canvas's left edge, and the pad lands bottom-center. The engine and the
 * renderers never see this; they stay in world units.
 */
export function worldToCanvas(o: Orientation, p: Vec2): Vec2 {
  return o === "portrait" ? { x: p.y, y: WORLD_WIDTH - p.x } : { x: p.x, y: p.y };
}

/** Canvas → world: the inverse of `worldToCanvas`, for pointer input. */
export function canvasToWorld(o: Orientation, p: Vec2): Vec2 {
  return o === "portrait" ? { x: WORLD_WIDTH - p.y, y: p.x } : { x: p.x, y: p.y };
}

/** `worldToCanvas` as the `(a, b, c, d, e, f)` arguments of `ctx.setTransform`. */
export function canvasTransform(o: Orientation): [number, number, number, number, number, number] {
  return o === "portrait" ? [0, -1, 1, 0, 0, WORLD_WIDTH] : [1, 0, 0, 1, 0, 0];
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @apogee/web exec vitest run orientation`

Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/space/orientation.ts packages/web/tests/space/orientation.test.ts
git commit -m "feat(web): pure board orientation — portrait turns the world 90° CCW

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Rotate the board on portrait viewports (hook + adapters)

**Files:**
- Modify: `packages/web/src/space/useBoardCanvas.ts`
- Modify: `packages/web/src/GameCanvas.tsx`
- Modify: `packages/web/src/campaign/CampaignCanvas.tsx`

**Interfaces:**
- Consumes: `Orientation`, `pickOrientation`, `canvasSize`, `canvasToWorld`, `canvasTransform` from Task 3; `AimDrag`, `pullVector`, `shouldFire` from Task 1.
- Produces: `UseBoardCanvas` **loses** `worldWidth` and `worldHeight` (the orientation module owns the world size). The hook owns the canvas element's `width`/`height` attributes and inline `aspect-ratio`; adapters render a bare `<canvas ref={canvasRef} />`.

- [ ] **Step 1: Rewrite the hook with orientation handling**

Replace the whole of `packages/web/src/space/useBoardCanvas.ts` with:

```ts
import { type LaunchInput, type ProbeFrame, type Vec2, PREVIEW_STEPS } from "@apogee/engine";
import { useEffect, useRef } from "react";
import { type AimDrag, pullVector, shouldFire } from "./aim";
import { type Burst, pruneBursts } from "./effects";
import { prefersReducedMotion, shouldAnimate, watchReducedMotion } from "./motion";
import {
  type Orientation,
  canvasSize,
  canvasToWorld,
  canvasTransform,
  pickOrientation,
} from "./orientation";
import { clearTrail, createTrail, pushTrail } from "./trail";

export interface BoardDrawOpts {
  probeFrames: ProbeFrame[] | null;
  previewPath: { x: number; y: number }[] | null;
  /** The aim gesture in world units (press point + pull so far), or null when not aiming. */
  drag: AimDrag | null;
  trail: { x: number; y: number }[] | null;
  bursts: Burst[];
  time: number;
  animate: boolean;
  /** Board-clock tick for this frame (drives moving-body rendering). */
  boardTick: number;
}

/** Per-board adapter: where the launch pad is, how to preview, and how to draw. */
export interface BoardAdapter {
  launchPos: { x: number; y: number };
  /** Index of the just-launched probe in preview/anim frame arrays. */
  probeIndex: number;
  /** Live-sim a preview trace for the given drag at the current board tick. */
  previewTrace: (drag: LaunchInput, steps: number, tick: number) => ProbeFrame[][];
  /** Draw one frame. */
  draw: (ctx: CanvasRenderingContext2D, opts: BoardDrawOpts) => void;
}

export interface UseBoardCanvas {
  disabled: boolean;
  anim: ProbeFrame[][] | null;
  onLaunch: (input: LaunchInput) => void;
  onAnimDone: () => void;
  adapter: BoardAdapter;
  /** Frame index at which the level was cleared; the clear burst fires once when playback reaches or passes that frame. */
  clearAt: number | null;
}

/** Pointer → canvas pixels (undoing CSS scaling) → world units (undoing the portrait turn). */
function toWorld(canvas: HTMLCanvasElement, e: PointerEvent, o: Orientation): Vec2 {
  const rect = canvas.getBoundingClientRect();
  const { width, height } = canvasSize(o);
  return canvasToWorld(o, {
    x: ((e.clientX - rect.left) * width) / rect.width,
    y: ((e.clientY - rect.top) * height) / rect.height,
  });
}

/**
 * Shared board behaviour for the Daily and Campaign canvases: aiming input,
 * playback of a launch trace, trails, bursts, and the board clock. The hook
 * owns the canvas element's pixel size: on portrait viewports the 1600×1000
 * world is drawn turned 90° counter-clockwise (see orientation.ts); the
 * renderers and the engine never know.
 */
export function useBoardCanvas(opts: UseBoardCanvas) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<AimDrag | null>(null);
  const trailRef = useRef(createTrail());
  const burstsRef = useRef<Burst[]>([]);
  const frameIdxRef = useRef(0);
  const prevStateRef = useRef<ProbeFrame["state"]>("flying");
  const clearFiredRef = useRef(false);
  // Board clock: free-runs while aiming; during anim, tick = animStart + frameIdx.
  const tickRef = useRef(0);
  const lastLaunchTickRef = useRef(0);
  const animStartTickRef = useRef(0);

  // Refs kept fresh every render so the persistent loop reads current values.
  const animRef = useRef(opts.anim);
  const clearAtRef = useRef(opts.clearAt);
  clearAtRef.current = opts.clearAt;
  const adapterRef = useRef(opts.adapter);
  const cbRef = useRef({ onLaunch: opts.onLaunch, onAnimDone: opts.onAnimDone, disabled: opts.disabled });
  adapterRef.current = opts.adapter;
  cbRef.current = { onLaunch: opts.onLaunch, onAnimDone: opts.onAnimDone, disabled: opts.disabled };

  // Detect a newly-started animation (reset playback + trail + transition tracking).
  if (opts.anim !== animRef.current) {
    animRef.current = opts.anim;
    frameIdxRef.current = 0;
    animStartTickRef.current = lastLaunchTickRef.current;
    prevStateRef.current = "flying";
    clearFiredRef.current = false;
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
    let reduce = prefersReducedMotion();
    let raf = 0;
    let orientation: Orientation = "landscape";

    const computePreview = (): { x: number; y: number }[] | null => {
      const drag = dragRef.current;
      if (!drag || !shouldFire(drag)) return null;
      const adapter = adapterRef.current;
      const trace = adapter.previewTrace({ dx: drag.dx, dy: drag.dy }, PREVIEW_STEPS, tickRef.current);
      return trace
        .map((f) => f[adapter.probeIndex])
        .filter((f): f is ProbeFrame => f !== undefined && f.state === "flying")
        .map((f) => ({ x: f.x, y: f.y }));
    };

    const render = (time: number) => {
      const adapter = adapterRef.current;
      const anim = animRef.current;
      const motion = shouldAnimate(reduce, document.hidden);
      const t = motion ? time : 0;
      burstsRef.current = pruneBursts(burstsRef.current, time);
      // Renderers draw in world units; in portrait this matrix turns the board
      // on its side. Everything stored (playback, trail, bursts, drag) is world
      // space, so an orientation change mid-flight only changes the next frame.
      ctx.setTransform(...canvasTransform(orientation));
      if (anim) {
        const boardTick = animStartTickRef.current + frameIdxRef.current;
        const i = Math.min(frameIdxRef.current, anim.length - 1);
        const probeFrames = anim[i] ?? null;
        const pf = probeFrames?.[adapter.probeIndex];
        if (pf) {
          if (motion && pf.state === "flying") pushTrail(trailRef.current, pf.x, pf.y);
          if (pf.state !== prevStateRef.current && pf.state !== "flying") {
            if (motion) {
              burstsRef.current.push({
                x: pf.x,
                y: pf.y,
                start: time,
                kind: pf.state === "landed" ? "land" : "lost",
              });
            }
            prevStateRef.current = pf.state;
          }
          const clearAt = clearAtRef.current;
          if (motion && clearAt !== null && !clearFiredRef.current && frameIdxRef.current >= clearAt) {
            clearFiredRef.current = true;
            const at = anim[clearAt]?.[adapter.probeIndex] ?? pf;
            burstsRef.current.push({ x: at.x, y: at.y, start: time, kind: "clear" });
          }
        }
        adapter.draw(ctx, {
          probeFrames,
          previewPath: null,
          drag: null,
          trail: motion ? trailRef.current.points.slice() : null,
          bursts: burstsRef.current,
          time: t,
          animate: motion,
          boardTick,
        });
        frameIdxRef.current++;
        if (frameIdxRef.current >= anim.length) {
          tickRef.current = animStartTickRef.current + anim.length;
          animRef.current = null;
          clearTrail(trailRef.current);
          cbRef.current.onAnimDone();
        }
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
    };

    const wantLoop = () =>
      !document.hidden &&
      (animRef.current !== null ||
        dragRef.current !== null ||
        burstsRef.current.length > 0 ||
        !reduce);

    const loop = (time: number) => {
      render(time);
      raf = wantLoop() ? requestAnimationFrame(loop) : 0;
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(loop);
    };
    kickRef.current = kick;

    // Re-read the orientation on resize (and once up front). Setting width or
    // height wipes the canvas and its context state, so only touch them on a
    // real change, then redraw; the transform is re-applied every frame anyway.
    const applyOrientation = () => {
      orientation = pickOrientation(window.innerWidth, window.innerHeight);
      const { width, height } = canvasSize(orientation);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        canvas.style.aspectRatio = `${width} / ${height}`;
        kick();
      }
    };

    // Respect live OS reduce-motion changes. On re-enabling motion, resume the
    // ambient loop; on disabling, the loop stops itself next frame via wantLoop().
    const unwatch = watchReducedMotion((r) => {
      reduce = r;
      if (!r) kick();
    });

    const onDown = (e: PointerEvent) => {
      // `disabled` (from the parent) lags one render behind anim start, so also
      // gate on animRef to never begin a drag mid-animation.
      if (cbRef.current.disabled || animRef.current) return;
      canvas.setPointerCapture(e.pointerId);
      // Press anywhere on the board: the pull is measured from here, the launch
      // still leaves the pad. A far-off tap therefore starts at zero, not at max.
      dragRef.current = { origin: toWorld(canvas, e, orientation), dx: 0, dy: 0 };
      kick();
    };
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const pointer = toWorld(canvas, e, orientation);
      dragRef.current = { origin: drag.origin, ...pullVector(drag.origin, pointer) };
      kick();
    };
    const onUp = () => {
      const drag = dragRef.current;
      dragRef.current = null;
      kick();
      // Under MIN_PULL the release is a cancel: no launch consumed, no burst.
      if (drag && shouldFire(drag)) {
        lastLaunchTickRef.current = tickRef.current;
        cbRef.current.onLaunch({ dx: drag.dx, dy: drag.dy, launchTick: tickRef.current });
      }
    };
    const onCancel = () => {
      dragRef.current = null;
      kick();
    };

    const onVisibility = () => {
      if (!document.hidden) kick();
    };
    applyOrientation();
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onCancel);
    window.addEventListener("resize", applyOrientation);
    document.addEventListener("visibilitychange", onVisibility);
    kick();

    return () => {
      kickRef.current = () => {};
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("resize", applyOrientation);
      document.removeEventListener("visibilitychange", onVisibility);
      unwatch();
    };
  }, []);

  return canvasRef;
}
```

- [ ] **Step 2: Let the hook own the canvas size in both adapters**

`packages/web/src/GameCanvas.tsx` — remove `WORLD_HEIGHT` and `WORLD_WIDTH` from the `@apogee/engine` import, remove the `worldWidth`/`worldHeight` lines from the `useBoardCanvas({ ... })` call, and change the returned element to:

```tsx
  return <canvas ref={canvasRef} />;
```

The resulting file:

```tsx
import {
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
    clearAt: null,
    onLaunch,
    onAnimDone,
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

  return <canvas ref={canvasRef} />;
}
```

`packages/web/src/campaign/CampaignCanvas.tsx` — the same three edits. The resulting file:

```tsx
import {
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
  clearAt: number | null;
  onLaunch: (input: LaunchInput) => void;
  onAnimDone: () => void;
}

export function CampaignCanvas({ state, disabled, anim, clearAt, onLaunch, onAnimDone }: Props) {
  const canvasRef = useBoardCanvas({
    disabled,
    anim,
    clearAt,
    onLaunch,
    onAnimDone,
    adapter: {
      launchPos: state.level.launchPos,
      probeIndex: state.probes.length,
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
    },
  });

  return <canvas ref={canvasRef} />;
}
```

No CSS change is needed for the canvas: the stylesheet's `canvas { max-width: min(1100px, 100%); max-height: calc(100dvh - 5.5rem); aspect-ratio: 16 / 10 }` still governs landscape, and the hook's inline `aspect-ratio: 1000 / 1600` overrides it in portrait so the board fills the width under the HUD.

- [ ] **Step 3: Typecheck and run the web suite**

Run: `pnpm --filter @apogee/web typecheck && pnpm --filter @apogee/web test`

Expected: PASS. If `tsc` complains about `ctx.setTransform(...canvasTransform(orientation))`, the tuple return type on `canvasTransform` (Task 3) is missing — fix it there, do not cast here.

- [ ] **Step 4: Check it by eye at phone sizes**

`pnpm dev`, then in the browser's device toolbar (or the Playwright MCP with `browser_resize`):

- 390×844 (portrait): Campaign → level 1. Expected: the board is taller than wide and fills the width, the pad sits bottom-center, the planet and goal are above it, the canvas's `width`/`height` attributes read 1000/1600, and the whole board is on screen. Pull **down** from anywhere on the board: the preview arcs **up**. Release: the probe flies up.
- 844×390 (landscape): unchanged from before (attributes 1600/1000).
- Resize the window across the portrait/landscape boundary mid-flight: playback continues from the same world position, only the framing changes.
- Daily Challenge in portrait: same behaviour.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/space/useBoardCanvas.ts packages/web/src/GameCanvas.tsx packages/web/src/campaign/CampaignCanvas.tsx
git commit -m "feat(web): turn the board 90° CCW on portrait viewports

The hook owns the canvas pixel size and applies the orientation matrix before each draw; pointer input goes through the inverse map. Renderers, playback, trails, and bursts stay in world units, so rotating mid-flight only changes the framing.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Single-row HUD with an icon-only back button

**Files:**
- Modify: `packages/web/src/styles.css` (`.hud`, `.hud h1`, `.hud .stat`, `.back`; new narrow-phone media query)
- Modify: `packages/web/src/campaign/CampaignLevel.tsx:68`
- Modify: `packages/web/src/DailyGame.tsx:51`
- Modify: `packages/web/src/campaign/CampaignMap.tsx:17`

**Interfaces:** none new. Pure presentation. The objective *content* (glyphs instead of "targets 0/2 · goal locked") is sprint 3; this task only stops the row from wrapping.

- [ ] **Step 1: Make `.hud` a non-wrapping row**

In `packages/web/src/styles.css`, replace the `.hud`, `.hud h1`, `.hud .stat`, and `.hud .pips` rules with:

```css
.hud {
  display: flex; flex-wrap: nowrap; align-items: center; gap: 24px;
  max-width: 1100px; width: 100%; min-width: 0;
  padding-bottom: 8px; border-bottom: 1px solid rgba(128, 170, 230, 0.18);
}
/* The title shrinks first (ellipsis); everything else keeps its size. */
.hud h1 {
  flex: 1 1 auto; min-width: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: 1.3rem; letter-spacing: 0.2em;
  text-shadow: 0 0 14px rgba(120, 170, 255, 0.4);
}
.hud .stat { flex: 0 0 auto; white-space: nowrap; font-variant-numeric: tabular-nums; color: var(--muted); }
.hud .pips { color: var(--accent); letter-spacing: 0.15em; }
/* Narrow phones: one line down to 360 px (back 32 + objective ≤ 120 + pips ≤ 72 + gaps 24 leaves ≥ 80 px for the title). */
@media (max-width: 480px) {
  .hud { gap: 8px; }
  .hud h1 { font-size: 1.1rem; letter-spacing: 0.12em; }
  .hud .stat:not(.pips) { max-width: 120px; overflow: hidden; text-overflow: ellipsis; }
  .hud .pips { font-size: 0.8rem; letter-spacing: 0.06em; max-width: 72px; overflow: hidden; }
}
```

Replace the `.back` rule with an icon-button style:

```css
.back {
  flex: 0 0 auto; background: none; border: none; color: #80cbc4; cursor: pointer;
  font-size: 1.25rem; line-height: 1; padding: 4px 6px; min-width: 32px;
}
```

- [ ] **Step 2: Make the back buttons icon-only with an accessible name**

`packages/web/src/campaign/CampaignLevel.tsx`, replace the back button line:

```tsx
        <button className="back" onClick={onExit} aria-label="Back to levels" title="Back to levels">←</button>
```

`packages/web/src/DailyGame.tsx`, replace the back button line:

```tsx
        <button className="back" onClick={onExit} aria-label="Back to menu" title="Back to menu">←</button>
```

`packages/web/src/campaign/CampaignMap.tsx`, replace the back button line (the map's row already fits 390 px; this keeps the three `.back` buttons identical):

```tsx
        <button className="back" onClick={onExit} aria-label="Back to menu" title="Back to menu">←</button>
```

- [ ] **Step 3: Typecheck, test, and measure the row**

Run: `pnpm --filter @apogee/web typecheck && pnpm --filter @apogee/web test`

Expected: PASS.

Then `pnpm dev` and, at each of 360×640, 390×844, and 1280×800 (device toolbar or the Playwright MCP), open Campaign → level 12 "Guarded Marks" (id `4-3`: a long name with a `targets 0/2 · goal locked`-style objective; a level unlocks when the previous one is cleared, so either clear 1–11 or run `localStorage.setItem("apogee-campaign-progress", JSON.stringify({"4-2":{"cleared":true,"stars":1}}))` in the console and reload). In the console:

```js
const hud = document.querySelector(".hud");
({ height: hud.getBoundingClientRect().height, scrollW: hud.scrollWidth, clientW: hud.clientWidth })
```

Expected: `height` ≤ 40 (one line), `scrollW === clientW` (nothing overflows), and by eye: `←`, an ellipsised title, the objective, and the pips on one row; on desktop the title is unchanged. Also check Daily Challenge at 360×640: one row.

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/styles.css packages/web/src/campaign/CampaignLevel.tsx packages/web/src/DailyGame.tsx packages/web/src/campaign/CampaignMap.tsx
git commit -m "feat(web): single-row HUD with an icon-only back button down to 360px

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Sprint verification sweep

**Files:** none new. Modify only if the sweep shakes something loose.

**Interfaces:** none. This task checks the spec's success criteria.

- [ ] **Step 1: Full gate and the no-engine-change guarantee**

Run: `pnpm test && pnpm typecheck && git log --oneline 89fd6bd..HEAD -- packages/engine`

Expected: engine and web suites green; typecheck errors only from the two untracked `packages/engine/tests/_*.test.ts` scratch files; the `git log` prints nothing.

- [ ] **Step 2: Dead-reference sweep**

Run:

```bash
grep -rn "worldWidth\|worldHeight\|lp.x + view.drag\|← levels\|← menu\|width={WORLD_WIDTH}" packages/web/src --include=*.ts --include=*.tsx
```

Expected: no hits (the old absolute-pull band, the removed hook opts, and the text back buttons are all gone). Fix any stale reference and fold the fix into the commit below.

- [ ] **Step 3: Headless success-criteria check**

With `pnpm dev` running, use the Playwright MCP (`browser_resize`, `browser_navigate` to `http://localhost:5173`, `browser_run_code_unsafe` for `page.mouse`) — or a real browser by hand — to check, in this order:

1. **Jittery tap never consumes a launch (criterion 1).** At 1280×800, Campaign → level 1. Read the pips text (`document.querySelector(".pips").textContent`). Mouse down at the board's center, move 2 px, mouse up. Expected: pips unchanged, no flight. Repeat with the press 400 px from the pad. Expected: unchanged.
2. **Max power reachable without leaving the board (criterion 2).** At 390×844, Campaign → level 1. Mouse down mid-board and drag 90 px straight down (≈ 250 world units at this scale), release. Expected: the pips lose one filled dot and a flight plays. (Max pull is 200 units; 90 px at 0.358 px/unit ≈ 250 units, so the band caps and the launch is at cap speed.)
3. **Whole board and one-line HUD on a 390×844 phone (criterion 3).** Same page. Expected: `canvas.getBoundingClientRect().bottom <= 844`, `canvas.width === 1000 && canvas.height === 1600`, and `.hud` height ≤ 40 with `scrollWidth === clientWidth`. Take a screenshot for the PR.
4. **Landscape phone unchanged.** At 844×390: `canvas.width === 1600`, the board fits (`bottom <= 390`).

Record the four results (pass/fail with the measured numbers) in the final report.

- [ ] **Step 4: Commit anything the sweep shook loose; otherwise no commit**

```bash
git status
# only if Step 2 or 3 required a fix:
git add -A packages/web
git commit -m "fix(web): <what the sweep found>

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Playtest checkpoint (Kevin — not an agent task)

The spec's manual checklist, on real hardware:

- Desktop: pull from anywhere on the board; a click without movement does nothing; a 5 px wobble does nothing; a pull past 200 units draws a capped band and launches at cap speed.
- Phone portrait (390×844): level 1 fully visible, HUD on one line, pull down to shoot up, max power reachable starting mid-board.
- Phone landscape (844×390): unchanged behaviour.
- Rotate the phone mid-flight: playback continues, no jump.
- Daily board: same gestures (shared hook).

Anything that fails here becomes a fix commit on this branch before the sprint is called done.
