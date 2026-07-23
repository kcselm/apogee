# Apogee Fun-Debt Sprint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make stars discriminate skill (par-based rating), make every moving level's mechanic unbypassable (ablation audit + relayouts), and make playback fixed-rate and skippable.

**Architecture:** Engine-first: rework `starRating` around a new `Level.par` field, extend the CI solvability suite to prove par is achievable, and add SOLVE-gated authoring tools (par discovery, ablation audit). Then web: a pure fixed-rate playback clock consumed by the shared `useBoardCanvas` hook, plus tap/Space skip. Spec: `docs/superpowers/specs/2026-07-22-apogee-fun-debt-design.md`.

**Tech Stack:** TypeScript, pnpm workspaces, Vitest, React 19 + canvas (no new dependencies).

## Global Constraints

- Engine `src/` numeric code uses **only `+ - * / sqrt`** (cross-engine float determinism). Trig and `Math.hypot` are allowed **only** in `tests/` and authoring helpers (`makeOrbit`, `makePortal`).
- Chapters 1–5 (`1-1`…`5-3`) and the Daily: **no layout, budget, or sim change**. Their only edit is `starThresholds` → `par` in each level literal.
- The daily golden (`packages/engine/tests/golden.test.ts` snapshot) must not change at all. The campaign golden's sim fields (`probes`, `keysCollected`, `goalReached`, `bestPrecision`, `cleared`) must stay byte-identical; only the snapshotted `stars` value may change.
- Shell is PowerShell: env vars are set as `$env:SOLVE=1; <command>`.
- Run commands from the repo root `C:\Users\kcsel\repo\apogee`.
- The working tree starts with a line-endings-only modification to `packages/engine/tests/__snapshots__/campaign-golden.test.ts.snap` (autocrlf noise). It will be legitimately regenerated in Task 1.
- Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Par-based `starRating` (engine + minimal web compile fix)

**Files:**
- Modify: `packages/engine/src/campaign/types.ts` (Level interface, ~line 55)
- Modify: `packages/engine/src/campaign/scoring.ts`
- Modify: `packages/engine/src/campaign/constants.ts` (remove `LAUNCH_BONUS`)
- Modify: `packages/engine/src/campaign/index.ts` (remove `LAUNCH_BONUS` export)
- Modify: `packages/engine/src/campaign/levels.ts` (all 30 level literals)
- Modify: `packages/engine/tests/campaign-scoring.test.ts`
- Modify: `packages/engine/tests/campaign-levels.test.ts` (within-par assertions)
- Modify: `packages/engine/tests/campaign-golden.test.ts` (both fixture levels)
- Create: `packages/engine/tests/discover-pars.test.ts`
- Modify: `packages/web/src/campaign/CampaignLevel.tsx:82-83` (drop `levelScore`)

**Interfaces:**
- Consumes: existing `CampaignLevelState`, `evaluateObjectives`.
- Produces: `Level.par: number` (replaces `starThresholds`); `starRating(state: CampaignLevelState): { stars: 0 | 1 | 2 | 3 }` (no more `levelScore`). Task 2 renders these; Tasks 4–5 update `par` for relayouted levels.

- [ ] **Step 1: Discover pars for the static levels (before any type change — the tool runs against current code)**

Create `packages/engine/tests/discover-pars.test.ts`:

```ts
import { describe, it } from "vitest";
import { LEVELS, isMovingLevel } from "../src/campaign/levels";
import { findSolution } from "./campaign-solver";

declare const process: { env: { SOLVE?: string } };

// Prints the minimal brute-force clear length per STATIC level, for authoring
// `par`. (findSolution searches depth 1..budget breadth-first, so the first
// solution found is minimal within the candidate grid.) Skipped in CI. Run:
//   $env:SOLVE=1; pnpm --filter @apogee/engine exec vitest run discover-pars
describe.skipIf(!process.env.SOLVE)("discover pars for static levels", () => {
  it("prints minimal clearing launch counts", () => {
    for (const lvl of LEVELS) {
      if (isMovingLevel(lvl)) continue;
      const sol = findSolution(lvl);
      // eslint-disable-next-line no-console
      console.log(`${lvl.id}: par ${sol ? sol.length : "UNSOLVABLE"}`);
    }
  });
});
```

- [ ] **Step 2: Run par discovery and record the printed values**

Run: `$env:SOLVE=1; pnpm --filter @apogee/engine exec vitest run discover-pars; Remove-Item Env:SOLVE`
Expected: one `<id>: par <n>` line for each of the 15 static levels (1-1…5-3). Copy these down — they go into `levels.ts` in Step 6. This is brute-force search; on a loaded machine it can take minutes (see memory note about the flaky solvability test — same solver).

- [ ] **Step 3: Rewrite the star-rating tests to the par contract (failing first)**

Replace the `level()` helper and the `starRating` describe block in `packages/engine/tests/campaign-scoring.test.ts` (keep the `precisionPoints` block unchanged):

```ts
function level(partial: Partial<Level> = {}): Level {
  return {
    id: "t", name: "t", bodies: [], keys: [], goal: { pos: { x: 1, y: 1 }, radius: 60 },
    targets: [], launchPos: { x: 0, y: 0 }, bounds: { width: 1600, height: 1000 },
    launchBudget: 4, par: 2, objectives: [{ kind: "reach-goal" }],
    ...partial,
  };
}
```

```ts
describe("starRating", () => {
  it("is 0 stars when not cleared, regardless of launches and precision", () => {
    expect(starRating(state(level(), { launchesUsed: 1, bestPrecision: 5 })).stars).toBe(0);
  });

  it("clearing over par earns exactly 1 star even with perfect precision", () => {
    const s = state(level(), { goalReached: true, launchesUsed: 3, bestPrecision: 5 });
    expect(starRating(s).stars).toBe(1);
  });

  it("clearing at par with outer-ring precision earns exactly 2 stars", () => {
    const s = state(level(), { goalReached: true, launchesUsed: 2, bestPrecision: 1 });
    expect(starRating(s).stars).toBe(2);
  });

  it("clearing under par still counts as par (2 stars without precision)", () => {
    const s = state(level(), { goalReached: true, launchesUsed: 1, bestPrecision: 0 });
    expect(starRating(s).stars).toBe(2);
  });

  it("par + inner ring (precision 3) earns 3 stars; bullseye (5) also does", () => {
    const inner = state(level(), { goalReached: true, launchesUsed: 2, bestPrecision: 3 });
    expect(starRating(inner).stars).toBe(3);
    const bull = state(level(), { goalReached: true, launchesUsed: 2, bestPrecision: 5 });
    expect(starRating(bull).stars).toBe(3);
  });

  it("precision without par caps at 1 star", () => {
    const s = state(level(), { goalReached: true, launchesUsed: 3, bestPrecision: 3 });
    expect(starRating(s).stars).toBe(1);
  });
});
```

- [ ] **Step 4: Run the scoring tests to verify they fail**

Run: `pnpm --filter @apogee/engine exec vitest run campaign-scoring`
Expected: FAIL — TypeScript errors (`par` not in `Level`, `starThresholds` missing) and/or assertion failures. Either failure mode confirms the tests exercise the new contract.

- [ ] **Step 5: Implement the par-based rating**

`packages/engine/src/campaign/types.ts` — in the `Level` interface replace:

```ts
  starThresholds: { two: number; three: number };
```

with:

```ts
  /** Optimal known launch count. Stars: 1 = clear, 2 = clear at par,
   *  3 = par AND inner-ring precision. Provable: CI asserts each level's
   *  recorded/brute-forced solution clears within par. */
  par: number;
```

`packages/engine/src/campaign/scoring.ts` — replace `starRating` (and drop the `LAUNCH_BONUS` import):

```ts
import { RINGS } from "../scoring";
import { evaluateObjectives } from "./objectives";
import type { CampaignLevelState } from "./types";

/** Bullseye points (5/3/1/0) for a probe passing `dist` from a center. */
export function precisionPoints(dist: number): number {
  for (const ring of RINGS) {
    if (dist <= ring.maxDist) return ring.points;
  }
  return 0;
}

/** Finish / efficient / perfect: 1★ = clear, 2★ = clear within par launches,
 *  3★ = 2★ plus inner-ring precision (bestPrecision ≥ 3, ≤30 units at first
 *  sensor contact). */
export function starRating(state: CampaignLevelState): { stars: 0 | 1 | 2 | 3 } {
  if (!evaluateObjectives(state).cleared) return { stars: 0 };
  if (state.launchesUsed > state.level.par) return { stars: 1 };
  return { stars: state.bestPrecision >= 3 ? 3 : 2 };
}
```

`packages/engine/src/campaign/constants.ts` — delete the `LAUNCH_BONUS` constant and its doc comment.

`packages/engine/src/campaign/index.ts` — delete the line `export { LAUNCH_BONUS } from "./constants";`.

- [ ] **Step 6: Author `par` in all 30 level literals**

In `packages/engine/src/campaign/levels.ts`, replace every `starThresholds: { ... }` with `par: <n>`:

- Static levels `1-1`…`5-3`: the values printed in Step 2.
- Moving levels, from the recorded `SOLUTIONS` sequence lengths: `6-1`: 1, `6-2`: 1, `6-3`: 1, `7-1`: 1, `7-2`: 1, `7-3`: 1, `8-1`: 1, `8-2`: 1, `8-3`: 1, `9-1`: 1, `9-2`: 2, `9-3`: 1, `10-1`: 1, `10-2`: 1, `10-3`: 2.

Example (level `1-1`):

```ts
    objectives: [{ kind: "reach-goal" }], par: 1,
```

(using whatever value Step 2 printed for `1-1` — `1` here is illustrative).

- [ ] **Step 7: Update the golden fixtures and the solvability suite**

`packages/engine/tests/campaign-golden.test.ts` — in both fixture levels (`LEVEL` line 21, `MOVING_LEVEL` line 69) replace `starThresholds: { two: 6, three: 11 },` with `par: 2,`.

`packages/engine/tests/campaign-levels.test.ts` — extend both solvability tests so par is provable:

In "every STATIC level is solvable…", after the existing budget assertion add:

```ts
      expect(solution!.length, `${lvl.id} par is aspirational`).toBeLessThanOrEqual(lvl.par);
```

In "every MOVING level clears…", after the existing budget assertion add:

```ts
      expect(seq!.length, `${lvl.id} par is aspirational`).toBeLessThanOrEqual(lvl.par);
```

- [ ] **Step 8: Fix the web compile (final copy, not a stopgap)**

`packages/web/src/campaign/CampaignLevel.tsx` line 83 — replace:

```tsx
            <div className="stat">{cleared ? `cleared — score ${rating.levelScore}` : "objective not met"}</div>
```

with:

```tsx
            <div className="stat">{cleared ? `cleared in ${state.launchesUsed}/${level.par}` : "objective not met"}</div>
```

(`rating` is still used on line 82 for the stars; `state` and `level` are already in scope.)

- [ ] **Step 9: Run the engine suite; update the campaign golden deliberately**

Run: `pnpm --filter @apogee/engine test`
Expected: everything passes except `campaign-golden` (the snapshotted `stars` value changed). Then run:

`pnpm --filter @apogee/engine exec vitest run campaign-golden -u`

and inspect `git diff packages/engine/tests/__snapshots__/campaign-golden.test.ts.snap`: **only** `stars` lines (and pre-existing line-ending normalization) may differ — `probes`, `keysCollected`, `goalReached`, `bestPrecision`, `cleared` byte-identical. If any sim field changed, STOP and debug; the rating change cannot touch the sim.

- [ ] **Step 10: Full test + typecheck, then commit**

Run: `pnpm test && pnpm typecheck`
Expected: PASS (both packages — web compiles because Step 8 removed the `levelScore` use).

```powershell
git add -A
git commit -m @'
feat(engine): par-based star rating — finish / efficient / perfect

1 star = clear, 2 = clear at par, 3 = par + inner-ring precision.
Replaces launch-bonus levelScore + per-level thresholds; par is provable
(solvability suite asserts recorded solutions clear within par).

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
'@
```

---

### Task 2: Level-complete panel explains the star criteria

**Files:**
- Create: `packages/web/src/campaign/ratingText.ts`
- Test: `packages/web/tests/campaign/ratingText.test.ts`
- Modify: `packages/web/src/campaign/CampaignLevel.tsx` (overlay panel, ~line 79-91)
- Modify: `packages/web/src/styles.css` (append)

**Interfaces:**
- Consumes: `Level.par`, `CampaignLevelState.launchesUsed/bestPrecision` from Task 1.
- Produces: `starCriteria(state: CampaignLevelState): { text: string; met: boolean }[]` — three entries, one per star tier.

- [ ] **Step 1: Write the failing test**

Create `packages/web/tests/campaign/ratingText.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { CampaignLevelState, Level } from "@apogee/engine";
import { starCriteria } from "../../src/campaign/ratingText";

function state(partial: Partial<CampaignLevelState>): CampaignLevelState {
  const level: Level = {
    id: "t", name: "t", bodies: [], keys: [], goal: { pos: { x: 1, y: 1 }, radius: 60 },
    targets: [], launchPos: { x: 0, y: 0 }, bounds: { width: 1600, height: 1000 },
    launchBudget: 4, par: 2, objectives: [{ kind: "reach-goal" }],
  };
  return {
    level, probes: [], launchesUsed: 0, keysCollected: [], targetsHit: [],
    goalReached: true, bestPrecision: 0, ...partial,
  };
}

describe("starCriteria", () => {
  it("marks all three met for a par + inner-ring clear", () => {
    const rows = starCriteria(state({ launchesUsed: 2, bestPrecision: 3 }));
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.met)).toEqual([true, true, true]);
  });

  it("marks par and precision unmet for a sloppy over-par clear", () => {
    const rows = starCriteria(state({ launchesUsed: 4, bestPrecision: 1 }));
    expect(rows.map((r) => r.met)).toEqual([true, false, false]);
  });

  it("pluralizes the par text", () => {
    const one = starCriteria(state({ launchesUsed: 1 }));
    expect(one[1]!.text).toBe("clear in 2 launches");
    const solo = starCriteria({ ...state({ launchesUsed: 1 }), level: { ...state({}).level, par: 1 } });
    expect(solo[1]!.text).toBe("clear in 1 launch");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @apogee/web exec vitest run ratingText`
Expected: FAIL — cannot resolve `../../src/campaign/ratingText`.

- [ ] **Step 3: Implement `starCriteria`**

Create `packages/web/src/campaign/ratingText.ts`:

```ts
import type { CampaignLevelState } from "@apogee/engine";

/** One row per star tier for the level-complete panel. Only rendered on a
 *  cleared level, so tier 1 is always met. */
export function starCriteria(
  state: CampaignLevelState,
): { text: string; met: boolean }[] {
  const par = state.level.par;
  return [
    { text: "clear the level", met: true },
    { text: `clear in ${par} launch${par === 1 ? "" : "es"}`, met: state.launchesUsed <= par },
    { text: "first contact in the inner ring", met: state.bestPrecision >= 3 },
  ];
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @apogee/web exec vitest run ratingText`
Expected: PASS (3 tests).

- [ ] **Step 5: Render the criteria in the overlay panel**

In `packages/web/src/campaign/CampaignLevel.tsx`, import the helper (`import { starCriteria } from "./ratingText";`) and inside the `.panel` div, after the `cleared in …` stat line, add:

```tsx
            {cleared && (
              <ul className="star-criteria">
                {starCriteria(state).map((c) => (
                  <li key={c.text} className={c.met ? "met" : "unmet"}>
                    {c.met ? "★" : "☆"} {c.text}
                  </li>
                ))}
              </ul>
            )}
```

Append to `packages/web/src/styles.css`:

```css
.star-criteria { list-style: none; padding: 0; margin: 0.5rem 0 0; font-size: 0.85rem; text-align: left; }
.star-criteria .met { color: #ffd54f; }
.star-criteria .unmet { color: #5c6b8a; }
```

- [ ] **Step 6: Verify and commit**

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

```powershell
git add -A
git commit -m @'
feat(web): level-complete panel teaches the star criteria

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
'@
```

---

### Task 3: Portal fast-follow tests (cooldown window + self-link guard)

**Files:**
- Modify: `packages/engine/tests/campaign-portal.test.ts` (append a describe block)
- Modify: `packages/engine/tests/campaign-levels.test.ts` (pairing test, ~line 24-33)

**Interfaces:**
- Consumes: `simulateCampaignLaunch`, `createLevel`, `makePortal`, `PORTAL_COOLDOWN` — all existing engine exports. No new production code; these tests must pass against the current sim.

- [ ] **Step 1: Add the self-link assertion to the pairing test**

In `packages/engine/tests/campaign-levels.test.ts`, inside the `ps.forEach((p, i) => { ... })` of "every portal links to a valid, mutually-paired portal", add:

```ts
        expect(p.link, `${lvl.id} portal ${i} self-link`).not.toBe(i);
```

- [ ] **Step 2: Append the direct cooldown test**

Append to `packages/engine/tests/campaign-portal.test.ts`:

```ts
import { PORTAL_COOLDOWN } from "../src/campaign/constants";
import { createLevel, simulateCampaignLaunch } from "../src/campaign/simulate";
import type { Level } from "../src/campaign/types";

/** Steps at which the probe teleported = trace frames where it moved >100 units. */
function jumpSteps(trace: { x: number; y: number }[][]): number[] {
  const out: number[] = [];
  for (let i = 1; i < trace.length; i++) {
    const a = trace[i - 1]![0]!;
    const b = trace[i]![0]!;
    if (Math.hypot(b.x - a.x, b.y - a.y) > 100) out.push(i);
  }
  return out;
}

describe("portal re-entry cooldown", () => {
  // Empty space, two mouths both facing -x. A probe flying +x enters A head-on,
  // exits B travelling +x INTO B's own disc (exit rotation maps -x → +x), and
  // would instantly re-teleport every step without the guard. At drag 100
  // (300 u/s = 5 u/step) it needs ~14 steps to cross B's 35-unit contact
  // reach, so the cooldown expires mid-disc and a legitimate re-teleport
  // fires — the gap between jumps is exactly the guard window, never 1.
  const LEVEL: Level = {
    id: "cd", name: "cd", bodies: [], keys: [],
    goal: { pos: { x: 1500, y: 900 }, radius: 30 }, targets: [],
    launchPos: { x: 100, y: 500 }, bounds: { width: 1600, height: 1000 },
    launchBudget: 1, par: 1, objectives: [{ kind: "reach-goal" }],
    portals: [makePortal(600, 500, 30, 180, 1), makePortal(1100, 500, 30, 180, 0)],
  };

  it("never re-teleports within the cooldown window", () => {
    const { trace } = simulateCampaignLaunch(createLevel(LEVEL), { dx: 100, dy: 0 }, 400);
    const jumps = jumpSteps(trace);
    expect(jumps.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < jumps.length; i++) {
      expect(jumps[i]! - jumps[i - 1]!).toBeGreaterThan(PORTAL_COOLDOWN);
    }
  });

  it("does re-teleport once the cooldown expires while still inside a mouth", () => {
    const { trace } = simulateCampaignLaunch(createLevel(LEVEL), { dx: 100, dy: 0 }, 400);
    const jumps = jumpSteps(trace);
    // The probe crosses B's disc slower than the guard window, so at least one
    // consecutive pair of jumps sits exactly at the first legal step.
    const gaps = jumps.slice(1).map((s, i) => s - jumps[i]!);
    expect(Math.min(...gaps)).toBe(PORTAL_COOLDOWN + 1);
  });
});
```

(`Math.hypot` is fine here — test code.)

- [ ] **Step 3: Run both test files**

Run: `pnpm --filter @apogee/engine exec vitest run campaign-portal campaign-levels`
Expected: PASS. If the second cooldown test's `Math.min(...gaps)` is not exactly `PORTAL_COOLDOWN + 1`, print `jumps` and check the geometry against the comment (speed must be 5 u/step: drag 100 × POWER_SCALE 3 = 300 u/s × DT 1/60); adjust the launch `dx` (not the sim!) so the disc crossing outlasts the guard.

- [ ] **Step 4: Commit**

```powershell
git add packages/engine/tests/campaign-portal.test.ts packages/engine/tests/campaign-levels.test.ts
git commit -m @'
test(engine): direct portal cooldown-window test + self-link pairing guard

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
'@
```

---

### Task 4: Ablation audit tool

**Files:**
- Create: `packages/engine/tests/ablation-audit.test.ts`

**Interfaces:**
- Consumes: `findTimedSolution` from `./campaign-solver-timed`, `LEVELS`/`isMovingLevel`.
- Produces: a console report — `BYPASSABLE <sequence>` / `mechanic required` / `sensor-motion level — audit n/a` per moving level. Task 5 consumes the flagged list.

- [ ] **Step 1: Write the audit tool**

Create `packages/engine/tests/ablation-audit.test.ts`:

```ts
import { describe, it } from "vitest";
import { LEVELS, isMovingLevel } from "../src/campaign/levels";
import type { Level } from "../src/campaign/types";
import { findTimedSolution } from "./campaign-solver-timed";

declare const process: { env: { SOLVE?: string } };

/** The level with its signature mechanic deleted: orbiting bodies keep their
 *  position, radius, and collision but lose gravity (mass 0); portals are
 *  removed. Orbiting keys/targets are objectives, not mechanics — untouched. */
function ablate(lvl: Level): Level {
  return {
    ...lvl,
    bodies: lvl.bodies.map((b) => (b.orbit ? { ...b, mass: 0 } : b)),
    portals: undefined,
  };
}

// A moving level is BYPASSABLE if it clears with its mechanic deleted.
// Spec target: every flagged level gets relayouted until this prints clean.
// Skipped in CI (brute-force). Run:
//   $env:SOLVE=1; pnpm --filter @apogee/engine exec vitest run ablation-audit
describe.skipIf(!process.env.SOLVE)("ablation audit — moving levels", () => {
  it("prints any level clearable without its mechanic", () => {
    for (const lvl of LEVELS) {
      if (!isMovingLevel(lvl)) continue;
      const hasMechanic =
        lvl.bodies.some((b) => b.orbit != null) || (lvl.portals?.length ?? 0) > 0;
      if (!hasMechanic) {
        // eslint-disable-next-line no-console
        console.log(`${lvl.id}: sensor-motion level — audit n/a`);
        continue;
      }
      const bypass = findTimedSolution(ablate(lvl));
      // eslint-disable-next-line no-console
      console.log(
        `${lvl.id}: ${bypass ? `BYPASSABLE (${bypass.length} launches) ` + JSON.stringify(bypass) : "mechanic required"}`,
      );
    }
  });
});
```

- [ ] **Step 2: Verify it's skipped in CI**

Run: `pnpm --filter @apogee/engine exec vitest run ablation-audit`
Expected: the suite reports skipped (no `SOLVE`), exit 0.

- [ ] **Step 3: Run the audit for real and record the report**

Run: `$env:SOLVE=1; pnpm --filter @apogee/engine exec vitest run ablation-audit; Remove-Item Env:SOLVE`
Expected: a line per moving level. Expect `7-2` and `7-3` as `audit n/a` (orbiting sensors only). Save the full report — it is Task 5's work list. This is a broad brute-force sweep; allow several minutes.

- [ ] **Step 4: Commit**

```powershell
git add packages/engine/tests/ablation-audit.test.ts
git commit -m @'
test(engine): SOLVE-gated ablation audit — flags mechanic-bypassable levels

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
'@
```

---

### Task 5: Relayout every flagged level until its mechanic is required

**Files:**
- Modify: `packages/engine/src/campaign/levels.ts` (only levels flagged BYPASSABLE in Task 4 — all in chapters 6–10)
- Modify: `packages/engine/src/campaign/solutions.ts` (re-discovered sequences for relayouted levels)

**Interfaces:**
- Consumes: Task 4's audit report (the BYPASSABLE list with bypass sequences).
- Produces: updated level literals, `SOLUTIONS` entries, and `par` values. All CI tests stay green; the audit prints clean.

This task is a per-level tuning loop, not a single edit. The bypass sequence printed by the audit tells you *how* the level is being cheated (usually a straight or single-bend launch that ignores the moon/portal). For each flagged level:

- [ ] **Step 1: Break the bypass geometrically**

Edit the level literal in `packages/engine/src/campaign/levels.ts` using these patterns (chapter themes and the ladder's difficulty beats from the moving-mechanics spec must survive):

- **Moon levels (ch 6, 7, 10):** put the goal/last target in the parent planet's gravity shadow relative to the launch pad, or seal the straight corridor with a `blocker(...)` so only a moon-assisted bend gets through. Example shape (illustrative numbers — the audit is the referee): for `6-1`, moving the goal from `(1250, 360)` to behind the planet at `(1050, 760)` and adding `blocker(1150, 560, 48)` kills straight approaches from `(80, 500)`.
- **Portal levels (ch 8, 9, 10):** wall the direct route so the wormhole is the only door — e.g. a blocker line across the corridor between launch and goal, with the portal mouth on the near side.
- Prefer adding/moving one blocker or shifting the goal over reshaping the whole level; small edits keep the level recognizable.

- [ ] **Step 2: Re-audit just that level's change**

Run: `$env:SOLVE=1; pnpm --filter @apogee/engine exec vitest run ablation-audit; Remove-Item Env:SOLVE`
Expected: the edited level now prints `mechanic required`. If it still prints BYPASSABLE, the printed sequence shows the new hole — iterate Step 1. **Escape hatch (from the spec):** if geometry can't forbid a brute-force bypass without becoming contrived, `BYPASSABLE (n launches)` with `n ≥ par + 2` is acceptable — record it as a comment on the level literal, e.g. `// ablation: bypassable only at 4 launches (par 1) — accepted 2026-07-22`.

- [ ] **Step 3: Re-discover the level's solution and par**

Delete the relayouted level's entry from `packages/engine/src/campaign/solutions.ts` (the discovery tool only fills missing ids), then:

Run: `$env:SOLVE=1; pnpm --filter @apogee/engine exec vitest run discover-solutions; Remove-Item Env:SOLVE`
Expected: a `"<id>": [...],` line — paste it into `SOLUTIONS`. If it prints `UNSOLVABLE`, the relayout is too hard — loosen it and go back to Step 2. Set the level's `par` to the new sequence length. If the new sequence length exceeds the old `launchBudget - 1`, also raise `launchBudget` to `par + 2` (generous-budget philosophy: casual players get slack; stars carry the pressure).

- [ ] **Step 4: Repeat Steps 1–3 for every flagged level, then run the full engine suite**

Run: `pnpm --filter @apogee/engine test`
Expected: PASS — in particular "every MOVING level clears when its stored solution is replayed" and the within-par assertions from Task 1. The campaign golden must NOT change in this task (fixtures are self-contained).

- [ ] **Step 5: Commit**

```powershell
git add packages/engine/src/campaign/levels.ts packages/engine/src/campaign/solutions.ts
git commit -m @'
feat(engine): relayout bypassable moving levels — mechanics now required

Every chapter 6-10 level survives the ablation audit (or carries a
documented accepted exception). Solutions re-discovered, pars updated.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
'@
```

---

### Task 6: Fixed-rate playback clock (pure module + hook integration)

**Files:**
- Create: `packages/web/src/space/playback.ts`
- Test: `packages/web/tests/space/playback.test.ts`
- Modify: `packages/web/src/space/useBoardCanvas.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `SIM_HZ = 60`, `MAX_CATCHUP_STEPS = 5`, `createPlaybackClock(): PlaybackClock`, `advanceClock(clock: PlaybackClock, nowMs: number): number` (whole sim steps owed this frame). Task 7 modifies the same hook.

- [ ] **Step 1: Write the failing clock tests**

Create `packages/web/tests/space/playback.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MAX_CATCHUP_STEPS, SIM_HZ, advanceClock, createPlaybackClock } from "../../src/space/playback";

const FRAME = 1000 / SIM_HZ;

describe("playback clock", () => {
  it("emits exactly one step per frame at 60 Hz", () => {
    const c = createPlaybackClock();
    expect(advanceClock(c, 0)).toBe(0); // first call only anchors the clock
    let total = 0;
    for (let k = 1; k <= 60; k++) total += advanceClock(c, k * FRAME);
    expect(total).toBe(60);
  });

  it("emits ~one step every other frame at 120 Hz (60 steps over a second)", () => {
    const c = createPlaybackClock();
    advanceClock(c, 0);
    let total = 0;
    for (let k = 1; k <= 120; k++) total += advanceClock(c, (k * 1000) / 120);
    expect(total).toBeGreaterThanOrEqual(59);
    expect(total).toBeLessThanOrEqual(60);
  });

  it("emits two steps per frame at 30 Hz", () => {
    const c = createPlaybackClock();
    advanceClock(c, 0);
    expect(advanceClock(c, 1000 / 30)).toBe(2);
  });

  it("clamps catch-up after a stall and drops the excess", () => {
    const c = createPlaybackClock();
    advanceClock(c, 0);
    expect(advanceClock(c, 5000)).toBe(MAX_CATCHUP_STEPS);
    // The stall is discarded, not replayed: the next normal frame owes 1 step.
    expect(advanceClock(c, 5000 + FRAME)).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @apogee/web exec vitest run playback`
Expected: FAIL — cannot resolve `../../src/space/playback`.

- [ ] **Step 3: Implement the clock**

Create `packages/web/src/space/playback.ts`:

```ts
/** Fixed-rate sim clock: converts rAF wall-clock timestamps into whole sim
 *  steps at SIM_HZ, independent of display refresh rate. */
export const SIM_HZ = 60;
const STEP_MS = 1000 / SIM_HZ;
/** Cap per-frame catch-up so a stall (tab switch, GC) skips instead of
 *  fast-forwarding the board. */
export const MAX_CATCHUP_STEPS = 5;
/** Guard against float error when timestamps are exact STEP_MS multiples. */
const EPSILON = 1e-6;

export interface PlaybackClock {
  last: number | null;
}

export function createPlaybackClock(): PlaybackClock {
  return { last: null };
}

/** Whole steps owed at `nowMs`. First call anchors the clock and returns 0. */
export function advanceClock(clock: PlaybackClock, nowMs: number): number {
  if (clock.last === null) {
    clock.last = nowMs;
    return 0;
  }
  const steps = Math.floor((nowMs - clock.last) / STEP_MS + EPSILON);
  if (steps <= 0) return 0;
  if (steps > MAX_CATCHUP_STEPS) {
    clock.last = nowMs;
    return MAX_CATCHUP_STEPS;
  }
  clock.last += steps * STEP_MS;
  return steps;
}
```

- [ ] **Step 4: Run the clock tests**

Run: `pnpm --filter @apogee/web exec vitest run playback`
Expected: PASS (4 tests).

- [ ] **Step 5: Drive the hook from the clock**

In `packages/web/src/space/useBoardCanvas.ts`:

1. Import: `import { advanceClock, createPlaybackClock } from "./playback";`
2. Add a ref beside the others: `const clockRef = useRef(createPlaybackClock());`
3. In the new-animation detection block (the `if (opts.anim !== animRef.current) {` body), add `clockRef.current = createPlaybackClock();` so a fresh launch never inherits a stall.
4. In `render(time)`, compute the owed steps once at the top: `const steps = motion ? advanceClock(clockRef.current, time) : 0;` — note `motion` is computed just above, so move the `const motion = ...` line before it if needed.
5. **Anim branch:** replace the single-frame advance. Currently the code draws frame `i` then does `frameIdxRef.current++`. Change it to consume `steps` frames per rAF, keeping the trail dense and the transition detection per consumed frame:

```ts
      if (anim) {
        // Consume `steps` sim frames this display frame (0 repeats the frame
        // on high-Hz displays; >1 catches up on low-Hz ones).
        for (let s = 0; s < steps && frameIdxRef.current < anim.length - 1; s++) {
          const f = anim[frameIdxRef.current]?.[adapter.probeIndex];
          if (f && motion && f.state === "flying") pushTrail(trailRef.current, f.x, f.y);
          frameIdxRef.current++;
        }
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
        if (frameIdxRef.current >= anim.length - 1) {
          tickRef.current = animStartTickRef.current + anim.length;
          animRef.current = null;
          clearTrail(trailRef.current);
          cbRef.current.onAnimDone();
        }
      }
```

Keep the existing draw-opts object exactly as it is today (`probeFrames`, `previewPath: null`, etc.). Note the completion condition becomes `>= anim.length - 1` *after drawing* the final frame — the final frame is always both processed and drawn, and `steps === 0` frames simply redraw the current frame.

⚠️ In reduced-motion mode `steps` is 0 and the anim would never finish — preserve the old behavior by making reduced motion jump straight to the end: before the `for` loop add `if (!motion) frameIdxRef.current = anim.length - 1;`. (Today reduced-motion playback advances one frame per rAF with no trail; jumping to the end is the spec's skip behavior and strictly kinder.)

6. **Idle branch:** replace `if (motion) tickRef.current++;` with `tickRef.current += steps;` (the board clock also stops running double-speed on 120 Hz displays while aiming — same bug, same fix).

- [ ] **Step 6: Full verification + manual check**

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

Manual: `pnpm dev`, open the printed URL, fire a launch on the Daily and on campaign `6-1`. The flight should play at the same speed it used to on a 60 Hz display; the aim preview and moon orbits unchanged. (The 120 Hz half of the claim is verified at the Task 9 playtest.)

- [ ] **Step 7: Commit**

```powershell
git add -A
git commit -m @'
fix(web): fixed 60 Hz playback and board clock, decoupled from display refresh

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
'@
```

---

### Task 7: Skip control + "tap to skip" hint

**Files:**
- Modify: `packages/web/src/space/useBoardCanvas.ts`

**Interfaces:**
- Consumes: Task 6's hook structure (`clockRef`, frame-consume loop, completion at `anim.length - 1`).
- Produces: user-facing behavior only — tap/click/Space during playback lands the end state instantly; a hint appears after 2 s. No API change.

- [ ] **Step 1: Implement skip + hint in the hook**

In `packages/web/src/space/useBoardCanvas.ts`:

1. Add a ref: `const animStartTimeRef = useRef<number | null>(null);` and reset it in the new-animation detection block: `animStartTimeRef.current = null;`.
2. Inside the effect, define skip (after `computePreview`):

```ts
    const SKIP_HINT_MS = 2000;
    const skipAnim = () => {
      const anim = animRef.current;
      if (!anim) return;
      frameIdxRef.current = anim.length - 1;
      clearTrail(trailRef.current);
      kick();
    };
```

(The next `render()` draws the final frame, fires the terminal burst via the existing state-transition check, and completes — determinism untouched because the trace was precomputed at launch.)

3. In the anim branch of `render`, first line: `animStartTimeRef.current ??= time;` and after `adapter.draw(ctx, {...})` add the hint:

```ts
        if (motion && animStartTimeRef.current !== null && time - animStartTimeRef.current > SKIP_HINT_MS) {
          ctx.save();
          ctx.font = "26px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
          ctx.fillText("tap to skip", opts.worldWidth / 2, opts.worldHeight - 36);
          ctx.restore();
        }
```

4. In `onDown`, route taps during playback to skip instead of ignoring them:

```ts
    const onDown = (e: PointerEvent) => {
      if (animRef.current) {
        skipAnim();
        return;
      }
      if (cbRef.current.disabled) return;
      canvas.setPointerCapture(e.pointerId);
      dragRef.current = { dx: 0, dy: 0 };
      kick();
    };
```

5. Add a Space handler beside the other listeners (registered and cleaned up with them):

```ts
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" && animRef.current) {
        e.preventDefault();
        skipAnim();
      }
    };
    window.addEventListener("keydown", onKey);
```

and in the cleanup: `window.removeEventListener("keydown", onKey);`.

- [ ] **Step 2: Verify**

Run: `pnpm test && pnpm typecheck`
Expected: PASS.

Manual: `pnpm dev` — fire a slow orbiting launch on the Daily; after ~2 s the hint appears; tapping (and separately Space) lands the end state immediately, the landing/lost burst still fires, and the next launch aims normally. Repeat once on campaign `6-1`.

- [ ] **Step 3: Commit**

```powershell
git add packages/web/src/space/useBoardCanvas.ts
git commit -m @'
feat(web): tap/Space to skip playback, with a 2s "tap to skip" hint

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
'@
```

---

### Task 8: Sprint verification sweep

**Files:** none created — verification only.

- [ ] **Step 1: Dead-reference sweep**

Run: `git grep -nE "starThresholds|LAUNCH_BONUS|levelScore" -- packages`
Expected: zero matches, exit code 1 (docs/ may still mention them; packages must not).

- [ ] **Step 2: Golden guarantees**

Run: `git diff main -- packages/engine/tests/__snapshots__/` (against the branch point if working on a feature branch: `git diff $(git merge-base main HEAD) -- packages/engine/tests/__snapshots__/`)
Expected: `golden.test.ts.snap` (daily) absent from the diff entirely; `campaign-golden.test.ts.snap` shows only `stars` value changes (plus line-ending normalization). If anything else moved, bisect the offending task before proceeding.

- [ ] **Step 3: Full suite, typecheck, and the audit's final word**

Run: `pnpm test && pnpm typecheck`
Expected: PASS.
Run: `$env:SOLVE=1; pnpm --filter @apogee/engine exec vitest run ablation-audit; Remove-Item Env:SOLVE`
Expected: every line `mechanic required`, `audit n/a`, or a documented accepted exception from Task 5.

- [ ] **Step 4: Commit anything the sweep shook loose; otherwise no commit**

---

### Task 9: Playtest checkpoint (Kevin — not an agent task)

The sprint is not done until this passes. Run `pnpm dev` and play chapters 6–10 start to finish, judging:

1. **Necessity:** did you actually use the moon/portal on each level, or did a lazy shot still work?
2. **Stars:** did 3★ take real attempts on at least several levels (par + inner ring should be *earned*)? Did any level's par feel impossible rather than hard?
3. **Feel:** does the slingshot read well? Does the honest preview "breathe" with the moving field? Do relayouted levels still teach gently at each chapter intro?
4. **Playback:** correct speed on your display; skip works by tap and Space; the hint shows on long flights; reduce-motion (Windows Settings → Accessibility → Visual effects → Animation effects off) still lands results instantly.

Findings become data-only tuning commits (budgets, pars, layouts — with `SOLVE=1` re-discovery for any layout change, per Task 5 Steps 2–3). When satisfied, update the memory files (`apogee-roadmap`, `apogee-moving-mechanics-deferred-items`) to mark the fun-debt sprint complete.
