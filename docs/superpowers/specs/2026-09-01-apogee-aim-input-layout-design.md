# Apogee — Aim Input & Board Layout Design Doc

*Brainstormed 2026-09-01. Sprint 2 of the [polish roadmap](./2026-09-01-apogee-polish-roadmap.md).
No engine dependency. Fixes findings F2 and F6.*

## Why

1. **A stray touch fires a max-power launch (F2).** `useBoardCanvas` computes the pull as
   `pad − pointer` in world units. Press anywhere far from the pad with one pixel of jitter and
   the release launches at the 600 u/s cap in whatever direction the pad happens to lie. On touch
   screens every tap jitters.
2. **Max power is unreachable near the board edge (F6).** The pad sits 80 world units from the
   left edge; a full pull is 200 units. On a laptop-width window there are a few pixels of slack
   outside the board; on a phone the finger leaves the screen.
3. **Portrait phones get a 358×224 px board (F6).** The 16:10 world is letterboxed into a 9:19.5
   screen, the HUD wraps to three lines, and the back button breaks across two.

The design spec called for a mobile-puzzler rhythm; the layout is desktop-only today.

## Decisions locked (during brainstorming)

1. **Relative pull.** The pull vector is `(press point − pointer)` in world units. The launch
   always originates at the pad. Press anywhere on the board.
2. **No pull gain.** Brainstorming proposed a 1.6× UI gain to make max power reachable; with a
   relative origin that problem disappears (start the pull wherever there is room), so the gain is
   dropped. One less constant, and screen distance still maps 1:1 to the engine's drag units.
3. **Minimum pull of 10 world units to fire.** Shorter pulls cancel. Pulling back to within the
   minimum and releasing is the cancel gesture.
4. **The drawn rubber band is clamped at 200 units** (`MAX_SPEED / POWER_SCALE`, the engine's
   speed cap) so the visual matches what the engine will do.
5. **Portrait rotates the board 90° counter-clockwise.** The world stays 1600×1000; the hook
   applies a canvas transform before drawing and an inverse map on pointer input. The pad ends up
   near the bottom center and the player pulls down to shoot up. Engine and renderer untouched.
6. **The HUD is a single non-wrapping row down to 360 px.**
7. **`LaunchInput` semantics are unchanged.** `dx`/`dy` remain the pull in world units, so
   recorded solutions, goldens, and the daily engine are unaffected.

## Section 1 — Pull model

New pure module `packages/web/src/space/aim.ts`:

```ts
export const MIN_PULL = 10;                         // world units; below this a release cancels
export const MAX_PULL = MAX_SPEED / POWER_SCALE;    // 200; engine clamps speed here anyway

export interface Pull { dx: number; dy: number }

/** Pull from the press point toward the current pointer, both in world units. */
export function pullVector(origin: Vec2, pointer: Vec2): Pull;   // origin − pointer
export function pullLength(p: Pull): number;
export function shouldFire(p: Pull): boolean;                    // length ≥ MIN_PULL
/** Same direction, length capped at MAX_PULL — for drawing only. */
export function clampPull(p: Pull): Pull;
```

Hook changes (`useBoardCanvas.ts`):

- `onDown` records the press point in world units as the pull origin (instead of `{dx:0,dy:0}`).
- `onMove` sets `dragRef = pullVector(origin, pointer)`.
- `onUp` fires `onLaunch({ dx, dy, launchTick })` only when `shouldFire`; otherwise it cancels
  silently (no launch consumed, no burst).
- The preview simulation receives the raw pull (engine clamps speed); the drawn band uses
  `clampPull`.

Rendering: the preview path still starts at the pad (it is the engine's trace). The rubber band
is drawn **from the press point to the pointer** so the finger sees its own gesture, and a short
direction tick is drawn at the pad. Both renderers (`drawFrame`, `drawCampaignFrame`) take
`drag: { origin: Vec2; dx; dy } | null` instead of the bare vector.

## Section 2 — Orientation

New pure module `packages/web/src/space/orientation.ts`:

```ts
export type Orientation = "landscape" | "portrait";
export function pickOrientation(viewportW: number, viewportH: number): Orientation; // portrait iff H > W
export function canvasSize(o: Orientation): { width: number; height: number };   // 1600×1000 or 1000×1600
export function worldToCanvas(o: Orientation, p: Vec2): Vec2;
export function canvasToWorld(o: Orientation, p: Vec2): Vec2;
```

Portrait mapping (90° CCW): `canvas = (y, WORLD_WIDTH − x)`. Checks: the pad (80, 500) lands at
(500, 1520) — horizontally centered, near the bottom; world +x (toward the goals) maps to canvas
−y (up); world y = 0 (top edge) maps to the canvas's left edge. Inverse:
`world = (WORLD_WIDTH − cy, cx)`.

Hook integration:

- The canvas element's `width`/`height` attributes and CSS `aspect-ratio` come from
  `canvasSize(orientation)`; orientation is re-read on `resize` (and on the first frame).
- Before `adapter.draw`, the hook sets the transform: identity in landscape;
  `ctx.setTransform(0, −1, 1, 0, 0, WORLD_WIDTH)` in portrait (this is `worldToCanvas` as a
  matrix). Renderers keep drawing in world coordinates; `clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT)`
  clears the full rotated canvas.
- `toWorld` maps pointer → canvas pixels (existing CSS scaling) → `canvasToWorld`.
- Playback, trails, bursts, and the preview are all stored in world space, so an orientation
  change mid-flight only changes how the next frame is drawn.

Invariants this relies on: renderers draw **no text** on the canvas (true today; sprint 3 keeps
captions in the DOM), and the cosmos backdrop is a separate viewport-sized canvas that never
rotates. Planet sprites rotate with the board; the sun-side highlight moving 90° is not
noticeable.

Layout in portrait: the canvas fills the width (`max-width: 100%`, `aspect-ratio: 10 / 16`) under
the HUD, with `max-height: calc(100dvh − HUD)` as today. Landscape rules are unchanged.

## Section 3 — HUD row

`.hud` becomes `flex-wrap: nowrap; align-items: center; min-width: 0`. The back button is
icon-only (`←` with `aria-label="Back to levels"` / `"Back to menu"`); the title gets
`overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1 1 auto; min-width: 0`
so it shrinks first; stats and pips get `white-space: nowrap; flex: 0 0 auto`. Budget at 360 px:
back 32 px, title ≥ 96 px, objective ≤ 120 px, pips ≤ 60 px. The objective *content* (glyphs) is
sprint 3; this sprint only fixes the row.

The home screen and level map already fit 390 px; unchanged.

## Section 4 — Testing

**Pure modules** (`web/tests/space/aim.test.ts`, `orientation.test.ts`):

- `pullVector` is origin − pointer; `shouldFire` false under 10 and true at 10; `clampPull`
  preserves direction and caps at 200; a zero pull never fires.
- Round-trip `worldToCanvas` ∘ `canvasToWorld` is identity in both orientations; the pad maps to
  bottom-center in portrait; world +x maps to canvas −y in portrait; `canvasSize` swaps.

**Manual checklist** (the hook is DOM-bound and untested, as today):

- Desktop: pull from anywhere on the board; a click without movement does nothing; a 5 px
  wobble does nothing; a pull past 200 units draws a capped band and launches at cap speed.
- Phone portrait (390×844): level 1 fully visible, HUD on one line, pull down to shoot up, max
  power reachable starting mid-board.
- Phone landscape (844×390): unchanged behaviour.
- Rotate the phone mid-flight: playback continues, no jump.
- Daily board: same gestures (shared hook).

Engine tests, goldens, and recorded solutions are untouched (no engine change).

## Out of scope

- Keyboard aiming (parked in the roadmap).
- Pinch/zoom, pan, or a "reset aim" control.
- HUD glyphs, hint captions, pad restyling (sprint 3).

## Success criteria

1. A jittery tap anywhere on the board never consumes a launch.
2. Max power is reachable on every device without the pointer leaving the board.
3. Level 1 is playable on a 390×844 phone with the whole board visible and the HUD on one line.
4. `pnpm test` and `pnpm typecheck` green; no engine file changed.
