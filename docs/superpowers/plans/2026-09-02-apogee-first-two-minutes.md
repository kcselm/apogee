# Apogee First Two Minutes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A first-time player launches within ten seconds without being told how, every mechanic is named on screen before the level that uses it, and a pasted link previews with an image.

**Architecture:** Web-only except one additive, data-only engine field (`Level.intro?: string`). Two new pure web modules (`onboarding.ts`, `campaign/intro.ts`) follow the `campaignStorage` pattern — injected `Storage`, thin functions, fully unit-tested. A third (`campaign/objectiveChips.ts`) extracts the HUD objective string into structured chips, following the `ratingText.ts` precedent. Renderer changes are confined to `render.ts`: a shared `drawPad` emitter replacing two duplicated pad blocks, and a larger drawn probe radius. All new copy is DOM, never canvas, so sprint 2's portrait rotation stays a pure transform.

**Tech Stack:** TypeScript 5, Vitest 3, React 19, Vite 7, pnpm workspaces. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-01-apogee-first-two-minutes-design.md`

**Roadmap:** `docs/superpowers/specs/2026-09-01-apogee-polish-roadmap.md` (sprint 3 of 6; fixes finding F1)

## Global Constraints

- Work on a new branch `feat/first-two-minutes` cut from `main` at `9d600be`. Sprint 2 is merged; `main` is 31 commits ahead of `origin/main` and unpushed. Do not push.
- **The only engine change permitted is the additive `Level.intro?: string` field and the ten strings that populate it, plus the test that guards them.** No simulation, scoring, or objective logic changes. `intro` is data the sim never reads.
- **Goldens must stay byte-identical.** `packages/engine/tests/golden.test.ts` and `campaign-golden.test.ts` must pass untouched. If a golden changes, the change is wrong — stop and report.
- Engine discipline unchanged: `+ − × ÷ sqrt` only.
- **No text drawn on the canvas.** Hint caption, intro cards, and objective chips are DOM. `render.ts` must contain zero `fillText` / `strokeText` calls after this sprint, same as before it.
- Storage keys verbatim from the spec: `apogee-onboarded` holding the string `"1"`; `apogee-intro-seen` holding a JSON array of level ids. Corrupted or unexpected values are treated as absent, matching `campaignStorage.loadProgress`.
- Objective chip glyphs verbatim: `◆` keys, `◎` targets, `⊚` goal. Chip palette: key `#ffd54f`, target `#ffb74d`, goal `#80cbc4`.
- The ten intro strings are authored in the spec and reproduced verbatim in Task 4. Each is ≤ 90 characters (longest is `3-1` at 85). Do not reword them.
- Engine `PROBE_RADIUS` stays `5` — it is the collision radius. The new drawn radius is a separate web-side constant.
- The two untracked `packages/engine/tests/_*.test.ts` scratch files break root `pnpm typecheck`. Expect `tsc` errors **only** from those two files and never touch them. Per-task gates are `pnpm --filter @apogee/web typecheck && pnpm --filter @apogee/web test` and `pnpm --filter @apogee/engine test`.
- Do not touch or commit these untracked files: `packages/engine/tests/_scratch.test.ts`, `packages/engine/tests/_task5_probe.test.ts`, `landscape-level1-check.png`, `portrait-flight.png`, `portrait-level1.png`.
- End every commit message with the line `Claude-Session: https://claude.ai/code/session_01MiMAA1kxnLBnAYZWebTbAD`, keeping `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` on the line above it (the branch history's convention).

## Deviations from the spec (deliberate, with rationale)

Two, both recorded here so executors and reviewers do not read them as drift:

1. **`padPulse` travels as an adapter prop, not a `BoardDrawOpts` field.** The spec (§1) says "a `padPulse: boolean` flag in `BoardDrawOpts`". `BoardDrawOpts` is what `useBoardCanvas` produces *per frame*; `padPulse` is per-mount screen state that the hook has no other reason to know. Routing it through the hook would mean a new `UseBoardCanvas` opt plus a ref to keep it fresh, for no gain. Instead it becomes a prop on `GameCanvas` / `CampaignCanvas` and is captured by the adapter's `draw` closure exactly the way `game` and `state` already are. The rendered result is identical.
2. **A `useAimHint` hook is added beyond the spec's file list.** The spec names only `onboarding.ts`. The hint's state machine (`show` → `fading` → `off`) is identical on both boards, and pasting it into `DailyGame.tsx` and `CampaignLevel.tsx` would be a verbatim-duplicated logic block — which this repo's review rubric treats as a defect. `onboarding.ts` stays pure storage per the spec; the hook lives beside it in `useAimHint.ts`.

## Assumption

The spec names "fun-debt Task 7 (tap-to-skip hint)" as a dependency and puts that hint out of scope. Task 7 was never implemented — there is no skip handling anywhere in `packages/web/src`. Nothing in this sprint depends on it and there is no competing on-screen hint to collide with. Recorded so a reviewer does not treat its absence as a gap.

---

## File structure

| File | Responsibility | Change |
|---|---|---|
| `packages/web/src/onboarding.ts` | pure first-launch flag: `hasLaunchedBefore`, `markLaunched` | new |
| `packages/web/src/useAimHint.ts` | React state machine for the hint caption + pad pulse | new |
| `packages/web/src/campaign/intro.ts` | pure intro-card storage + selection: `loadSeen`, `markSeen`, `introToShow` | new |
| `packages/web/src/campaign/objectiveChips.ts` | pure HUD objective chips: `Chip`, `describeObjectives` | new |
| `packages/web/src/render.ts` | canvas drawing | shared `drawPad` emitter replaces two duplicated pad blocks; probe drawn at 8; landed ring; `padPulse` on both view types |
| `packages/web/src/GameCanvas.tsx`, `packages/web/src/campaign/CampaignCanvas.tsx` | board adapters | new `padPulse` prop passed into the draw call |
| `packages/web/src/DailyGame.tsx` | daily screen | hint caption + pad pulse via `useAimHint` |
| `packages/web/src/campaign/CampaignLevel.tsx` | campaign screen | hint caption, intro card overlay, chips instead of the objective string |
| `packages/web/src/styles.css` | layout | `.aim-hint`, `.chip*`, `.intro-*` rules |
| `packages/web/index.html` | page metadata | favicon, description, Open Graph, `theme-color` |
| `packages/web/public/og.png` | 1200×630 link preview image | new (binary, committed) |
| `packages/engine/src/campaign/types.ts` | `Level` type | additive `intro?: string` |
| `packages/engine/src/campaign/levels.ts` | level data | `intro` on the ten chapter openers |
| `packages/engine/tests/campaign-levels.test.ts` | level invariants | new test guarding intro placement + length |
| `packages/web/tests/onboarding.test.ts`, `tests/campaign/intro.test.ts`, `tests/campaign/objectiveChips.test.ts` | web unit tests | new |

---

### Task 1: First-launch flag (`onboarding.ts`)

**Files:**
- Create: `packages/web/src/onboarding.ts`
- Test: `packages/web/tests/onboarding.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `hasLaunchedBefore(storage: Pick<Storage, "getItem">): boolean` and `markLaunched(storage: Storage): void`. Task 2's `useAimHint` consumes both.

- [ ] **Step 1: Write the failing test**

Create `packages/web/tests/onboarding.test.ts`. The `fakeStorage` helper is copied from `packages/web/tests/campaignStorage.test.ts` so this file stands alone:

```ts
import { describe, expect, it } from "vitest";
import { hasLaunchedBefore, markLaunched } from "../src/onboarding";

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

describe("onboarding flag", () => {
  it("reports no prior launch on a fresh profile", () => {
    expect(hasLaunchedBefore(fakeStorage())).toBe(false);
  });

  it("reports a prior launch once marked", () => {
    const storage = fakeStorage();
    markLaunched(storage);
    expect(hasLaunchedBefore(storage)).toBe(true);
  });

  it("writes exactly the documented key and value", () => {
    const storage = fakeStorage();
    markLaunched(storage);
    expect(storage.getItem("apogee-onboarded")).toBe("1");
  });

  it("treats an unexpected stored value as never launched", () => {
    const storage = fakeStorage();
    storage.setItem("apogee-onboarded", "yes");
    expect(hasLaunchedBefore(storage)).toBe(false);
  });

  it("is idempotent", () => {
    const storage = fakeStorage();
    markLaunched(storage);
    markLaunched(storage);
    expect(storage.getItem("apogee-onboarded")).toBe("1");
    expect(hasLaunchedBefore(storage)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @apogee/web exec vitest run onboarding`

Expected: FAIL — cannot resolve `../src/onboarding`.

- [ ] **Step 3: Write the implementation**

Create `packages/web/src/onboarding.ts`:

```ts
const KEY = "apogee-onboarded";

/**
 * Whether this profile has ever launched a probe, in either mode. Drives the
 * one-time aim hint. Anything other than the exact written value counts as
 * "never" (matches campaignStorage's "treat corrupted values as absent").
 */
export function hasLaunchedBefore(storage: Pick<Storage, "getItem">): boolean {
  return storage.getItem(KEY) === "1";
}

/** Record that the player has launched. Idempotent. */
export function markLaunched(storage: Storage): void {
  storage.setItem(KEY, "1");
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @apogee/web exec vitest run onboarding`

Expected: PASS, 5/5.

- [ ] **Step 5: Run the web gate**

Run: `pnpm --filter @apogee/web typecheck && pnpm --filter @apogee/web test`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/onboarding.ts packages/web/tests/onboarding.test.ts
git commit -m "feat(web): remember whether the player has ever launched

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01MiMAA1kxnLBnAYZWebTbAD"
```

---

### Task 2: Pad emitter and probe readability (`render.ts`)

**Files:**
- Modify: `packages/web/src/render.ts`
- Modify: `packages/web/src/GameCanvas.tsx`
- Modify: `packages/web/src/campaign/CampaignCanvas.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `RenderView.padPulse: boolean` and `CampaignRenderView.padPulse: boolean`; `GameCanvas` and `CampaignCanvas` each gain a required `padPulse: boolean` prop. Task 3 supplies both from `useAimHint`.

Context: `render.ts` currently draws the pad with the same six lines in two places (`drawFrame` around line 488 and `drawCampaignFrame` around line 650). This task replaces both with one `drawPad`, in the same spirit as sprint 2's `drawAim`.

- [ ] **Step 1: Add the drawn-probe constant and the pad emitter**

In `packages/web/src/render.ts`, just below the existing `const PAD_RADIUS = 14;` / `const AIM_TICK = 18;` pair, add:

```ts
/**
 * Drawn probe radius. The engine's PROBE_RADIUS (5) remains the collision
 * radius; this is visual only, so a landed probe reads at arm's length on a
 * phone. Never use this for hit tests.
 */
const PROBE_DRAW_RADIUS = 8;
/** Radius of the ring around a landed probe. */
const LANDED_RING_RADIUS = 14;
```

Then add `drawPad` immediately above the existing `drawAim`:

```ts
/**
 * The launch pad, drawn as a solid emitter: filled core, ring, glow, and a
 * short tick toward +x (every level's goals lie downrange). Before this the pad
 * was an outline ring, which shared a silhouette with the goal and left a
 * first-time player with nothing to aim from. `pulse` breathes the halo until
 * the player's first launch ever; callers pass false under reduced motion.
 */
function drawPad(
  ctx: CanvasRenderingContext2D,
  pos: { x: number; y: number },
  pulse: boolean,
  time: number,
): void {
  ctx.save();
  if (pulse) {
    const breath = 1 + 0.18 * Math.sin(time * 0.004);
    ctx.globalAlpha = 0.26;
    ctx.fillStyle = COLORS.pad;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, PAD_RADIUS * 1.9 * breath, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.shadowColor = "rgba(128, 203, 196, 0.85)";
  ctx.shadowBlur = 14;
  ctx.fillStyle = COLORS.pad;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = COLORS.pad;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, PAD_RADIUS, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(pos.x + PAD_RADIUS, pos.y);
  ctx.lineTo(pos.x + PAD_RADIUS + 10, pos.y);
  ctx.stroke();
  ctx.restore();
}
```

- [ ] **Step 2: Enlarge the probe and ring the landed ones**

Replace the whole of `drawProbe` (currently around line 423) with:

```ts
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
  if (landed) {
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = COLORS.probeLanded;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, LANDED_RING_RADIUS * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.shadowColor = landed ? "rgba(165,214,167,0.9)" : "rgba(200,220,255,0.95)";
  ctx.shadowBlur = landed ? 16 : 9;
  ctx.fillStyle = landed ? COLORS.probeLanded : COLORS.probe;
  ctx.beginPath();
  ctx.arc(x, y, PROBE_DRAW_RADIUS * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
```

In `drawTrail` (around line 413), scale the trail with the drawn radius — change

```ts
      ctx.lineWidth = a * PROBE_RADIUS * 1.2;
```

to

```ts
      ctx.lineWidth = a * PROBE_DRAW_RADIUS * 1.2;
```

**Leave every other `PROBE_RADIUS` use alone.** In particular the blocker danger ring (`ctx.arc(pos.x, pos.y, radius + PROBE_RADIUS + 4, ...)`, around line 331) and the comment about teleport gaps near line 374 are about *collision*, not appearance, and must keep the engine constant.

- [ ] **Step 3: Add `padPulse` to both view types and call `drawPad`**

In `RenderView` (around line 82), add after `animate`:

```ts
  /** Breathe the pad halo (the player has never launched). */
  padPulse: boolean;
```

Add the identical field to `CampaignRenderView` (around line 514), after `animate`.

In `drawFrame`, replace the six-line pad block:

```ts
  // Launch pad
  const lp = game.system.launchPos;
  ctx.strokeStyle = COLORS.pad;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(lp.x, lp.y, PAD_RADIUS, 0, Math.PI * 2);
  ctx.stroke();
```

with:

```ts
  // Launch pad
  const lp = game.system.launchPos;
  drawPad(ctx, lp, view.padPulse && view.animate, view.time);
```

In `drawCampaignFrame`, replace the matching block:

```ts
  // Launch pad.
  const lp = level.launchPos;
  ctx.strokeStyle = COLORS.pad;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(lp.x, lp.y, PAD_RADIUS, 0, Math.PI * 2);
  ctx.stroke();
```

with:

```ts
  // Launch pad.
  const lp = level.launchPos;
  drawPad(ctx, lp, view.padPulse && view.animate, view.time);
```

`&& view.animate` is what honours the spec's "Reduced motion: no pulse, caption only" — under reduced motion the hook already freezes `time`, and this additionally drops the halo entirely.

- [ ] **Step 4: Thread `padPulse` through both adapters**

In `packages/web/src/GameCanvas.tsx`, add `padPulse: boolean;` to `interface Props`, destructure it in the signature, and pass it into the `drawFrame` call. The changed lines:

```tsx
export function GameCanvas({ game, disabled, anim, padPulse, onLaunch, onAnimDone }: Props) {
```

```tsx
        drawFrame(ctx, {
          game,
          probeFrames: o.probeFrames,
          previewPath: o.previewPath,
          drag: o.drag,
          trail: o.trail,
          bursts: o.bursts,
          time: o.time,
          animate: o.animate,
          padPulse,
        }),
```

In `packages/web/src/campaign/CampaignCanvas.tsx`, the same three edits:

```tsx
export function CampaignCanvas({ state, disabled, anim, clearAt, padPulse, onLaunch, onAnimDone }: Props) {
```

```tsx
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
          padPulse,
        }),
```

- [ ] **Step 5: Satisfy the type checker at both call sites**

`DailyGame.tsx` and `CampaignLevel.tsx` now fail to typecheck — `padPulse` is required and missing. Pass `padPulse={false}` at both call sites as a placeholder; Task 3 replaces it with real state. This keeps the branch green at every commit.

- [ ] **Step 6: Run the web gate**

Run: `pnpm --filter @apogee/web typecheck && pnpm --filter @apogee/web test`

Expected: PASS. No web test asserts on canvas drawing, so the suite count is unchanged.

- [ ] **Step 7: Check it by eye**

`pnpm dev`, then at 1280×800 open Campaign → level 1 and Daily Challenge. Expected: the pad is a filled teal core with a ring, a glow, and a short tick pointing right — clearly not the same shape as the dashed goal ring; no halo yet (`padPulse` is still `false`). Land a probe: it is noticeably larger than before and carries a green ring. Confirm the trail is proportionally thicker and nothing else moved.

- [ ] **Step 8: Commit**

```bash
git add packages/web/src/render.ts packages/web/src/GameCanvas.tsx packages/web/src/campaign/CampaignCanvas.tsx packages/web/src/DailyGame.tsx packages/web/src/campaign/CampaignLevel.tsx
git commit -m "feat(web): solid pad emitter and a probe you can see from arm's length

One drawPad replaces the pad block duplicated in both renderers. The pad no longer shares a silhouette with the goal ring, and landed probes get a ring and a stronger glow at a drawn radius of 8 (the engine's collision radius is untouched).

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01MiMAA1kxnLBnAYZWebTbAD"
```

---

### Task 3: The one-time aim hint

**Files:**
- Create: `packages/web/src/useAimHint.ts`
- Modify: `packages/web/src/DailyGame.tsx`
- Modify: `packages/web/src/campaign/CampaignLevel.tsx`
- Modify: `packages/web/src/styles.css`

**Interfaces:**
- Consumes: `hasLaunchedBefore`, `markLaunched` from Task 1; the `padPulse` props from Task 2.
- Produces: `useAimHint(): { hint: "show" | "fading" | "off"; padPulse: boolean; noteLaunch: () => void }`. Nothing later consumes it.

- [ ] **Step 1: Write the hook**

Create `packages/web/src/useAimHint.ts`:

```ts
import { useCallback, useState } from "react";
import { hasLaunchedBefore, markLaunched } from "./onboarding";

export type HintState = "show" | "fading" | "off";

/**
 * The one-time aim hint, shared by both boards. A profile that has never
 * launched sees the caption and a breathing pad; the first launch marks the
 * profile and fades the caption out. On every later mount the caption is
 * absent entirely, so it costs no layout.
 */
export function useAimHint(): {
  hint: HintState;
  padPulse: boolean;
  noteLaunch: () => void;
} {
  const [hint, setHint] = useState<HintState>(() =>
    hasLaunchedBefore(localStorage) ? "off" : "show",
  );
  const noteLaunch = useCallback(() => {
    // Only the very first launch writes; later launches are a no-op.
    setHint((prev) => {
      if (prev !== "show") return prev;
      markLaunched(localStorage);
      return "fading";
    });
  }, []);
  return { hint, padPulse: hint === "show", noteLaunch };
}
```

- [ ] **Step 2: Add the caption styles**

In `packages/web/src/styles.css`, add after the `.hud` media query block (immediately before the `.overlay` rule):

```css
/* One-time aim hint under the board. Rendered only for a profile that has
   never launched, so it costs no layout on any later visit. */
.aim-hint {
  margin-top: 10px; text-align: center;
  color: var(--muted); letter-spacing: 0.06em;
  transition: opacity 0.45s ease;
}
.aim-hint.gone { opacity: 0; }
```

- [ ] **Step 3: Wire the daily board**

In `packages/web/src/DailyGame.tsx`: import the hook, call it, replace the `padPulse={false}` placeholder, call `noteLaunch()` inside `handleLaunch`, and render the caption directly after `<GameCanvas … />`.

Add to the imports:

```tsx
import { useAimHint } from "./useAimHint";
```

Inside the component, above `handleLaunch`:

```tsx
  const { hint, padPulse, noteLaunch } = useAimHint();
```

In `handleLaunch`, add `noteLaunch();` as the first statement of the callback body, and add `noteLaunch` to its dependency array.

Change the canvas props and add the caption:

```tsx
        padPulse={padPulse}
```

```tsx
      {hint !== "off" && (
        <p className={hint === "fading" ? "aim-hint gone" : "aim-hint"}>
          drag anywhere to aim · release to launch
        </p>
      )}
```

- [ ] **Step 4: Wire the campaign board**

In `packages/web/src/campaign/CampaignLevel.tsx`, make the same four edits. Import:

```tsx
import { useAimHint } from "../useAimHint";
```

Above `handleLaunch`:

```tsx
  const { hint, padPulse, noteLaunch } = useAimHint();
```

In `handleLaunch`, add `noteLaunch();` as the first statement and `noteLaunch` to the dependency array. On `<CampaignCanvas …>` replace the placeholder with `padPulse={padPulse}`. Render the caption directly after the closing `/>` of `<CampaignCanvas`, before the `{over && (` block:

```tsx
      {hint !== "off" && (
        <p className={hint === "fading" ? "aim-hint gone" : "aim-hint"}>
          drag anywhere to aim · release to launch
        </p>
      )}
```

The copy is identical on both boards — it is a caption string, not a logic block, and both spell the same instruction.

- [ ] **Step 5: Run the web gate**

Run: `pnpm --filter @apogee/web typecheck && pnpm --filter @apogee/web test`

Expected: PASS.

- [ ] **Step 6: Check the whole hint lifecycle by eye**

`pnpm dev`. In the browser console run `localStorage.removeItem("apogee-onboarded")` and reload, then:

1. Campaign → level 1. Expected: the caption `drag anywhere to aim · release to launch` sits under the board and the pad halo breathes.
2. Pull and release a real launch. Expected: the caption fades out over ~0.45 s, the halo stops, and `localStorage.getItem("apogee-onboarded")` is `"1"`.
3. Back out and open Daily Challenge. Expected: no caption, no halo.
4. Reload, open level 1 again. Expected: no caption, no halo, and no blank line under the board.
5. Clear the key again, reload, and this time do a **sub-`MIN_PULL` release** (a 2 px jiggle at 1280×800). Expected: the caption stays and the flag is still absent — a cancelled aim is not a launch.
6. With the key cleared, enable OS reduced motion (or DevTools → Rendering → Emulate `prefers-reduced-motion: reduce`) and reload. Expected: the caption is shown, the halo is absent.

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/useAimHint.ts packages/web/src/DailyGame.tsx packages/web/src/campaign/CampaignLevel.tsx packages/web/src/styles.css
git commit -m "feat(web): one-time aim hint on a player's first ever launch

A never-launched profile gets a caption under the board and a breathing pad; the first launch marks the profile and fades both. Under reduced motion the caption shows without the pulse.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01MiMAA1kxnLBnAYZWebTbAD"
```

---

### Task 4: `Level.intro` and the ten mechanic lines (engine)

**Files:**
- Modify: `packages/engine/src/campaign/types.ts:55-71`
- Modify: `packages/engine/src/campaign/levels.ts`
- Test: `packages/engine/tests/campaign-levels.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `Level.intro?: string`, set on exactly the ten chapter-opening levels `1-1 … 10-1`. Task 5 consumes it via `introToShow`.

This is the sprint's only engine change. It is data the simulation never reads.

- [ ] **Step 1: Write the failing test**

In `packages/engine/tests/campaign-levels.test.ts`, add inside the existing `describe("authored levels", …)` block, after the `"every level has a unique id"` test:

```ts
  it("exactly the ten chapter-opening levels carry an intro of at most 90 characters", () => {
    const withIntro = LEVELS.filter((l) => l.intro !== undefined).map((l) => l.id);
    expect(withIntro).toEqual(["1-1", "2-1", "3-1", "4-1", "5-1", "6-1", "7-1", "8-1", "9-1", "10-1"]);
    for (const lvl of LEVELS) {
      if (lvl.intro === undefined) continue;
      expect(lvl.intro.length, lvl.id).toBeLessThanOrEqual(90);
      expect(lvl.intro.trim(), lvl.id).toBe(lvl.intro);
    }
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @apogee/engine exec vitest run campaign-levels`

Expected: FAIL — `intro` is not a property of `Level`, so `tsc` and the assertion both reject it (the received array is empty).

- [ ] **Step 3: Add the field to the type**

In `packages/engine/src/campaign/types.ts`, inside `interface Level`, add after `portals?: Portal[];`:

```ts
  /**
   * One-line mechanic card shown the first time this level is opened. Set only
   * on each chapter's opening level. Presentation data: the simulation never
   * reads it, so goldens are unaffected.
   */
  intro?: string;
```

- [ ] **Step 4: Author the ten lines**

In `packages/engine/src/campaign/levels.ts`, add an `intro` property to each chapter-opening level object. Use these strings verbatim — they are the spec's, and the test caps them at 90 characters:

| Level id | `intro` |
|---|---|
| `1-1` | `Planets pull on your probe. Bend the shot into the goal ring.` |
| `2-1` | `Red worlds pull like planets and destroy anything that touches them. Curve around.` |
| `3-1` | `Keys unlock the goal. Fly through the key first; it stays collected between launches.` |
| `4-1` | `Marks: pass a probe through every one. Landed probes stay on the board.` |
| `5-1` | `Keys, marks, and guards together. Plan the order of your launches.` |
| `6-1` | `Moons orbit on a fixed clock. Their pull moves; time your launch.` |
| `7-1` | `Moons meet guards, keys, and marks. The preview is honest; watch the clock.` |
| `8-1` | `Wormholes: enter one mouth, leave the other, heading the way it faces.` |
| `9-1` | `Wormholes with keys, marks, and guards. The exit direction is the puzzle.` |
| `10-1` | `Capstone. Moons, wormholes, and everything before them.` |

Place the property on its own line at the end of each of those ten level objects, after `par`. For `1-1` the result is:

```ts
  {
    id: "1-1", name: "First Light",
    bodies: [planet(800, 520, 80)],
    keys: [], goal: { pos: { x: 1180, y: 360 }, radius: 40 }, targets: [],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 3,
    objectives: [{ kind: "reach-goal" }], par: 1,
    intro: "Planets pull on your probe. Bend the shot into the goal ring.",
  },
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @apogee/engine exec vitest run campaign-levels`

Expected: PASS.

- [ ] **Step 6: Prove the goldens did not move**

Run: `pnpm --filter @apogee/engine test`

Expected: PASS, including `golden.test.ts` and `campaign-golden.test.ts`, with **no snapshot written or updated**. If any golden changes, stop and report — `intro` must be inert to the simulation.

- [ ] **Step 7: Commit**

```bash
git add packages/engine/src/campaign/types.ts packages/engine/src/campaign/levels.ts packages/engine/tests/campaign-levels.test.ts
git commit -m "feat(engine): name each chapter's mechanic with Level.intro

Presentation-only data on the ten chapter-opening levels; the simulation never reads it and the goldens are unchanged. A test pins the placement and the 90-character cap.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01MiMAA1kxnLBnAYZWebTbAD"
```

---

### Task 5: Mechanic intro cards (storage, selection, and the card)

**Files:**
- Create: `packages/web/src/campaign/intro.ts`
- Create: `packages/web/tests/campaign/intro.test.ts`
- Modify: `packages/web/src/campaign/CampaignLevel.tsx`
- Modify: `packages/web/src/styles.css`

**Interfaces:**
- Consumes: `Level.intro` from Task 4.
- Produces: `loadSeen(storage): string[]`, `markSeen(storage, levelId): string[]`, `introToShow(level, seen): string | null`. Nothing later consumes them.

Note on lifecycle: `App.tsx` renders `<CampaignLevel key={`${view.index}-${playCount}`} …>`, so the component remounts on every level change **and** on Retry. The card's "first open only, never on Retry" rule therefore rests on the persisted `apogee-intro-seen` list, not on component state — which is exactly why dismissal writes before it hides.

- [ ] **Step 1: Write the failing test**

Create `packages/web/tests/campaign/intro.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { introToShow, loadSeen, markSeen } from "../../src/campaign/intro";

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

describe("intro card storage", () => {
  it("returns nothing seen on a fresh profile", () => {
    expect(loadSeen(fakeStorage())).toEqual([]);
  });

  it("records a level under the documented key", () => {
    const storage = fakeStorage();
    markSeen(storage, "3-1");
    expect(loadSeen(storage)).toEqual(["3-1"]);
    expect(storage.getItem("apogee-intro-seen")).toBe('["3-1"]');
  });

  it("does not record the same level twice", () => {
    const storage = fakeStorage();
    markSeen(storage, "3-1");
    markSeen(storage, "3-1");
    expect(loadSeen(storage)).toEqual(["3-1"]);
  });

  it("keeps earlier entries when a new level is seen", () => {
    const storage = fakeStorage();
    markSeen(storage, "1-1");
    markSeen(storage, "2-1");
    expect(loadSeen(storage)).toEqual(["1-1", "2-1"]);
  });

  it("treats corrupted JSON as nothing seen", () => {
    const storage = fakeStorage();
    storage.setItem("apogee-intro-seen", "{not json");
    expect(loadSeen(storage)).toEqual([]);
  });

  it("treats a non-array payload as nothing seen", () => {
    const storage = fakeStorage();
    storage.setItem("apogee-intro-seen", '{"1-1":true}');
    expect(loadSeen(storage)).toEqual([]);
  });

  it("drops non-string entries from a stored array", () => {
    const storage = fakeStorage();
    storage.setItem("apogee-intro-seen", '["1-1",7,null,"2-1"]');
    expect(loadSeen(storage)).toEqual(["1-1", "2-1"]);
  });
});

describe("introToShow", () => {
  it("shows the intro of an unseen chapter-opening level", () => {
    expect(introToShow({ id: "1-1", intro: "Planets pull." }, [])).toBe("Planets pull.");
  });

  it("shows nothing once that level has been seen", () => {
    expect(introToShow({ id: "1-1", intro: "Planets pull." }, ["1-1"])).toBeNull();
  });

  it("shows nothing for a level with no intro", () => {
    expect(introToShow({ id: "1-2", intro: undefined }, [])).toBeNull();
  });

  it("is not confused by a different level having been seen", () => {
    expect(introToShow({ id: "2-1", intro: "Red worlds." }, ["1-1"])).toBe("Red worlds.");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @apogee/web exec vitest run intro`

Expected: FAIL — cannot resolve `../../src/campaign/intro`.

- [ ] **Step 3: Write the module**

Create `packages/web/src/campaign/intro.ts`:

```ts
import type { Level } from "@apogee/engine";

const KEY = "apogee-intro-seen";

/**
 * Level ids whose intro card the player has dismissed. Corrupted or unexpected
 * payloads read as empty, matching campaignStorage.loadProgress.
 */
export function loadSeen(storage: Pick<Storage, "getItem">): string[] {
  const raw = storage.getItem(KEY);
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

/** Record that this level's intro has been shown. Returns the new list. */
export function markSeen(storage: Storage, levelId: string): string[] {
  const seen = loadSeen(storage);
  if (!seen.includes(levelId)) seen.push(levelId);
  storage.setItem(KEY, JSON.stringify(seen));
  return seen;
}

/** The intro to show on opening this level, or null if it has none or was seen. */
export function introToShow(level: Pick<Level, "id" | "intro">, seen: string[]): string | null {
  if (level.intro === undefined) return null;
  return seen.includes(level.id) ? null : level.intro;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @apogee/web exec vitest run intro`

Expected: PASS, 11/11.

- [ ] **Step 5: Render the card**

In `packages/web/src/campaign/CampaignLevel.tsx`:

Add to the imports:

```tsx
import { introToShow, loadSeen, markSeen } from "./intro";
```

and add `useEffect` to the existing `react` import.

Inside the component, after the `useAimHint()` line from Task 3:

```tsx
  // First open of a chapter's opening level: name the mechanic before play.
  // Keyed remounts (level change and Retry) re-run this initializer, so the
  // "not on Retry" rule rests on the persisted list, not on component state.
  const [intro, setIntro] = useState<string | null>(() =>
    introToShow(level, loadSeen(localStorage)),
  );
  const dismissIntro = useCallback(() => {
    markSeen(localStorage, level.id);
    setIntro(null);
  }, [level.id]);

  useEffect(() => {
    if (intro === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        dismissIntro();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [intro, dismissIntro]);
```

Make the board inert while the card is up by extending the existing `disabled` expression on `<CampaignCanvas>`:

```tsx
        disabled={over || anim !== null || intro !== null}
```

Render the card as the last child, after the `{over && (…)}` block:

```tsx
      {intro !== null && (
        <div className="overlay" onClick={dismissIntro}>
          <div className="panel intro-card">
            <div className="intro-name">{level.name}</div>
            <p className="intro-text">{intro}</p>
            <div className="actions">
              <button onClick={dismissIntro}>Got it</button>
            </div>
          </div>
        </div>
      )}
```

The click handler sits on the `.overlay`, so a tap anywhere dismisses; the **Got it** button is inside it and dismisses through the same handler.

- [ ] **Step 6: Style the card**

In `packages/web/src/styles.css`, add immediately after the `@keyframes overlay-in` rule:

```css
.intro-card { max-width: 30rem; }
.intro-name {
  font-size: 1.1rem; letter-spacing: 0.2em; color: var(--accent);
  text-transform: uppercase;
}
.intro-text { color: var(--ink); line-height: 1.5; margin: 0; }
```

- [ ] **Step 7: Run the web gate**

Run: `pnpm --filter @apogee/web typecheck && pnpm --filter @apogee/web test`

Expected: PASS.

- [ ] **Step 8: Check the card by eye**

`pnpm dev`. In the console run `localStorage.removeItem("apogee-intro-seen")` and reload, then:

1. Campaign → level 1. Expected: a card over the board with `FIRST LIGHT`, the planets line, and a **Got it** button; the board does not respond to a drag underneath.
2. Press Space. Expected: the card dismisses and aiming works.
3. Retry from the level-over panel, and re-enter the level from the map. Expected: no card either time.
4. Open level 2 (`1-2`). Expected: no card — only chapter openers have one.
5. Reload and open level 1. Expected: still no card.
6. Run `localStorage.setItem("apogee-campaign-progress", JSON.stringify({"2-3":{"cleared":true,"stars":1}}))`, reload, and open level 10 (`4-1`). Expected: the marks card, dismissable by clicking the backdrop.

- [ ] **Step 9: Commit**

```bash
git add packages/web/src/campaign/intro.ts packages/web/tests/campaign/intro.test.ts packages/web/src/campaign/CampaignLevel.tsx packages/web/src/styles.css
git commit -m "feat(web): name each mechanic on the first open of a chapter

An overlay card carries the level name and its intro line, dismissed by tap, Space, Enter, or the button, and never shown twice — the seen list is persisted, so Retry and re-entry stay quiet.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01MiMAA1kxnLBnAYZWebTbAD"
```

---

### Task 6: HUD objective chips

**Files:**
- Create: `packages/web/src/campaign/objectiveChips.ts`
- Create: `packages/web/tests/campaign/objectiveChips.test.ts`
- Modify: `packages/web/src/campaign/CampaignLevel.tsx` (remove the local `describeObjectives`, render chips)
- Modify: `packages/web/src/styles.css`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `interface Chip { glyph: "◆" | "◎" | "⊚"; text: string; tone: "key" | "target" | "goal"; done: boolean }` and `describeObjectives(state: CampaignLevelState): Chip[]`.

The function currently lives as a private helper at the bottom of `CampaignLevel.tsx` and returns a joined string. It moves to its own module so it can be tested, following the `ratingText.ts` precedent.

- [ ] **Step 1: Write the failing test**

Create `packages/web/tests/campaign/objectiveChips.test.ts`:

```ts
import { LEVELS, createLevel, type CampaignLevelState } from "@apogee/engine";
import { describe, expect, it } from "vitest";
import { describeObjectives } from "../../src/campaign/objectiveChips";

/** A level state built from a real level, with objective progress overridden. */
function stateFor(levelId: string, over: Partial<CampaignLevelState> = {}): CampaignLevelState {
  const level = LEVELS.find((l) => l.id === levelId);
  if (level === undefined) throw new Error(`no level ${levelId}`);
  return { ...createLevel(level), ...over };
}

describe("objective chips", () => {
  it("shows a goal-only level as one locked-or-open goal chip", () => {
    const chips = describeObjectives(stateFor("1-1"));
    expect(chips).toEqual([{ glyph: "⊚", text: "open", tone: "goal", done: false }]);
  });

  it("marks the goal done once reached", () => {
    const chips = describeObjectives(stateFor("1-1", { goalReached: true }));
    expect(chips).toEqual([{ glyph: "⊚", text: "✓", tone: "goal", done: true }]);
  });

  it("locks the goal while a key is uncollected", () => {
    const chips = describeObjectives(stateFor("3-1", { keysCollected: [false] }));
    expect(chips).toEqual([
      { glyph: "◆", text: "0/1", tone: "key", done: false },
      { glyph: "⊚", text: "locked", tone: "goal", done: false },
    ]);
  });

  it("opens the goal once every key is collected", () => {
    const chips = describeObjectives(stateFor("3-1", { keysCollected: [true] }));
    expect(chips).toEqual([
      { glyph: "◆", text: "1/1", tone: "key", done: true },
      { glyph: "⊚", text: "open", tone: "goal", done: false },
    ]);
  });

  it("counts targets and marks them done when all are hit", () => {
    const partial = describeObjectives(stateFor("4-1", { targetsHit: [true, false] }));
    expect(partial).toEqual([{ glyph: "◎", text: "1/2", tone: "target", done: false }]);
    const all = describeObjectives(stateFor("4-1", { targetsHit: [true, true] }));
    expect(all).toEqual([{ glyph: "◎", text: "2/2", tone: "target", done: true }]);
  });

  it("never emits more than three chips on any authored level", () => {
    for (const level of LEVELS) {
      expect(describeObjectives(createLevel(level)).length, level.id).toBeLessThanOrEqual(3);
    }
  });
});
```

The level ids this test leans on were verified against `levels.ts` when this plan was written: `1-1` has `keys: []`, `targets: []`, and a goal; `3-1` has exactly one key, a goal, and no targets; `4-1` has two targets, no keys, and `goal: undefined`. Note that `[].every(Boolean)` is vacuously `true`, which is why a keyless goal level reads `open` rather than `locked`. If the data has moved since, fix the **test** to match the real data rather than the data to match the test, and say so in your report.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @apogee/web exec vitest run objectiveChips`

Expected: FAIL — cannot resolve `../../src/campaign/objectiveChips`.

- [ ] **Step 3: Write the module**

Create `packages/web/src/campaign/objectiveChips.ts`:

```ts
import type { CampaignLevelState } from "@apogee/engine";

/** One HUD objective, as a glyph plus a short count or word. */
export interface Chip {
  glyph: "◆" | "◎" | "⊚";
  text: string;
  tone: "key" | "target" | "goal";
  done: boolean;
}

/**
 * The level's objectives as chips, in the order a player works them: keys
 * unlock the goal, marks are independent, the goal is last. Replaces the older
 * prose string ("keys 0/1 · goal locked"), which no longer fits a phone row.
 */
export function describeObjectives(state: CampaignLevelState): Chip[] {
  const chips: Chip[] = [];
  const { level } = state;

  if (level.keys.length > 0) {
    const got = state.keysCollected.filter(Boolean).length;
    chips.push({
      glyph: "◆",
      text: `${got}/${level.keys.length}`,
      tone: "key",
      done: got === level.keys.length,
    });
  }
  if (level.targets.length > 0) {
    const hit = state.targetsHit.filter(Boolean).length;
    chips.push({
      glyph: "◎",
      text: `${hit}/${level.targets.length}`,
      tone: "target",
      done: hit === level.targets.length,
    });
  }
  if (level.objectives.some((o) => o.kind === "reach-goal")) {
    const open = state.keysCollected.every(Boolean);
    chips.push({
      glyph: "⊚",
      text: state.goalReached ? "✓" : open ? "open" : "locked",
      tone: "goal",
      done: state.goalReached,
    });
  }
  return chips;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @apogee/web exec vitest run objectiveChips`

Expected: PASS, 6/6.

- [ ] **Step 5: Render the chips**

In `packages/web/src/campaign/CampaignLevel.tsx`:

- **Delete** the whole private `function describeObjectives(state: CampaignLevelState): string { … }` at the bottom of the file.
- Import the new one: `import { describeObjectives } from "./objectiveChips";`
- Change the memo to `const chips = useMemo(() => describeObjectives(state), [state]);`
- Replace the objective `<span>` in the HUD:

```tsx
        <span className="stat">{objectiveText}</span>
```

with:

```tsx
        <span className="stat chips">
          {chips.map((c) => (
            <span key={c.tone} className={`chip chip-${c.tone}${c.done ? " done" : ""}`}>
              {c.glyph} {c.text}
            </span>
          ))}
        </span>
```

`c.tone` is a stable, unique key: `describeObjectives` emits at most one chip per tone.

The chips stay inside the existing `.stat` span deliberately — sprint 2's `@media (max-width: 480px)` rule caps `.hud .stat:not(.pips)` at 120 px, which is exactly the spec's "chips must total ≤ 120 px on a 3-chip level" budget. Do not move them out of it.

If `CampaignLevelState` is left unused by the import after deleting the helper, drop it from the `@apogee/engine` import list.

- [ ] **Step 6: Style the chips**

In `packages/web/src/styles.css`, add immediately after the `.hud .pips` rule (before the narrow-phone media query):

```css
.hud .chips { display: inline-flex; gap: 10px; align-items: center; }
.chip { white-space: nowrap; font-variant-numeric: tabular-nums; opacity: 0.7; }
.chip.done { opacity: 1; }
.chip-key { color: #ffd54f; }
.chip-target { color: #ffb74d; }
.chip-goal { color: #80cbc4; }
```

and inside the existing `@media (max-width: 480px)` block, add:

```css
  .hud .chips { gap: 6px; }
  .chip { font-size: 0.85rem; }
```

- [ ] **Step 7: Run the web gate**

Run: `pnpm --filter @apogee/web typecheck && pnpm --filter @apogee/web test`

Expected: PASS.

- [ ] **Step 8: Measure the row**

`pnpm dev`. Unlock a three-chip level — `5-1` "Key & Marks" has keys, targets, and a goal — with

```js
localStorage.setItem("apogee-campaign-progress", JSON.stringify({"4-3":{"cleared":true,"stars":1}}))
```

then reload and open it. At 360×640, 390×844, and 1280×800 run:

```js
const hud = document.querySelector(".hud"), chips = document.querySelector(".chips");
({ hudH: hud.getBoundingClientRect().height, scrollW: hud.scrollWidth, clientW: hud.clientWidth,
   chipsW: chips.getBoundingClientRect().width, chipCount: chips.children.length })
```

Expected at every size: `chipCount` 3, `scrollW === clientW`, `hudH` ≤ 40, and `chipsW` ≤ 120. Confirm by eye that key/target/goal read gold/orange/teal and that a completed objective is brighter than an outstanding one.

- [ ] **Step 9: Commit**

```bash
git add packages/web/src/campaign/objectiveChips.ts packages/web/tests/campaign/objectiveChips.test.ts packages/web/src/campaign/CampaignLevel.tsx packages/web/src/styles.css
git commit -m "feat(web): HUD objectives as glyph chips

Keys, marks, and the goal become colour-coded chips instead of a prose string, so a three-objective level fits the phone row with room to spare. The mapping moves out of the component and gets tests.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01MiMAA1kxnLBnAYZWebTbAD"
```

---

### Task 7: Page metadata and link preview

**Files:**
- Modify: `packages/web/index.html`
- Create: `packages/web/public/og.png`

**Interfaces:** none. Pure page metadata.

- [ ] **Step 1: Write the head tags**

Replace the whole `<head>` of `packages/web/index.html` with:

```html
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Apogee</title>
    <link
      rel="icon"
      href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%2306070f'/%3E%3Ccircle cx='16' cy='16' r='9' fill='none' stroke='%2380cbc4' stroke-width='3'/%3E%3C/svg%3E"
    />
    <meta name="theme-color" content="#06070f" />
    <meta
      name="description"
      content="Apogee — a space-curling puzzle. Sling probes through gravity, dodge the void, land in the rings."
    />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="Apogee" />
    <meta
      property="og:description"
      content="Apogee — a space-curling puzzle. Sling probes through gravity, dodge the void, land in the rings."
    />
    <meta property="og:image" content="/og.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Apogee" />
    <meta
      name="twitter:description"
      content="Apogee — a space-curling puzzle. Sling probes through gravity, dodge the void, land in the rings."
    />
    <meta name="twitter:image" content="/og.png" />
  </head>
```

`og:image` stays relative until sprint 4 fixes the host, per the spec. Note in your report that it must become absolute then — most scrapers require an absolute URL.

- [ ] **Step 2: Capture the preview image**

Create `packages/web/public/` and put a 1200×630 PNG at `packages/web/public/og.png`. Vite serves `public/` at the site root, so `/og.png` resolves with no config change.

Capture it from the running app with `pnpm dev` and the Playwright MCP:

1. `browser_resize` to 1200×630.
2. Navigate to the app, then in the console unlock level 13 (`5-1` "Key & Marks", index 12):
   `localStorage.setItem("apogee-campaign-progress", JSON.stringify({"4-3":{"cleared":true,"stars":1}}))`, reload.
3. Dismiss the `5-1` intro card (Task 5 will show it) and clear the aim hint if present: `localStorage.setItem("apogee-onboarded","1")`, reload, then open the level.
4. Put the board mid-aim: press and hold on the board and drag to roughly 120 world units so the rubber band and the dashed preview arc are both on screen, and screenshot **without releasing**.
5. Save it as `packages/web/public/og.png` and confirm it is exactly 1200×630.

If holding a drag through a screenshot is not reachable with the tooling, capture the level at rest instead, say so plainly in your report, and do not fake a mid-aim frame.

- [ ] **Step 3: Verify the tags and the asset**

With `pnpm dev` running:

```js
({ icon: !!document.querySelector('link[rel=icon]'),
   desc: document.querySelector('meta[name=description]')?.content?.slice(0, 40),
   og: document.querySelector('meta[property="og:image"]')?.content,
   theme: document.querySelector('meta[name=theme-color]')?.content })
```

Then confirm `http://localhost:5173/og.png` loads and reports 1200×630, and that the browser tab shows a teal ring on a dark square.

- [ ] **Step 4: Confirm the production build carries the asset**

Run: `pnpm --filter @apogee/web build`

Expected: PASS, and `packages/web/dist/og.png` exists at 1200×630.

- [ ] **Step 5: Commit**

```bash
git add packages/web/index.html packages/web/public/og.png
git commit -m "feat(web): favicon, description, and Open Graph preview

An inline SVG ring for the tab, a description, theme-color, and a 1200x630 board capture served from public/ so a pasted link previews with an image. og:image is relative until sprint 4 sets the host.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01MiMAA1kxnLBnAYZWebTbAD"
```

---

### Task 8: Sprint verification sweep

**Files:** none new. Modify only if the sweep shakes something loose.

**Interfaces:** none. This task checks the spec's success criteria.

- [ ] **Step 1: Full gate and the engine-change guarantee**

Run: `pnpm test && pnpm --filter @apogee/web build`

Expected: engine and web suites green; the build succeeds.

Then run `pnpm typecheck`. Expected: errors **only** from the two untracked `packages/engine/tests/_*.test.ts` scratch files.

Then confirm the engine diff is exactly the intended one:

```bash
git diff --stat main..HEAD -- packages/engine
```

Expected: only `src/campaign/types.ts`, `src/campaign/levels.ts`, and `tests/campaign-levels.test.ts`. Any other engine file is a violation — report it.

- [ ] **Step 2: No canvas text, no dead references**

Run:

```bash
grep -rn "fillText\|strokeText" packages/web/src
grep -rn "objectiveText\|describeObjectives" packages/web/src
```

Expected: the first prints nothing (the no-text-on-canvas constraint holds). The second prints only the import and use in `CampaignLevel.tsx` and the definition in `objectiveChips.ts` — no leftover local helper.

- [ ] **Step 3: Success-criteria check**

With `pnpm dev` running and the Playwright MCP, from a genuinely fresh profile (`localStorage.clear()`, then reload) check each in order and record pass/fail **with the measured value**:

1. **A first-time player can launch without being told how (criterion 1).** At 390×844, Campaign → level 1. Expected: the intro card names the mechanic; dismissing it leaves the aim caption under the board and a breathing pad. Confirm the caption text and that the pad halo is present.
2. **Every mechanic is named before its first level (criterion 2).** Seed progress so every chapter opener is reachable — `localStorage.setItem("apogee-campaign-progress", JSON.stringify(Object.fromEntries(["1-3","2-3","3-3","4-3","5-3","6-3","7-3","8-3","9-3"].map((id) => [id, {cleared: true, stars: 1}]))))` — reload, then open each of `1-1, 2-1, … 10-1` and confirm all ten show a card once. Record the ten level names and that each card appeared.
3. **Landed probes are visible at arm's length (criterion 3).** At 390×844 on level 1, land a probe and measure its drawn size on screen: `const c = document.querySelector("canvas").getBoundingClientRect(); c.width / 1000 * 8 * 2` — that is the probe's on-screen diameter in CSS px for the portrait board. Record it, and screenshot the landed probe.
4. **The tab has an icon and the link previews (criterion 4).** Confirm the favicon renders and `/og.png` is 1200×630.
5. **Regression: the sprint-2 row still holds.** At 360×640 on a three-chip level, `.hud` `scrollWidth === clientWidth` and height ≤ 40.

- [ ] **Step 4: Commit anything the sweep shook loose; otherwise no commit**

```bash
git status
# only if Steps 1-3 required a fix:
git add -A packages/web packages/engine
git commit -m "fix: <what the sweep found>

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01MiMAA1kxnLBnAYZWebTbAD"
```

---

### Task 9: Playtest checkpoint (Kevin — not an agent task)

Per the roadmap, each sprint ends with a playtest before its last commit. Hand Kevin a running dev server and these questions:

1. From a cleared profile, open the game and try to launch without reading anything. Did you launch within ten seconds?
2. Do the intro cards land as useful, or as a speed bump on the way into a level you already know?
3. Is the pad now obviously the thing you shoot *from*, and the ring obviously the thing you shoot *at*?
4. Are the objective chips readable at a glance, or did you miss the prose?
5. On a phone, can you see landed probes without leaning in?

Record the answers in the sprint report. Anything that needs code becomes a follow-up task before the branch is finished.

---

## Self-review

**Spec coverage.** Every section maps to a task: §1 aim hint → Tasks 1 and 3; §2 pad emitter → Task 2; §3 intro cards → Tasks 4 (engine data) and 5 (web); §4 readability → Task 2; §5 objective chips → Task 6; §6 page metadata → Task 7; §7 testing → the test steps inside Tasks 1, 4, 5, 6 plus the manual checks in Task 8. All five success criteria are checked in Task 8 Step 3. The two spec deviations are declared in the header rather than left implicit.

**Placeholders.** None: every code step carries the code, every test step carries the assertions, and every run step carries its command and expected result. Task 7 Step 2 and Task 8 Step 4 are conditional by design, and both say exactly what to do in each branch.

**Type consistency.** `Chip` is defined once in Task 6 and used only there. `HintState` is defined in Task 3 and consumed only inside it. `padPulse` is introduced as a required prop in Task 2 with a `false` placeholder at both call sites in the same task, so the tree typechecks at every commit, and Task 3 replaces both placeholders. `intro?: string` is added to `Level` in Task 4 and read in Task 5 via `Pick<Level, "id" | "intro">`. `describeObjectives` changes return type from `string` to `Chip[]` in Task 6, and that task deletes the old local helper in the same commit.

**Level-data assumptions, checked at plan time.** Task 6's tests and Task 7's capture lean on specific levels, all four verified against `packages/engine/src/campaign/levels.ts`: `1-1` goal-only, `3-1` one key plus a goal, `4-1` two targets with `goal: undefined`, and `5-1` "Key & Marks" carrying all three objective kinds — which is why `5-1` is the three-chip level in Task 6's measurement and the board in Task 7's capture.

**One risk worth stating.** Task 7's `og.png` needs the board held mid-aim through a screenshot. If the tooling cannot hold a pointer down across a capture, the step says to shoot the level at rest and report it rather than fake the frame — a slightly duller preview image is a fair trade, and it is the only step in the sprint whose ideal output depends on driving a live gesture.
