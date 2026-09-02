# Apogee Stars & Flight End Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make 3★ a real, attainable tier on every level by scoring precision as closest approach, and stop making the player watch a flight after the level is already cleared.

**Architecture:** Engine-first. `simulateCampaignLaunch` gains per-sensor "pass" bookkeeping (track the minimum center distance while the triggering probe stays inside the sensor zone) and an additive `clearedAtStep` on its result; `starRating` moves the 3★ bar to the bullseye ring. Sim state is untouched, so goldens' sim fields stay byte-identical. Then web: a pure `trimToClear` shortens what the board plays back, and the board pushes a teal "clear" burst at the clearing frame. Spec: `docs/superpowers/specs/2026-09-01-apogee-stars-flight-end-design.md`.

**Tech Stack:** TypeScript 5, Vitest 3, React 19, Vite 7, pnpm workspaces. Engine has zero runtime deps.

**Spec:** `docs/superpowers/specs/2026-09-01-apogee-stars-flight-end-design.md`

## Global Constraints

- Branch from `feat/fun-debt` (fun-debt Task 1, par-based stars, is not on `main` yet): `git switch -c feat/stars-flight-end feat/fun-debt`. Prefer a worktree; the two untracked `packages/engine/tests/_*.test.ts` scratch files in the main tree break `pnpm typecheck` until sprint 4 excludes them, so in the main tree expect `tsc` errors **only** from those two files.
- Engine numeric code uses only `+ − × ÷ sqrt` (and `Math.min`/`Math.max`, already used). No trig, no `Math.pow`, no randomness.
- Changes to the launch result are additive: `{ state, trace, events }` keep their shapes; `clearedAtStep: number | null` is added.
- `packages/engine/tests/golden.test.ts` (daily) must never change. In `campaign-golden.test.ts` the `probes`, `keysCollected`, `goalReached`, `cleared` snapshot fields must stay byte-identical; only `bestPrecision` and `stars` may change, in one deliberate commit.
- Pars are unchanged. Levels are unchanged. No daily-mode change.
- Star rule after this sprint: `0★` not cleared · `1★` cleared · `2★` cleared AND `launchesUsed ≤ par` · `3★` 2★ AND `bestPrecision ≥ 5` (closest approach ≤ 14 units).
- `CLEAR_TAIL = 36` frames (0.6 s at 60 Hz) of playback after the clearing step.
- Run tests from the repo root with `pnpm --filter @apogee/engine exec vitest run <name>` / `pnpm --filter @apogee/web exec vitest run <name>`; the full gate is `pnpm test && pnpm typecheck`.
- End every commit message with the line `Claude-Session: https://claude.ai/code/session_01TW4Nrj1k3d1ArAR492tDDM`.

---

## File structure

| File | Responsibility | Change |
|---|---|---|
| `packages/engine/src/campaign/simulate.ts` | one campaign launch: physics loop + sensors + portals | pass bookkeeping, `clearedAtStep`, exported `CampaignLaunchResult` |
| `packages/engine/src/campaign/objectives.ts` | objective evaluation | extract `allObjectivesMet` so the sim can ask "cleared yet?" without building a state |
| `packages/engine/src/campaign/scoring.ts` | precision ring lookup + star rule | 3★ threshold `≥ 5` |
| `packages/engine/src/campaign/types.ts` | campaign data types | doc comment on `Level.par` |
| `packages/engine/src/campaign/index.ts` | public campaign surface | export `allObjectivesMet`, `type CampaignLaunchResult` |
| `packages/engine/tests/campaign-simulate.test.ts` | launch behaviour | closest-approach + `clearedAtStep` tests |
| `packages/engine/tests/campaign-scoring.test.ts` | star boundaries | rewrite the precision-3 case |
| `packages/engine/tests/campaign-objectives.test.ts` | objectives | `allObjectivesMet` cases |
| `packages/engine/tests/__snapshots__/campaign-golden.test.ts.snap` | determinism lock | `bestPrecision`/`stars` only |
| `packages/web/src/space/playback.ts` | pure playback helpers (fun-debt Task 6 adds the clock here later) | new: `CLEAR_TAIL`, `trimToClear` |
| `packages/web/src/space/effects.ts` | burst effects | `kind` gains `"clear"` |
| `packages/web/src/space/useBoardCanvas.ts` | board input + playback loop | `clearAt` prop → clear burst |
| `packages/web/src/render.ts` | canvas drawing | teal clear burst |
| `packages/web/src/campaign/CampaignCanvas.tsx`, `GameCanvas.tsx` | board adapters | pass `clearAt` |
| `packages/web/src/campaign/CampaignLevel.tsx` | level play loop | trim the trace, carry `clearAt` |
| `packages/web/src/campaign/ratingText.ts` | level-complete criteria rows | bullseye wording + threshold |
| `packages/web/tests/space/playback.test.ts`, `tests/campaign/ratingText.test.ts` | web unit tests | new / updated |

---

### Task 1: Closest-approach precision (engine)

**Files:**
- Modify: `packages/engine/src/campaign/simulate.ts` (the sensor pass in step 3, the post-loop, the return)
- Test: `packages/engine/tests/campaign-simulate.test.ts`

**Interfaces:**
- Consumes: `precisionPoints(dist)` from `./scoring` (5 / 3 / 1 / 0 for ≤ 14 / ≤ 30 / ≤ 55 / else); `within`, `distTo` helpers already in `simulate.ts`.
- Produces: unchanged signature `simulateCampaignLaunch(state, input, maxSteps?) → { state, trace, events }`; `state.bestPrecision` now reflects closest approach during each triggering pass.

Straight-line flight facts used by every test below: with no bodies, `{ dx: 200, dy: 0 }` launches at the 600 u/s cap from (80, 500), so trace frame `i` has the probe at `x = 90 + 10·i, y = 500`, and the probe is lost to the void at frame 172. A sensor of radius `r` triggers when the probe is within `r + 5` (PROBE_RADIUS) of its center.

- [ ] **Step 1: Write the failing tests**

Append to `packages/engine/tests/campaign-simulate.test.ts`:

```ts
describe("closest-approach precision", () => {
  const goalLevel = (gx: number, gy: number, radius = 30): Level =>
    base({ goal: { pos: { x: gx, y: gy }, radius }, objectives: [{ kind: "reach-goal" }] });

  it("a straight pass through the goal center scores the bullseye (not first contact)", () => {
    // First contact is at x=670 (30 units out → 3 under the old rule); closest approach is 0.
    const r = simulateCampaignLaunch(createLevel(goalLevel(700, 500)), { dx: 200, dy: 0 });
    expect(r.state.goalReached).toBe(true);
    expect(r.state.bestPrecision).toBe(5);
    expect(r.events).toEqual([{ step: 58, type: "goal", index: 0 }]); // trigger step unchanged
  });

  it("a pass 12 units off-center still scores the bullseye", () => {
    // Old rule: first contact at (670, 500) is 32.3 units out → 1 point.
    const r = simulateCampaignLaunch(createLevel(goalLevel(700, 512)), { dx: 200, dy: 0 });
    expect(r.state.bestPrecision).toBe(5);
  });

  it("a pass 20 units off-center scores the inner ring", () => {
    const r = simulateCampaignLaunch(createLevel(goalLevel(700, 520)), { dx: 200, dy: 0 });
    expect(r.state.bestPrecision).toBe(3);
  });

  it("a graze 33 units off-center scores the outer ring", () => {
    const r = simulateCampaignLaunch(createLevel(goalLevel(700, 533)), { dx: 200, dy: 0 });
    expect(r.state.goalReached).toBe(true);
    expect(r.state.bestPrecision).toBe(1);
  });

  it("a probe that lands inside a surface goal closes its pass at launch end", () => {
    // Planet at (800,500) r60: the probe snaps to (735,500). Goal center (735,520) → 20 units → 3.
    const lvl = base({
      bodies: [{ pos: { x: 800, y: 500 }, radius: 60, mass: 3600, kind: "planet" }],
      goal: { pos: { x: 735, y: 520 }, radius: 30 },
      objectives: [{ kind: "reach-goal" }],
    });
    const r = simulateCampaignLaunch(createLevel(lvl), { dx: 200, dy: 0 });
    expect(r.state.probes[0]!.state).toBe("landed");
    expect(r.state.probes[0]!.pos.x).toBeCloseTo(735, 6);
    expect(r.state.bestPrecision).toBe(3);
  });

  it("each target crossed in one flight gets its own pass; bestPrecision is the max", () => {
    // Target 0 at (400,520) r20: closest 20 → 3. Target 1 at (700,512) r20: closest 12 → 5.
    const lvl = base({
      targets: [{ pos: { x: 400, y: 520 }, radius: 20 }, { pos: { x: 700, y: 512 }, radius: 20 }],
      objectives: [{ kind: "hit-all-targets" }],
    });
    const r = simulateCampaignLaunch(createLevel(lvl), { dx: 200, dy: 0 });
    expect(r.state.targetsHit).toEqual([true, true]);
    expect(r.state.bestPrecision).toBe(5);
    expect(r.events.map((e) => e.index)).toEqual([0, 1]);
  });

  it("a reached goal never re-triggers, and a later launch cannot lower bestPrecision", () => {
    const r1 = simulateCampaignLaunch(createLevel(goalLevel(700, 512)), { dx: 200, dy: 0 });
    expect(r1.state.bestPrecision).toBe(5);
    const r2 = simulateCampaignLaunch(r1.state, { dx: 200, dy: 0 });
    expect(r2.events).toEqual([]);
    expect(r2.state.bestPrecision).toBe(5);
    expect(r2.state.launchesUsed).toBe(2);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @apogee/engine exec vitest run campaign-simulate`

Expected: the first two new tests and the target test FAIL (`expected 3 to be 5`, `expected 1 to be 5`, `expected 3 to be 5`); the others may pass by coincidence. Existing tests still pass.

- [ ] **Step 3: Implement pass bookkeeping in `simulate.ts`**

Add after the `Moving` helpers (before `simulateCampaignLaunch`):

```ts
/** An open precision pass: the probe that triggered a sensor and its closest
 *  approach to the center so far. Closed (folded into bestPrecision) when that
 *  probe leaves the sensor zone or the launch ends. */
interface Pass {
  probe: number;
  minDist: number;
}
```

Inside `simulateCampaignLaunch`, after `let bestPrecision = state.bestPrecision;` add:

```ts
  // Precision passes (per launch). Keys carry no precision.
  const targetPass: (Pass | null)[] = level.targets.map(() => null);
  let goalPass: Pass | null = null;
  const closePass = (p: Pass): void => {
    bestPrecision = Math.max(bestPrecision, precisionPoints(p.minDist));
  };
```

Replace the whole `// 3. Sensors` block (from `// 3. Sensors (keys → targets → goal)` through the closing `}` of its `for (const probe of probes)` loop) with:

```ts
    // 3. Sensors (keys → targets → goal), read at their current positions.
    //    Targets and the goal track closest approach while the triggering probe
    //    stays inside the zone; that minimum becomes the pass's precision.
    for (let pi = 0; pi < probes.length; pi++) {
      const probe = probes[pi]!;
      if (probe.state === "lost") continue;
      keyM.forEach((k, i) => {
        if (!keysCollected[i] && within(probe, k.pos.x, k.pos.y, level.keys[i]!.radius + PROBE_RADIUS)) {
          keysCollected[i] = true;
          events.push({ step, type: "key", index: i });
        }
      });
      targetM.forEach((t, i) => {
        const inside = within(probe, t.pos.x, t.pos.y, level.targets[i]!.radius + PROBE_RADIUS);
        if (!targetsHit[i]) {
          if (inside) {
            targetsHit[i] = true;
            targetPass[i] = { probe: pi, minDist: distTo(probe, t.pos.x, t.pos.y) };
            events.push({ step, type: "target", index: i });
          }
          return;
        }
        const pass = targetPass[i];
        if (!pass || pass.probe !== pi) return;
        if (inside) {
          pass.minDist = Math.min(pass.minDist, distTo(probe, t.pos.x, t.pos.y));
        } else {
          closePass(pass);
          targetPass[i] = null;
        }
      });
      if (level.goal) {
        const g = level.goal;
        const inside = within(probe, g.pos.x, g.pos.y, g.radius + PROBE_RADIUS);
        if (!goalReached) {
          if (inside && keysCollected.every(Boolean)) {
            goalReached = true;
            goalPass = { probe: pi, minDist: distTo(probe, g.pos.x, g.pos.y) };
            events.push({ step, type: "goal", index: 0 });
          }
        } else if (goalPass && goalPass.probe === pi) {
          if (inside) {
            goalPass.minDist = Math.min(goalPass.minDist, distTo(probe, g.pos.x, g.pos.y));
          } else {
            closePass(goalPass);
            goalPass = null;
          }
        }
      }
    }
```

After the step loop, before `for (const p of probes) if (p.state === "flying") p.state = "lost";`, add:

```ts
  // Launch over: fold any pass still open (probe landed inside the zone, was
  // lost mid-pass, or hit the step cap) into bestPrecision.
  for (const p of targetPass) if (p) closePass(p);
  if (goalPass) closePass(goalPass);
```

Nothing else changes: `keysCollected`, `targetsHit`, `goalReached`, the event steps, and `probes` are computed exactly as before.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @apogee/engine exec vitest run campaign-simulate campaign-moving campaign-portal`

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src/campaign/simulate.ts packages/engine/tests/campaign-simulate.test.ts
git commit -m "feat(engine): score precision as closest approach during the triggering pass

First-contact sampling made the inner ring unreachable on goals (they trigger
35-45 units out) and automatic on targets. Track the minimum center distance
while the triggering probe stays inside the zone instead. Sim state, events,
and trigger steps are unchanged.

Claude-Session: https://claude.ai/code/session_01TW4Nrj1k3d1ArAR492tDDM"
```

---

### Task 2: 3★ at the bullseye (engine rule + level-complete copy)

**Files:**
- Modify: `packages/engine/src/campaign/scoring.ts`
- Modify: `packages/engine/src/campaign/types.ts` (comment on `par`)
- Modify: `packages/web/src/campaign/ratingText.ts`
- Test: `packages/engine/tests/campaign-scoring.test.ts`, `packages/web/tests/campaign/ratingText.test.ts`

**Interfaces:**
- Consumes: `CampaignLevelState.bestPrecision` as produced by Task 1.
- Produces: `starRating(state) → { stars: 0 | 1 | 2 | 3 }` with 3★ = par AND `bestPrecision ≥ 5`; `starCriteria(state)` third row `{ text: "closest approach in the bullseye", met }`.

- [ ] **Step 1: Rewrite the failing engine test**

In `packages/engine/tests/campaign-scoring.test.ts`, replace the test named
`"par + inner ring (precision 3) earns 3 stars; bullseye (5) also does"` with these two:

```ts
  it("par + bullseye (precision 5) earns 3 stars", () => {
    const bull = state(level(), { goalReached: true, launchesUsed: 2, bestPrecision: 5 });
    expect(starRating(bull).stars).toBe(3);
  });

  it("par + inner ring (precision 3) earns only 2 stars", () => {
    const inner = state(level(), { goalReached: true, launchesUsed: 2, bestPrecision: 3 });
    expect(starRating(inner).stars).toBe(2);
  });
```

- [ ] **Step 2: Update the failing web tests**

In `packages/web/tests/campaign/ratingText.test.ts` replace the first test with:

```ts
  it("marks all three met for a par + bullseye clear", () => {
    const rows = starCriteria(state({ launchesUsed: 2, bestPrecision: 5 }));
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.met)).toEqual([true, true, true]);
    expect(rows[2]!.text).toBe("closest approach in the bullseye");
  });

  it("inner-ring precision at par lights only the first two rows", () => {
    const rows = starCriteria(state({ launchesUsed: 2, bestPrecision: 3 }));
    expect(rows.map((r) => r.met)).toEqual([true, true, false]);
  });
```

Leave the other three tests as they are.

- [ ] **Step 3: Run both files to verify they fail**

Run: `pnpm --filter @apogee/engine exec vitest run campaign-scoring && pnpm --filter @apogee/web exec vitest run ratingText`

Expected: engine FAIL `expected 3 to be 2`; web FAIL on the text (`"first contact in the inner ring"`) and on `[true, true, true]` vs `[true, true, false]`.

- [ ] **Step 4: Implement**

`packages/engine/src/campaign/scoring.ts` — replace the `starRating` doc comment and body:

```ts
/** Finish / efficient / perfect: 1★ = clear, 2★ = clear within par launches,
 *  3★ = 2★ plus a bullseye pass (bestPrecision ≥ 5: closest approach ≤ 14
 *  units to a goal/target center while inside its zone). */
export function starRating(state: CampaignLevelState): { stars: 0 | 1 | 2 | 3 } {
  if (!evaluateObjectives(state).cleared) return { stars: 0 };
  if (state.launchesUsed > state.level.par) return { stars: 1 };
  return { stars: state.bestPrecision >= 5 ? 3 : 2 };
}
```

`packages/engine/src/campaign/types.ts` — the `par` comment becomes:

```ts
  /** Optimal known launch count. Stars: 1 = clear, 2 = clear at par,
   *  3 = par AND a bullseye pass (closest approach ≤ 14 units). Provable: CI
   *  asserts each level's recorded/brute-forced solution clears within par. */
  par: number;
```

`packages/web/src/campaign/ratingText.ts` — third row:

```ts
    { text: "closest approach in the bullseye", met: state.launchesUsed <= par && state.bestPrecision >= 5 },
```

- [ ] **Step 5: Run both files to verify they pass**

Run: `pnpm --filter @apogee/engine exec vitest run campaign-scoring && pnpm --filter @apogee/web exec vitest run ratingText`

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/engine/src/campaign/scoring.ts packages/engine/src/campaign/types.ts packages/engine/tests/campaign-scoring.test.ts packages/web/src/campaign/ratingText.ts packages/web/tests/campaign/ratingText.test.ts
git commit -m "feat(engine): 3 stars require a bullseye pass (closest approach <= 14)

With closest-approach precision the 30-unit inner ring would cover most
chords through a goal; the 14-unit bullseye is a real tier. Panel copy
follows.

Claude-Session: https://claude.ai/code/session_01TW4Nrj1k3d1ArAR492tDDM"
```

---

### Task 3: `clearedAtStep` on the launch result (engine)

**Files:**
- Modify: `packages/engine/src/campaign/objectives.ts`
- Modify: `packages/engine/src/campaign/simulate.ts`
- Modify: `packages/engine/src/campaign/index.ts`
- Test: `packages/engine/tests/campaign-objectives.test.ts`, `packages/engine/tests/campaign-simulate.test.ts`

**Interfaces:**
- Produces:
  - `allObjectivesMet(objectives: readonly Objective[], targetsHit: readonly boolean[], goalReached: boolean): boolean` — false for an empty objective list (matches `evaluateObjectives().cleared`).
  - `interface CampaignLaunchResult { state: CampaignLevelState; trace: ProbeFrame[][]; events: SensorEvent[]; clearedAtStep: number | null }` — `simulateCampaignLaunch` returns it. `clearedAtStep` is the first step index (= trace index) at which every objective was met during this launch, or `null`.

- [ ] **Step 1: Write the failing tests**

Append to `packages/engine/tests/campaign-objectives.test.ts`:

```ts
import { allObjectivesMet } from "../src/campaign/objectives";

describe("allObjectivesMet", () => {
  it("is false with no objectives", () => {
    expect(allObjectivesMet([], [], true)).toBe(false);
  });
  it("reach-goal follows goalReached", () => {
    expect(allObjectivesMet([{ kind: "reach-goal" }], [], false)).toBe(false);
    expect(allObjectivesMet([{ kind: "reach-goal" }], [], true)).toBe(true);
  });
  it("hit-all-targets needs every target and at least one", () => {
    expect(allObjectivesMet([{ kind: "hit-all-targets" }], [], false)).toBe(false);
    expect(allObjectivesMet([{ kind: "hit-all-targets" }], [true, false], false)).toBe(false);
    expect(allObjectivesMet([{ kind: "hit-all-targets" }], [true, true], false)).toBe(true);
  });
  it("combined objectives need both", () => {
    const both = [{ kind: "hit-all-targets" as const }, { kind: "reach-goal" as const }];
    expect(allObjectivesMet(both, [true], false)).toBe(false);
    expect(allObjectivesMet(both, [true], true)).toBe(true);
  });
});
```

(Put the `import` at the top of the file with the other imports.)

Append to `packages/engine/tests/campaign-simulate.test.ts`:

```ts
describe("clearedAtStep", () => {
  it("is null when the launch does not clear the level", () => {
    const lvl = base({ goal: { pos: { x: 700, y: 600 }, radius: 30 }, objectives: [{ kind: "reach-goal" }] });
    const r = simulateCampaignLaunch(createLevel(lvl), { dx: 200, dy: 0 });
    expect(r.state.goalReached).toBe(false);
    expect(r.clearedAtStep).toBeNull();
  });

  it("is the step the goal triggers on a goal-only level, and the trace continues past it", () => {
    const lvl = base({ goal: { pos: { x: 700, y: 500 }, radius: 30 }, objectives: [{ kind: "reach-goal" }] });
    const r = simulateCampaignLaunch(createLevel(lvl), { dx: 200, dy: 0 });
    expect(r.clearedAtStep).toBe(58);
    expect(r.trace.length).toBeGreaterThan(58 + 36);
  });

  it("is the step the LAST objective is met on a targets + goal level", () => {
    const lvl = base({
      targets: [{ pos: { x: 400, y: 500 }, radius: 20 }],   // triggers at frame 29
      goal: { pos: { x: 700, y: 500 }, radius: 30 },          // triggers at frame 58
      objectives: [{ kind: "hit-all-targets" }, { kind: "reach-goal" }],
    });
    const r = simulateCampaignLaunch(createLevel(lvl), { dx: 200, dy: 0 });
    expect(r.events.map((e) => [e.type, e.step])).toEqual([["target", 29], ["goal", 58]]);
    expect(r.clearedAtStep).toBe(58);
  });

  it("stays null on a later launch once the level was already cleared", () => {
    const lvl = base({ goal: { pos: { x: 700, y: 500 }, radius: 30 }, objectives: [{ kind: "reach-goal" }] });
    const r1 = simulateCampaignLaunch(createLevel(lvl), { dx: 200, dy: 0 });
    const r2 = simulateCampaignLaunch(r1.state, { dx: 200, dy: 0 });
    expect(r2.clearedAtStep).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @apogee/engine exec vitest run campaign-objectives campaign-simulate`

Expected: FAIL — `allObjectivesMet` is not exported; `clearedAtStep` is `undefined`.

- [ ] **Step 3: Implement**

`packages/engine/src/campaign/objectives.ts` — replace the file body:

```ts
import type { CampaignLevelState, Objective } from "./types";

/** True when every objective is met against raw progress flags (and there is at
 *  least one objective). Used by the sim to stamp `clearedAtStep` per step. */
export function allObjectivesMet(
  objectives: readonly Objective[],
  targetsHit: readonly boolean[],
  goalReached: boolean,
): boolean {
  if (objectives.length === 0) return false;
  return objectives.every((o) =>
    o.kind === "reach-goal" ? goalReached : targetsHit.length > 0 && targetsHit.every(Boolean),
  );
}

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
  return { met, cleared: allObjectivesMet(state.level.objectives, state.targetsHit, state.goalReached) };
}

export function isLevelOver(state: CampaignLevelState): boolean {
  return (
    evaluateObjectives(state).cleared ||
    state.launchesUsed >= state.level.launchBudget
  );
}
```

`packages/engine/src/campaign/simulate.ts`:

1. Add to the imports: `import { allObjectivesMet } from "./objectives";`
2. Add the exported result type above `simulateCampaignLaunch`:

```ts
export interface CampaignLaunchResult {
  state: CampaignLevelState;
  trace: ProbeFrame[][];
  events: SensorEvent[];
  /** First step (= trace index) at which every objective was met during this
   *  launch, or null. Lets the UI stop playback once the level is won. */
  clearedAtStep: number | null;
}
```

3. Change the signature's return type to `: CampaignLaunchResult`.
4. Next to the pass declarations (Task 1) add:

```ts
  // A level cleared on an earlier launch never reports clearedAtStep again.
  const clearedBefore = allObjectivesMet(level.objectives, state.targetsHit, state.goalReached);
  let clearedAtStep: number | null = null;
```

   and, after the sensor block (before `// 4. Wormholes`), add:

```ts
    if (clearedAtStep === null && !clearedBefore &&
        allObjectivesMet(level.objectives, targetsHit, goalReached)) {
      clearedAtStep = step;
    }
```

5. Return `{ state: {...}, trace, events, clearedAtStep }`.

`packages/engine/src/campaign/index.ts`:

```ts
export { createLevel, simulateCampaignLaunch, type CampaignLaunchResult } from "./simulate";
export { allObjectivesMet, evaluateObjectives, isLevelOver } from "./objectives";
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @apogee/engine exec vitest run campaign-objectives campaign-simulate`

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src/campaign/objectives.ts packages/engine/src/campaign/simulate.ts packages/engine/src/campaign/index.ts packages/engine/tests/campaign-objectives.test.ts packages/engine/tests/campaign-simulate.test.ts
git commit -m "feat(engine): report clearedAtStep on a campaign launch

Additive field: the first step at which all objectives are met, or null.
Extracts allObjectivesMet so the sim can ask per step without building a
state.

Claude-Session: https://claude.ai/code/session_01TW4Nrj1k3d1ArAR492tDDM"
```

---

### Task 4: Deliberate golden update + full engine gate

**Files:**
- Modify: `packages/engine/tests/__snapshots__/campaign-golden.test.ts.snap` (via `-u`)

**Interfaces:** none new. This task proves the "sim fields byte-identical" constraint.

- [ ] **Step 1: See exactly what moved**

Run: `pnpm --filter @apogee/engine exec vitest run campaign-golden`

Expected: the two snapshot tests FAIL. Read the diff: the only changed keys must be
`bestPrecision` (today `1` in both) and possibly `stars` (today `2`). `probes`, `keysCollected`,
`goalReached`, `cleared` must be unchanged. If anything else differs, stop — Task 1 or 3 changed sim
behaviour and must be fixed before continuing.

- [ ] **Step 2: Update the snapshot**

Run: `pnpm --filter @apogee/engine exec vitest run campaign-golden -u`

Then: `git diff packages/engine/tests/__snapshots__/campaign-golden.test.ts.snap`

Expected: only `"bestPrecision": N` and/or `"stars": N` lines differ. The daily snapshot
`golden.test.ts.snap` is untouched (`git status` shows no change to it).

- [ ] **Step 3: Run the whole engine suite and typecheck**

Run: `pnpm --filter @apogee/engine test && pnpm --filter @apogee/engine typecheck`

Expected: all tests pass, including `campaign-levels` (every stored solution still clears within par) and the daily `golden`. Typecheck passes (in the main tree, the only errors are in `tests/_scratch.test.ts`; none elsewhere).

- [ ] **Step 4: Commit**

```bash
git add packages/engine/tests/__snapshots__/campaign-golden.test.ts.snap
git commit -m "test(engine): regenerate campaign golden for closest-approach precision

Only bestPrecision/stars change; probes, keysCollected, goalReached and
cleared are byte-identical. Daily golden untouched.

Claude-Session: https://claude.ai/code/session_01TW4Nrj1k3d1ArAR492tDDM"
```

---

### Task 5: Trim playback at the clear (web)

**Files:**
- Create: `packages/web/src/space/playback.ts` (if fun-debt Task 6 already created it, add to it)
- Modify: `packages/web/src/campaign/CampaignLevel.tsx`
- Test: `packages/web/tests/space/playback.test.ts`

**Interfaces:**
- Consumes: `CampaignLaunchResult.clearedAtStep` (Task 3).
- Produces: `CLEAR_TAIL = 36`; `trimToClear<T>(trace: T[], clearedAtStep: number | null, tail = CLEAR_TAIL): T[]` — returns `trace` itself when `clearedAtStep` is null, else `trace.slice(0, min(trace.length, clearedAtStep + 1 + tail))` (the clearing frame plus `tail` more). `PendingAnim` in `CampaignLevel` gains `clearAt: number | null` for Task 6.

- [ ] **Step 1: Write the failing tests**

Create `packages/web/tests/space/playback.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CLEAR_TAIL, trimToClear } from "../../src/space/playback";

const frames = (n: number) => Array.from({ length: n }, (_, i) => i);

describe("trimToClear", () => {
  it("returns the same array when the launch did not clear", () => {
    const t = frames(200);
    expect(trimToClear(t, null)).toBe(t);
  });
  it("keeps the clearing frame plus CLEAR_TAIL more", () => {
    expect(CLEAR_TAIL).toBe(36);
    expect(trimToClear(frames(200), 58)).toHaveLength(58 + 1 + 36);
  });
  it("never extends past the end of the trace", () => {
    expect(trimToClear(frames(60), 58)).toHaveLength(60);
  });
  it("honours a custom tail", () => {
    expect(trimToClear(frames(10), 0, 3)).toEqual([0, 1, 2, 3]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @apogee/web exec vitest run playback`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the module**

Create `packages/web/src/space/playback.ts`:

```ts
/** Frames of playback kept after the step that cleared the level (0.6 s at 60 Hz). */
export const CLEAR_TAIL = 36;

/**
 * Shorten a launch trace so playback ends shortly after the level is cleared.
 * The engine still simulated the whole flight (state is unaffected); this only
 * changes what the player watches. Returns the input array itself when the
 * launch did not clear the level.
 */
export function trimToClear<T>(trace: T[], clearedAtStep: number | null, tail = CLEAR_TAIL): T[] {
  if (clearedAtStep === null) return trace;
  const end = clearedAtStep + 1 + tail;
  return end >= trace.length ? trace : trace.slice(0, end);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @apogee/web exec vitest run playback`

Expected: PASS.

- [ ] **Step 5: Wire it into `CampaignLevel.tsx`**

Add the import: `import { trimToClear } from "../space/playback";`

Change `PendingAnim` and `handleLaunch`:

```tsx
interface PendingAnim {
  trace: ProbeFrame[][];
  next: CampaignLevelState;
  /** Frame at which the level was cleared (a burst is drawn there), or null. */
  clearAt: number | null;
}

  const handleLaunch = useCallback(
    (input: LaunchInput) => {
      const { state: next, trace, clearedAtStep } = simulateCampaignLaunch(state, input);
      setAnim({ trace: trimToClear(trace, clearedAtStep), next, clearAt: clearedAtStep });
    },
    [state],
  );
```

`handleAnimDone` is unchanged: it still applies `anim.next` (the full engine state).

- [ ] **Step 6: Verify and commit**

Run: `pnpm --filter @apogee/web test && pnpm --filter @apogee/web typecheck`

Expected: PASS (nothing reads `clearAt` yet; TypeScript is fine with the unused field).

```bash
git add packages/web/src/space/playback.ts packages/web/tests/space/playback.test.ts packages/web/src/campaign/CampaignLevel.tsx
git commit -m "feat(web): stop campaign playback 0.6s after the level is cleared

Claude-Session: https://claude.ai/code/session_01TW4Nrj1k3d1ArAR492tDDM"
```

---

### Task 6: Clear burst at the clearing frame (web)

**Files:**
- Modify: `packages/web/src/space/effects.ts` (`Burst.kind`)
- Modify: `packages/web/src/render.ts` (`drawBursts` color)
- Modify: `packages/web/src/space/useBoardCanvas.ts` (`clearAt` prop)
- Modify: `packages/web/src/campaign/CampaignCanvas.tsx`, `packages/web/src/GameCanvas.tsx`
- Modify: `packages/web/src/campaign/CampaignLevel.tsx` (pass `clearAt`)

**Interfaces:**
- Consumes: `PendingAnim.clearAt` from Task 5.
- Produces: `UseBoardCanvas.clearAt: number | null`; `Burst.kind: "land" | "lost" | "clear"`.

- [ ] **Step 1: Extend the burst type and colour**

`packages/web/src/space/effects.ts`:

```ts
  kind: "land" | "lost" | "clear";
```

`packages/web/src/render.ts`, in `drawBursts`, replace the `strokeStyle` assignment:

```ts
    ctx.strokeStyle =
      b.kind === "land"
        ? `rgba(165,214,167,${fade * 0.8})`
        : b.kind === "clear"
          ? `rgba(128,203,196,${fade * 0.9})`
          : `rgba(224,86,74,${fade * 0.8})`;
```

Also update the parameter type of `drawBursts` from `kind: "land" | "lost"` to `Burst["kind"]`
(`Burst` is already imported there).

- [ ] **Step 2: Add `clearAt` to the hook**

`packages/web/src/space/useBoardCanvas.ts`:

In `UseBoardCanvas` add:

```ts
  /** Frame index at which the level was cleared; a clear burst is drawn there. */
  clearAt: number | null;
```

Next to `const animRef = useRef(opts.anim);` add a fresh ref:

```ts
  const clearAtRef = useRef(opts.clearAt);
  clearAtRef.current = opts.clearAt;
```

In the anim branch of `render`, inside `if (pf) { ... }` after the state-transition burst block, add:

```ts
          if (motion && clearAtRef.current !== null && frameIdxRef.current === clearAtRef.current) {
            burstsRef.current.push({ x: pf.x, y: pf.y, start: time, kind: "clear" });
          }
```

- [ ] **Step 3: Thread the prop through the adapters**

`packages/web/src/campaign/CampaignCanvas.tsx`: add `clearAt: number | null;` to `Props`, destructure it, and pass `clearAt` into `useBoardCanvas({ ... })`.

`packages/web/src/GameCanvas.tsx`: pass `clearAt: null` into `useBoardCanvas({ ... })` (the daily board never trims).

`packages/web/src/campaign/CampaignLevel.tsx`: `<CampaignCanvas ... anim={anim?.trace ?? null} clearAt={anim?.clearAt ?? null} ... />`.

- [ ] **Step 4: Typecheck, test, and check it by eye**

Run: `pnpm --filter @apogee/web typecheck && pnpm --filter @apogee/web test`

Expected: PASS.

Then `pnpm dev`, open Campaign → level 1, and clear it (pull the pad ~200 world units left and ~55 up; the goal is up-right past the planet). Expected: a teal ring bursts at the goal the moment the probe enters it, the probe flies about half a second more, and the ★ panel appears. Retry and miss on purpose: the flight plays to its natural end with no teal burst.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/space/effects.ts packages/web/src/render.ts packages/web/src/space/useBoardCanvas.ts packages/web/src/campaign/CampaignCanvas.tsx packages/web/src/GameCanvas.tsx packages/web/src/campaign/CampaignLevel.tsx
git commit -m "feat(web): teal clear burst at the frame the level is won

Claude-Session: https://claude.ai/code/session_01TW4Nrj1k3d1ArAR492tDDM"
```

---

### Task 7: Sprint verification sweep

**Files:**
- Create (scratch, not committed): `<scratchpad>/stars-check/stars-check.test.ts`
- Modify (only if a level fails the check): `docs/superpowers/specs/2026-09-01-apogee-difficulty-structure-design.md` Section 2 table — add a note in the level's Action cell.

**Interfaces:** none new. This task checks the spec's success criteria and hands any tuning need to sprint 5.

- [ ] **Step 1: Full gate**

Run: `pnpm test && pnpm typecheck`

Expected: engine and web suites green; typecheck green (main tree: errors only in `tests/_scratch.test.ts`).

- [ ] **Step 2: Dead-reference sweep**

Run: `grep -rn "first contact\|inner ring\|bestPrecision >= 3" packages/ --include=*.ts --include=*.tsx | grep -v node_modules`

Expected: no hits outside comments that describe history. Fix any stale copy.

- [ ] **Step 3: 3★ attainability check (success criterion 1)**

Write the scratch test below to `<scratchpad>/stars-check/stars-check.test.ts` (replace `<repo>` with the absolute repo path) and run it with
`pnpm --filter @apogee/engine exec vitest run --dir "<scratchpad>/stars-check" --testTimeout 600000`.

```ts
import { it } from "vitest";
import { LEVELS, isMovingLevel } from "<repo>/packages/engine/src/campaign/levels";
import { SOLUTIONS } from "<repo>/packages/engine/src/campaign/solutions";
import { createLevel, simulateCampaignLaunch } from "<repo>/packages/engine/src/campaign/simulate";
import { evaluateObjectives } from "<repo>/packages/engine/src/campaign/objectives";
import { starRating } from "<repo>/packages/engine/src/campaign/scoring";
import { findSolution } from "<repo>/packages/engine/tests/campaign-solver";
import { BOARD_PERIOD } from "<repo>/packages/engine/src/campaign/constants";
import type { LaunchInput } from "<repo>/packages/engine/src/types";

const DIRS = 360;
const POWERS = [30, 45, 60, 80, 100, 120, 140, 160, 180, 200, 230, 260];
function grid(ticks: number[]): LaunchInput[] {
  const out: LaunchInput[] = [];
  for (let d = 0; d < DIRS; d++) {
    const t = (d / DIRS) * Math.PI * 2;
    for (const p of POWERS) for (const tick of ticks) out.push({ dx: Math.cos(t) * p, dy: Math.sin(t) * p, launchTick: tick });
  }
  return out;
}

it("every level has a 3-star input at par, and none is all-3-star", () => {
  const rows: string[] = ["id\tclears\tthree\tratio"];
  for (const lvl of LEVELS) {
    const moving = isMovingLevel(lvl);
    const ticks = moving ? Array.from({ length: 8 }, (_, i) => Math.round((i / 8) * BOARD_PERIOD)) : [0];
    // Par-2 levels: play the reference sequence's first launch, then sweep the second.
    let start = createLevel(lvl);
    if (lvl.par === 2) {
      const ref = moving ? SOLUTIONS[lvl.id] : findSolution(lvl);
      start = simulateCampaignLaunch(start, ref![0]!).state;
    }
    let clears = 0, three = 0;
    for (const inp of grid(ticks)) {
      const r = simulateCampaignLaunch(start, inp);
      if (!evaluateObjectives(r.state).cleared) continue;
      clears++;
      if (starRating(r.state).stars === 3) three++;
    }
    rows.push(`${lvl.id}\t${clears}\t${three}\t${clears ? (three / clears).toFixed(2) : "n/a"}`);
  }
  console.log("\n" + rows.join("\n") + "\n");
});
```

Expected: for every level `three ≥ 1` and `three < clears`. Record the table in the PR
description. Any level with `three = 0` (or `three = clears`) is **not** fixed here: add
"needs a bullseye-reachable sensor (sprint-1 check)" to that level's Action cell in the sprint-5
spec table and commit that doc change.

- [ ] **Step 4: Playback check (success criterion 2)**

`pnpm dev` → Campaign → level 9 "Key & Guard" (unlock by clearing 1–8, or temporarily set
`apogee-campaign-progress` in localStorage to `{"3-2":{"cleared":true,"stars":1}}` and reload).
Clear it with any shot that orbits after collecting the key and touching the goal. Expected: the
panel appears within a second of the goal burst instead of after a 45 s orbit.

- [ ] **Step 5: Commit anything the sweep shook loose; otherwise no commit**

```bash
git status
# only if Step 3 required a spec note:
git add docs/superpowers/specs/2026-09-01-apogee-difficulty-structure-design.md
git commit -m "docs: hand sprint-1 3-star findings to the difficulty sprint

Claude-Session: https://claude.ai/code/session_01TW4Nrj1k3d1ArAR492tDDM"
```

---

## Self-review

**Spec coverage.** Section 1 (closest approach) → Task 1. Section 2 (star rule + panel copy) →
Task 2. Section 3 (`clearedAtStep`, trim, clear burst, skip parity) → Tasks 3, 5, 6; skip parity
holds because the board plays the trimmed array and fun-debt's skip runs "remaining frames of the
anim". Section 4 tests → Tasks 1–5; the "leaves and re-enters does not reopen" case is covered at
launch granularity (a reached goal never re-triggers) since the trigger flag is sticky and the
pass is keyed to it. Decision 5 (goldens) → Task 4. Success criteria → Task 7.

**Type consistency.** `CampaignLaunchResult.clearedAtStep: number | null` (Task 3) →
`trimToClear(trace, clearedAtStep)` and `PendingAnim.clearAt` (Task 5) → `UseBoardCanvas.clearAt`
(Task 6). `Burst.kind` union extended in Task 6 before the hook pushes `"clear"`.
`allObjectivesMet(objectives, targetsHit, goalReached)` has the same argument order in the test,
the implementation, and the sim call.

**Placeholders.** None; every code step carries its code.
