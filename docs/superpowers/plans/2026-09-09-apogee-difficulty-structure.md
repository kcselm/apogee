# Apogee Difficulty & Campaign Structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every chapter reads teach / twist / test on a committed forgiveness sweep, 3★ is earned (10–40 % of par clears) on every level, every reference flight is ≤ 12 s, every moving level still needs its mechanic, and the map shows chapters and a star total.

**Architecture:** One new authoring tool in `packages/engine/tests/` — a pure, unit-tested `level-stats.ts` (candidate grid, per-level measurements, band verdicts) plus a SOLVE-gated `level-stats.test.ts` that prints a TSV — becomes the referee for a per-level tuning loop over `levels.ts`. CI stops brute-forcing static levels and instead replays a stored reference shot for all thirty (`SOLUTIONS` grows to cover every level). A data-only `chapters.ts` in the engine feeds a pure `mapModel.ts` in the web package; `CampaignMap` renders from it. No simulation, scoring, or physics code changes.

**Tech Stack:** TypeScript 5, Vitest 3, React 19, Vite 7, pnpm 10.32, Cloudflare Pages via wrangler. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-01-apogee-difficulty-structure-design.md`

**Roadmap:** `docs/superpowers/specs/2026-09-01-apogee-polish-roadmap.md` (sprint 5 of 6; fixes finding F8; definition-of-done items 5, 6, 7)

## Global Constraints

- Work on a new branch `feat/difficulty-structure` cut from `main` at `b87d0d3` (sprint 4 merged; `main` and `origin/main` identical). Push the branch and open a PR for CI (sprint 4 precedent); do not push `main` until the finishing task.
- **Engine discipline unchanged:** `+ − × ÷ sqrt` only in `packages/engine/src`. `chapters.ts` is data. `Math.cos`/`Math.sin` are allowed only in `packages/engine/tests/` authoring tools, as the solvers already do.
- **No simulation, scoring, or physics change.** `simulate.ts`, `scoring.ts` (campaign and daily), `objectives.ts`, `physics.ts`, `constants.ts`, and the shared `RINGS` table are not touched. The spec's "consider min-over-sensors precision" fallback for 5-1 / 9-2 is **out of scope** for this sprint (see Deviations, item 2).
- **Goldens must stay byte-identical.** The daily golden is never touched. The campaign golden's fixtures are self-contained level literals, not `LEVELS` entries, so level tuning cannot move them; a changed `.snap` means a sim/scoring change and is a violation. Never stage a `.snap` file (Windows line-ending churn shows as `M` with zero hunks). Stage by file name, never `git add -A`.
- **Content rules from the spec, verbatim:** role bands on the fine grid — teach (x-1) 2–6 %, twist (x-2) 0.7–2 %, test (x-3) 0.15–0.7 % — applied to `clear1 %` on par-1 levels and `progress %` on par-2+ levels; 3★ share among par clears 10–40 % on every level; reference flight ≤ 12 s = **720 steps**; tuning levers in order of preference: sensor radius (keys 26–36, targets 22–30, goals 32–44), sensor position along the natural arc, blocker position, body radius/mass, launch budget last (generous: it gates clearing, not stars). Chapters 1–5 layouts may change.
- **Fun-debt rules that still bind:** every planet-kind disc (a moon over its whole orbit) stays ≥ 12 units clear of every blocker disc (`12 = 2 × PROBE_RADIUS + 2`); every moving level must print `mechanic required` on every twin of the ablation audit; if a relayouted level's par exceeds `launchBudget − 1`, raise `launchBudget` to `par + 2`.
- **Chapter titles and mechanic lines verbatim from spec §4:** 1 Gravity / reach the goal; 2 Blockers / curve around what kills you; 3 Keys / unlock, then land; 4 Marks / hit every target; 5 Combined / everything so far; 6 Moons / moving gravity; 7 Moons & more / timing meets guards and keys; 8 Wormholes / in one mouth, out the other; 9 Wormholes & more / portals with keys, marks, guards; 10 Capstone / all of it. Map header text `Chapter 3 · Keys`; HUD counter `★ 23 / 90`.
- SOLVE-gated tools (`level-stats`, `ablation-audit`, `discover-*`) never run in CI (no `SOLVE` in `ci.yml`).
- The untracked `packages/engine/tests/_*.test.ts` scratch files are ignored and excluded from `tsc` since sprint 4; never edit or stage them. The three root PNGs stay untracked.
- Per-task gates: `pnpm --filter @apogee/engine test` for engine tasks; `pnpm --filter @apogee/web typecheck && pnpm --filter @apogee/web test` for web tasks; `pnpm typecheck` at the root before every commit.
- End every commit message with the line `Claude-Session: https://claude.ai/code/session_018VCA3FTbkfMqByjoKBDp3r`, keeping `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` on the line above it.
- Deploying is manual after merge (sprint 4 deviation 5): `pnpm --filter @apogee/web build && npx wrangler pages deploy packages/web/dist --project-name apogee --branch main`.

## Deviations from the spec (deliberate, with rationale)

1. **CI replays a stored reference for every level and retires the static brute-force test.** Spec §3 says `SOLUTIONS` entries are replaced with the sweep's references "so the CI solvability test replays the shot the level is designed around", and §6 lists "CI (existing): every recorded solution clears within par". Today CI brute-forces static levels on a 96 × 7 grid and replays `SOLUTIONS` only for moving levels. A test level tightened to the 0.15–0.7 % band on the 4 320-input fine grid can have zero hits on the 672-input coarse grid, so the brute-force test would fail on correctly tuned levels. Task 3 extends `SOLUTIONS` to all thirty ids and makes the replay test universal; `findSolution` stays for the `discover-pars` tool.
2. **No precision-rule change for 5-1 / 9-2.** The spec says "consider min-over-sensors precision or a layout where the first pass cannot be a bullseye". A precision change touches `simulate.ts` and moves the campaign golden's `bestPrecision`/`stars`; this sprint is content and tooling. The tuning tasks use layout only. If a level cannot reach the 10–40 % 3★ band by layout, it is recorded as an exception in the tuning record with the measured share, not forced.
3. **The sweep's power axis is 40 … 260 in steps of 20, matching the 2026-09-01 sweep the spec's bands were calibrated on.** `MAX_SPEED / POWER_SCALE = 200`, so 220/240/260 are speed-clamped duplicates of 200 (max-power shots weigh ×4). A 20–200 axis was measured at plan-execution time and reads about half as forgiving (1-1: 1.53 % vs the spec's 3.03 %; 40–260 gives 3.17 %), which would mis-tune every "keep" row. Comparability with the spec's table and bands wins; the duplication is documented in the tool.
4. **The reference search is progress-pruned, like the solvers.** Shortest-playback search over par launches keeps, per progress signature, only the three shortest-playback prefixes. It can miss a clear that needs a non-progress launch (parking a probe as a blocker); the fun-debt solvers have the same blind spot and the spec calls the sweep an authoring tool, not a proof.
5. **`level-stats` gets a `LEVELS` filter, and so does the ablation audit.** The full sweep takes minutes; a per-level tuning loop needs a per-level run. `LEVELS=3-1,3-2` restricts both tools. Tool-only change, SOLVE-gated, never CI.

## Dependencies on Kevin

- **Task 12** is the playtest checkpoint (spec decision 7 and §5 step 5). Everything before it is agent work.
- **Task 13** opens the PR (his click) and merges; the controller deploys.

---

## File structure

| File | Responsibility | Change |
|---|---|---|
| `packages/engine/tests/level-stats.ts` | pure sweep helpers: grid, measurements, reference search, bands, TSV | new |
| `packages/engine/tests/level-stats-helpers.test.ts` | CI unit tests for the helpers on a coarse grid | new |
| `packages/engine/tests/level-stats.test.ts` | SOLVE-gated TSV printer with `LEVELS` filter | new |
| `packages/engine/tests/ablation-audit.test.ts` | honour `LEVELS` filter | modify |
| `packages/engine/src/campaign/solutions.ts` | references for all thirty levels | modify |
| `packages/engine/tests/campaign-levels.test.ts` | universal replay test; brute-force test retired | modify |
| `packages/engine/src/campaign/chapters.ts` | `Chapter`, `CHAPTERS` data | new |
| `packages/engine/src/campaign/index.ts` | export chapters | modify |
| `packages/engine/tests/campaign-chapters.test.ts` | chapters cover `LEVELS` once in order; intro on first id | new |
| `packages/engine/src/campaign/levels.ts` | tuned layouts, pars, budgets | modify (Tasks 6–9) |
| `packages/web/src/campaign/mapModel.ts` | pure `chapterSections`, `totalStars`, `MAX_STARS` | new |
| `packages/web/tests/campaign/mapModel.test.ts` | grouping and star-total tests | new |
| `packages/web/src/campaign/CampaignMap.tsx` | chapter sections, star counter | modify |
| `packages/web/src/styles.css` | `.chapter`, `.chapter-head`, three-tile rows | modify |
| `docs/superpowers/specs/2026-09-01-apogee-difficulty-structure-design.md` | §7 tuning record: before / after tables, playtest notes | modify (data-only commits) |

---

### Task 1: The sweep tool (`level-stats`)

**Files:**
- Create: `packages/engine/tests/level-stats.ts`
- Create: `packages/engine/tests/level-stats-helpers.test.ts`
- Create: `packages/engine/tests/level-stats.test.ts`
- Modify: `packages/engine/tests/ablation-audit.test.ts:43-47`

**Interfaces:**
- Consumes: `createLevel`, `simulateCampaignLaunch`, `CampaignLaunchResult` (`clearedAtStep`, `trace`), `evaluateObjectives`, `starRating`, `isMovingLevel`, `BOARD_PERIOD`, `LEVELS`.
- Produces (all from `level-stats.ts`):
  - `candidateGrid(level, opts?)`: `LaunchInput[]` — 360 × 12 (× 8 ticks on moving levels)
  - `referenceSequence(level, grid, depth = level.par, perSignature = 3)`: `{ seq: LaunchInput[]; steps: number } | null`
  - `levelStats(level, grid?)`: `LevelStats` with `clear1`, `progress`, `star3`, `refSteps`, `maxSteps`, `ref`, `role`
  - `verdict(stats)`: `string[]` (empty = in band); `toTsvRow(stats)`; `TSV_HEADER`; `REF_STEP_CAP = 720`
  - The SOLVE-gated test prints `TSV_HEADER` then one row per level, honouring `LEVELS=<id,id,…>`.
  Tasks 2 and 6–11 consume the printed rows; Task 3 consumes `ref` JSON.

- [ ] **Step 1: Write the failing unit tests**

Create `packages/engine/tests/level-stats-helpers.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { LEVELS } from "../src/campaign/levels";
import { evaluateObjectives } from "../src/campaign/objectives";
import { createLevel, simulateCampaignLaunch } from "../src/campaign/simulate";
import {
  POWERS,
  REF_STEP_CAP,
  TSV_HEADER,
  candidateGrid,
  levelStats,
  referenceSequence,
  roleOf,
  toTsvRow,
  verdict,
  type LevelStats,
} from "./level-stats";

// A coarse grid keeps these CI tests to a couple of seconds; the fine grid is the SOLVE tool's job.
const COARSE = { directions: 72, powers: [60, 100, 140, 180] };
const firstLight = LEVELS.find((l) => l.id === "1-1")!;
const moonrise = LEVELS.find((l) => l.id === "6-1")!;

describe("candidate grid", () => {
  it("is directions × powers on a static level, with no launch tick", () => {
    const grid = candidateGrid(firstLight, COARSE);
    expect(grid).toHaveLength(72 * 4);
    expect(grid.every((c) => c.launchTick === undefined)).toBe(true);
  });

  it("multiplies by 8 board ticks on a moving level", () => {
    const grid = candidateGrid(moonrise, COARSE);
    expect(grid).toHaveLength(72 * 4 * 8);
    expect(new Set(grid.map((c) => c.launchTick)).size).toBe(8);
  });

  it("spans 40 … 260 by 20, the axis the spec's bands were calibrated on", () => {
    expect(POWERS).toEqual([40, 60, 80, 100, 120, 140, 160, 180, 200, 220, 240, 260]);
    const lengths = new Set(candidateGrid(firstLight).map((c) => Math.round(Math.hypot(c.dx, c.dy))));
    expect([...lengths].sort((a, b) => a - b)).toEqual(POWERS);
  });
});

describe("reference sequence", () => {
  it("finds a clearing sequence within par on First Light and reports its playback steps", () => {
    const grid = candidateGrid(firstLight, COARSE);
    const ref = referenceSequence(firstLight, grid);
    expect(ref).not.toBeNull();
    expect(ref!.seq.length).toBeLessThanOrEqual(firstLight.par);
    let s = createLevel(firstLight);
    let steps = 0;
    for (const input of ref!.seq) {
      const res = simulateCampaignLaunch(s, input);
      steps += res.clearedAtStep !== null ? res.clearedAtStep + 1 : res.trace.length;
      s = res.state;
    }
    expect(evaluateObjectives(s).cleared).toBe(true);
    expect(ref!.steps).toBe(steps);
    expect(ref!.steps).toBeGreaterThan(0);
  });

  it("returns null when nothing on the grid clears within the depth", () => {
    const grid = candidateGrid(firstLight, { directions: 4, powers: [20] });
    expect(referenceSequence(firstLight, grid, 1)).toBeNull();
  });
});

describe("level stats", () => {
  it("measures shares in [0, 1] with progress ≥ clear1 and a positive reference", () => {
    const s = levelStats(firstLight, candidateGrid(firstLight, COARSE));
    expect(s.id).toBe("1-1");
    expect(s.role).toBe("teach");
    expect(s.clear1).toBeGreaterThan(0);
    expect(s.clear1).toBeLessThanOrEqual(s.progress);
    expect(s.progress).toBeLessThanOrEqual(1);
    expect(s.refSteps).not.toBeNull();
    expect(s.refSteps!).toBeGreaterThan(0);
    expect(s.maxSteps).toBeGreaterThanOrEqual(s.refSteps!);
    expect(s.star3).not.toBeNull();
    expect(s.star3!).toBeGreaterThanOrEqual(0);
    expect(s.star3!).toBeLessThanOrEqual(1);
  });
});

describe("roles, bands, and TSV", () => {
  it("derives the role from the id suffix", () => {
    expect(roleOf("1-1")).toBe("teach");
    expect(roleOf("4-2")).toBe("twist");
    expect(roleOf("10-3")).toBe("test");
  });

  const base: LevelStats = {
    id: "2-2", name: "Bent Path", par: 1, role: "twist",
    clear1: 0.012, progress: 0.3, star3: 0.25, refSteps: 300, maxSteps: 900, ref: [{ dx: 80, dy: -10 }],
  };

  it("reports an in-band level with no violations", () => {
    expect(verdict(base)).toEqual([]);
  });

  it("names every violated band", () => {
    const bad: LevelStats = { ...base, clear1: 0.05, star3: 0.6, refSteps: REF_STEP_CAP + 1 };
    const v = verdict(bad);
    expect(v.some((m) => m.startsWith("forgiveness above"))).toBe(true);
    expect(v.some((m) => m.startsWith("3★ above"))).toBe(true);
    expect(v.some((m) => m.startsWith("ref"))).toBe(true);
  });

  it("uses progress instead of clear1 on par-2 levels", () => {
    const par2: LevelStats = { ...base, id: "4-1", role: "teach", par: 2, clear1: 0, progress: 0.04 };
    expect(verdict(par2)).toEqual([]);
  });

  it("flags a missing reference", () => {
    expect(verdict({ ...base, refSteps: null, ref: null })).toContain("no reference within par");
  });

  it("emits one tab-separated row matching the header", () => {
    const row = toTsvRow(base);
    expect(row.split("\t")).toHaveLength(TSV_HEADER.split("\t").length);
    expect(row.startsWith("2-2\tBent Path\t1\ttwist\t1.20\t30.00\t25.00\t300\t900\t")).toBe(true);
  });
});
```

- [ ] **Step 2: Run the unit tests to verify they fail**

Run: `pnpm --filter @apogee/engine exec vitest run level-stats-helpers`

Expected: FAIL — cannot resolve `./level-stats`.

- [ ] **Step 3: Write the helpers**

Create `packages/engine/tests/level-stats.ts`:

```ts
import { BOARD_PERIOD } from "../src/campaign/constants";
import { isMovingLevel } from "../src/campaign/levels";
import { evaluateObjectives } from "../src/campaign/objectives";
import { starRating } from "../src/campaign/scoring";
import {
  createLevel,
  simulateCampaignLaunch,
  type CampaignLaunchResult,
} from "../src/campaign/simulate";
import type { CampaignLevelState, Level } from "../src/campaign/types";
import type { LaunchInput } from "../src/types";

// Trig + broad search allowed HERE: authoring tool, never CI's replay, never the sim loop.

/** The fine aim grid (spec §1). */
export const DIRECTIONS = 360;
/** Twelve pulls, 40 … 260 by 20 — the axis the spec's bands were calibrated on
 *  (2026-09-01 sweep). MAX_SPEED / POWER_SCALE = 200, so 220/240/260 are clamped
 *  duplicates of 200: max-power shots weigh ×4. Kept for comparability. */
export const POWERS: number[] = Array.from({ length: 12 }, (_, i) => 40 + i * 20);
/** Board ticks sampled on moving levels. */
export const MOVING_TICKS = 8;
/** 12 s of playback at 60 Hz: the reference-flight ceiling (spec decision 4). */
export const REF_STEP_CAP = 720;

export type Role = "teach" | "twist" | "test";

/** Forgiveness bands per role (spec decision 2), as shares of the grid. */
export const BANDS: Record<Role, [number, number]> = {
  teach: [0.02, 0.06],
  twist: [0.007, 0.02],
  test: [0.0015, 0.007],
};
/** 3★ share among par clears (spec decision 3). */
export const STAR3_BAND: [number, number] = [0.1, 0.4];

export interface GridOptions {
  directions?: number;
  powers?: number[];
  ticks?: number;
}

/** Every aim input the sweep tries: directions × powers, × board ticks when the level moves. */
export function candidateGrid(level: Level, opts: GridOptions = {}): LaunchInput[] {
  const dirs = opts.directions ?? DIRECTIONS;
  const powers = opts.powers ?? POWERS;
  const tickCount = isMovingLevel(level) ? (opts.ticks ?? MOVING_TICKS) : 1;
  const ticks = Array.from({ length: tickCount }, (_, i) => Math.round((i / tickCount) * BOARD_PERIOD));
  const out: LaunchInput[] = [];
  for (let d = 0; d < dirs; d++) {
    const t = (d / dirs) * Math.PI * 2;
    for (const p of powers) {
      const dx = Math.cos(t) * p;
      const dy = Math.sin(t) * p;
      if (tickCount === 1) out.push({ dx, dy });
      else for (const tick of ticks) out.push({ dx, dy, launchTick: tick });
    }
  }
  return out;
}

/** Keys collected + targets hit + goal reached. */
export function progressOf(s: CampaignLevelState): number {
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

/** Steps the web plays back for one launch: to the clear (sprint 1 trims there) or the whole flight. */
export function playbackSteps(res: CampaignLaunchResult): number {
  return res.clearedAtStep !== null ? res.clearedAtStep + 1 : res.trace.length;
}

export interface Reference {
  seq: LaunchInput[];
  steps: number;
}

/**
 * Shortest-playback clearing sequence of at most `depth` launches. Layered,
 * progress-pruned: every kept launch raises progress, and per progress
 * signature only the `perSignature` shortest-playback prefixes survive.
 */
export function referenceSequence(
  level: Level,
  grid: LaunchInput[],
  depth: number = level.par,
  perSignature = 3,
): Reference | null {
  type Node = { state: CampaignLevelState; seq: LaunchInput[]; steps: number };
  let frontier: Node[] = [{ state: createLevel(level), seq: [], steps: 0 }];
  let best: Reference | null = null;
  for (let d = 0; d < depth; d++) {
    const kept = new Map<number, Node[]>();
    for (const node of frontier) {
      const base = progressOf(node.state);
      for (const input of grid) {
        const res = simulateCampaignLaunch(node.state, input);
        const steps = node.steps + playbackSteps(res);
        if (evaluateObjectives(res.state).cleared) {
          if (best === null || steps < best.steps) best = { seq: [...node.seq, input], steps };
          continue;
        }
        if (d === depth - 1 || progressOf(res.state) <= base) continue;
        const sig = signature(res.state);
        const bucket = kept.get(sig) ?? [];
        bucket.push({ state: res.state, seq: [...node.seq, input], steps });
        bucket.sort((a, b) => a.steps - b.steps);
        if (bucket.length > perSignature) bucket.length = perSignature;
        kept.set(sig, bucket);
      }
    }
    frontier = [...kept.values()].flat();
    if (frontier.length === 0) break;
  }
  return best;
}

export interface LevelStats {
  id: string;
  name: string;
  par: number;
  role: Role;
  /** Share of grid inputs that clear the level in one launch from the fresh state. */
  clear1: number;
  /** Share of grid inputs that raise progress from the fresh state. */
  progress: number;
  /** Among par clears, the share that earn 3★; null when nothing clears. */
  star3: number | null;
  /** Playback steps of the reference sequence; null when none within par. */
  refSteps: number | null;
  /** Longest flight of any grid input from the fresh state. */
  maxSteps: number;
  ref: LaunchInput[] | null;
}

export function roleOf(id: string): Role {
  const n = Number(id.split("-")[1]);
  return n === 1 ? "teach" : n === 2 ? "twist" : "test";
}

export function levelStats(level: Level, grid: LaunchInput[] = candidateGrid(level)): LevelStats {
  const fresh = createLevel(level);
  let clears = 0;
  let progressers = 0;
  let star3Clears = 0;
  let maxSteps = 0;
  for (const input of grid) {
    const res = simulateCampaignLaunch(fresh, input);
    maxSteps = Math.max(maxSteps, res.trace.length);
    if (progressOf(res.state) > 0) progressers++;
    if (evaluateObjectives(res.state).cleared) {
      clears++;
      if (starRating(res.state).stars === 3) star3Clears++;
    }
  }
  const ref = referenceSequence(level, grid);
  let star3: number | null = null;
  if (ref === null) {
    star3 = clears === 0 ? null : star3Clears / clears;
  } else if (ref.seq.length <= 1) {
    star3 = clears === 0 ? null : star3Clears / clears;
  } else {
    // Play the reference's earlier launches, then sweep the last one (spec §1, star3 on par-2).
    let s = fresh;
    for (const input of ref.seq.slice(0, -1)) s = simulateCampaignLaunch(s, input).state;
    let lastClears = 0;
    let last3 = 0;
    for (const input of grid) {
      const res = simulateCampaignLaunch(s, input);
      if (!evaluateObjectives(res.state).cleared) continue;
      lastClears++;
      if (starRating(res.state).stars === 3) last3++;
    }
    star3 = lastClears === 0 ? null : last3 / lastClears;
  }
  return {
    id: level.id,
    name: level.name,
    par: level.par,
    role: roleOf(level.id),
    clear1: clears / grid.length,
    progress: progressers / grid.length,
    star3,
    refSteps: ref?.steps ?? null,
    maxSteps,
    ref: ref?.seq ?? null,
  };
}

const pct = (x: number): string => (x * 100).toFixed(2);

/** The band the role is measured on: one-launch clears for par 1, progress for par 2+. */
export function bandMetric(s: LevelStats): number {
  return s.par <= 1 ? s.clear1 : s.progress;
}

/** Violations against the spec's bands; empty means in band. */
export function verdict(s: LevelStats): string[] {
  const out: string[] = [];
  const [lo, hi] = BANDS[s.role];
  const m = bandMetric(s);
  if (m < lo) out.push(`forgiveness below ${s.role} band (${pct(m)} % < ${pct(lo)} %)`);
  if (m > hi) out.push(`forgiveness above ${s.role} band (${pct(m)} % > ${pct(hi)} %)`);
  if (s.star3 !== null) {
    if (s.star3 < STAR3_BAND[0]) out.push(`3★ below band (${pct(s.star3)} % < ${pct(STAR3_BAND[0])} %)`);
    if (s.star3 > STAR3_BAND[1]) out.push(`3★ above band (${pct(s.star3)} % > ${pct(STAR3_BAND[1])} %)`);
  }
  if (s.refSteps === null) out.push("no reference within par");
  else if (s.refSteps > REF_STEP_CAP) out.push(`ref ${(s.refSteps / 60).toFixed(1)} s > 12 s`);
  return out;
}

export const TSV_HEADER =
  "id\tname\tpar\trole\tclear1 %\tprogress %\tstar3 %\tref steps\tmax steps\tverdict\tref input";

export function toTsvRow(s: LevelStats): string {
  const v = verdict(s);
  return [
    s.id,
    s.name,
    String(s.par),
    s.role,
    pct(s.clear1),
    pct(s.progress),
    s.star3 === null ? "—" : pct(s.star3),
    s.refSteps === null ? "—" : String(s.refSteps),
    String(s.maxSteps),
    v.length === 0 ? "in band" : v.join("; "),
    s.ref === null ? "—" : JSON.stringify(s.ref),
  ].join("\t");
}
```

- [ ] **Step 4: Run the unit tests to verify they pass**

Run: `pnpm --filter @apogee/engine exec vitest run level-stats-helpers`

Expected: PASS, 12/12, in under 10 s. If "finds a clearing sequence within par on First Light" fails with null, the coarse grid missed 1-1's 3 % window — widen `COARSE.directions` to 120 in the test and re-run; report the change.

- [ ] **Step 5: Write the SOLVE-gated printer**

Create `packages/engine/tests/level-stats.test.ts`:

```ts
import { describe, it } from "vitest";
import { LEVELS } from "../src/campaign/levels";
import { TSV_HEADER, levelStats, toTsvRow } from "./level-stats";

declare const process: { env: { SOLVE?: string; LEVELS?: string } };

// The forgiveness sweep (spec §1): one TSV row per level on the fine aim grid.
// Skipped in CI (minutes). Run all thirty, or a subset while tuning:
//   $env:SOLVE=1; pnpm --filter @apogee/engine exec vitest run level-stats; Remove-Item Env:SOLVE
//   $env:SOLVE=1; $env:LEVELS="3-1,3-2"; pnpm --filter @apogee/engine exec vitest run level-stats; Remove-Item Env:SOLVE; Remove-Item Env:LEVELS
// Bash: SOLVE=1 LEVELS=3-1,3-2 pnpm --filter @apogee/engine exec vitest run level-stats
describe.skipIf(!process.env.SOLVE)("level stats — forgiveness sweep", () => {
  it("prints a TSV row per level", () => {
    const only = process.env.LEVELS?.split(",").map((s) => s.trim()).filter(Boolean);
    // eslint-disable-next-line no-console
    console.log(TSV_HEADER);
    for (const lvl of LEVELS) {
      if (only && only.length > 0 && !only.includes(lvl.id)) continue;
      // eslint-disable-next-line no-console
      console.log(toTsvRow(levelStats(lvl)));
    }
  }, 3_600_000);
});
```

- [ ] **Step 6: Give the ablation audit the same `LEVELS` filter**

In `packages/engine/tests/ablation-audit.test.ts`, change the `declare const process` line to:

```ts
declare const process: { env: { SOLVE?: string; LEVELS?: string } };
```

and inside the `it`, directly after `for (const lvl of LEVELS) {` and before `if (!isMovingLevel(lvl)) continue;`, add:

```ts
      const only = process.env.LEVELS?.split(",").map((s) => s.trim()).filter(Boolean);
      if (only && only.length > 0 && !only.includes(lvl.id)) continue;
```

Extend the run comment above the `describe` with one line: `//   Subset: $env:LEVELS="8-1,8-2" (same as level-stats).`

- [ ] **Step 7: Smoke the tool on one level, then the engine gate**

Run (bash): `SOLVE=1 LEVELS=1-1 pnpm --filter @apogee/engine exec vitest run level-stats`

Expected: the header line, then one row starting `1-1\tFirst Light\t1\tteach\t` with a `clear1 %` near 3 and a JSON `ref input`. Record the row in your report.

Run: `pnpm --filter @apogee/engine test && pnpm typecheck`

Expected: PASS; engine test count rises by 12 (helpers) with `level-stats.test.ts` skipped.

- [ ] **Step 8: Commit**

```bash
git add packages/engine/tests/level-stats.ts packages/engine/tests/level-stats-helpers.test.ts packages/engine/tests/level-stats.test.ts packages/engine/tests/ablation-audit.test.ts
git commit -m "test(engine): level-stats — the forgiveness sweep as a SOLVE-gated tool

Pure helpers (fine aim grid, one-launch clear / progress / 3-star shares,
shortest-playback reference within par, role bands, TSV) with CI unit
tests on a coarse grid; a SOLVE-gated printer and a LEVELS filter shared
with the ablation audit.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018VCA3FTbkfMqByjoKBDp3r"
```

---

### Task 2: Baseline sweep ("before")

**Files:**
- Modify: `docs/superpowers/specs/2026-09-01-apogee-difficulty-structure-design.md` (§7 Tuning record)
- Create (workspace, gitignored): `.superpowers/sdd/2026-09-09-apogee-difficulty-structure/before.tsv`, `ablation-before.txt`

**Interfaces:**
- Consumes: Task 1's tool.
- Produces: the "before" table in spec §7 and `before.tsv` with a `ref input` per level. Task 3 pastes those references into `SOLUTIONS`; Tasks 6–9 read each level's "before" row.

- [ ] **Step 1: Run the full sweep and the ablation audit**

Run (bash, from the repo root; allow 15 minutes):

```bash
mkdir -p .superpowers/sdd/2026-09-09-apogee-difficulty-structure
SOLVE=1 pnpm --filter @apogee/engine exec vitest run level-stats 2>&1 | grep -E $'^(id|[0-9]+-[0-9]+)\t' > .superpowers/sdd/2026-09-09-apogee-difficulty-structure/before.tsv
SOLVE=1 pnpm --filter @apogee/engine exec vitest run ablation-audit 2>&1 | grep -E '^[0-9]+-[0-9]+' > .superpowers/sdd/2026-09-09-apogee-difficulty-structure/ablation-before.txt
wc -l .superpowers/sdd/2026-09-09-apogee-difficulty-structure/before.tsv
```

Expected: 31 lines (header + 30); `ablation-before.txt` shows every moving level `mechanic required` (or `audit n/a` for sensor-only motion), matching fun-debt's final state. If any level prints `BYPASSABLE`, stop and report — the baseline is not what fun-debt left.

- [ ] **Step 2: Write the "before" table into the spec**

Replace the body of spec §7 (the paragraph under `## Section 7 — Tuning record`) with:

```markdown
### Before (2026-09-09, level-stats @ <short SHA of Task 1's commit>)

Fine grid 360 × 12 (× 8 ticks on moving levels); forgiveness = clear1 % (par 1) or progress % (par 2+); 3★ % among par clears; ref = shortest-playback clearing sequence within par.

| Level | Par | Role | Forgiveness % | 3★ % | Ref steps | Max steps | Verdict |
|---|---|---|---|---|---|---|---|
<one row per level from before.tsv: id + name, par, role, bandMetric, star3, ref steps, max steps, verdict>

### After

_Filled by Task 11._

### Playtest notes

_Filled by Task 12._
```

Generate the rows mechanically rather than by hand:

```bash
tail -n +2 .superpowers/sdd/2026-09-09-apogee-difficulty-structure/before.tsv | awk -F'\t' '{ m = ($3 <= 1) ? $5 : $6; printf "| %s %s | %s | %s | %s | %s | %s | %s | %s |\n", $1, $2, $3, $4, m, $7, $8, $9, $10 }'
```

Paste the output under the table header.

- [ ] **Step 3: Commit (data only)**

```bash
git add docs/superpowers/specs/2026-09-01-apogee-difficulty-structure-design.md
git commit -m "docs(spec): difficulty sprint tuning record — before table

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018VCA3FTbkfMqByjoKBDp3r"
```

---

### Task 3: References for every level; CI replays all thirty

**Files:**
- Modify: `packages/engine/src/campaign/solutions.ts`
- Modify: `packages/engine/tests/campaign-levels.test.ts:45-65`

**Interfaces:**
- Consumes: `before.tsv` `ref input` column (Task 2).
- Produces: `SOLUTIONS` with an entry for every `LEVELS` id; one CI test "every level clears when its stored reference is replayed, within budget and par". Tasks 6–9 keep this test green by refreshing entries as they tune.

- [ ] **Step 1: Fill `SOLUTIONS` for all thirty levels**

Rewrite `packages/engine/src/campaign/solutions.ts` so its header comment reads:

```ts
import type { LaunchInput } from "../types";

/**
 * The reference shot for every level: the shortest-playback clearing sequence
 * within par on the fine aim grid, as measured by the sweep tool
 *   $env:SOLVE=1; pnpm --filter @apogee/engine exec vitest run level-stats
 * (`ref input` column). CI only REPLAYS these; the sweep is the source.
 * Static levels carry no launchTick; moving levels do. Each entry's length is
 * the level's par.
 */
export const SOLUTIONS: Record<string, LaunchInput[]> = {
```

and populate one entry per level, in `LEVELS` order, from the `ref input` JSON in `before.tsv` (static levels' inputs have no `launchTick`; keep the JSON's numbers verbatim). Extract them mechanically:

```bash
tail -n +2 .superpowers/sdd/2026-09-09-apogee-difficulty-structure/before.tsv | awk -F'\t' '{ printf "  \"%s\": %s,\n", $1, $11 }'
```

Every level must have a reference (`ref input` ≠ `—`). If one is `—`, the baseline could not clear it within par on the fine grid: leave that level's existing entry (moving levels) or fall back to `findSolution(level)` printed via `discover-pars`' grid (static levels) and report it — Tasks 6–9 will fix the level.

- [ ] **Step 2: Make the replay test universal and retire the brute-force test**

In `packages/engine/tests/campaign-levels.test.ts`, delete the two tests `"every STATIC level is solvable within its launch budget (brute force)"` and `"every MOVING level clears when its stored solution is replayed"` and the now-unused imports (`isMovingLevel`, `findSolution`), and add in their place:

```ts
  it("every level has a stored reference that clears within budget and par", () => {
    for (const lvl of LEVELS) {
      const seq = SOLUTIONS[lvl.id];
      expect(seq, `no reference for ${lvl.id} — run SOLVE=1 level-stats and paste its ref input`).toBeDefined();
      expect(seq!.length, `${lvl.id} reference exceeds budget`).toBeLessThanOrEqual(lvl.launchBudget);
      expect(seq!.length, `${lvl.id} par is aspirational`).toBeLessThanOrEqual(lvl.par);
      if (!isMovingLevel(lvl)) {
        expect(seq!.every((i) => i.launchTick === undefined), `${lvl.id} is static; drop launchTick`).toBe(true);
      }
      let s = createLevel(lvl);
      for (const input of seq!) s = simulateCampaignLaunch(s, input).state;
      expect(evaluateObjectives(s).cleared, `reference for ${lvl.id} no longer clears`).toBe(true);
    }
  });

  it("no reference is stored for an id that is not a level", () => {
    const ids = new Set(LEVELS.map((l) => l.id));
    for (const id of Object.keys(SOLUTIONS)) expect(ids.has(id), `stale SOLUTIONS entry ${id}`).toBe(true);
  });
```

(Keep the `isMovingLevel` import — the new test uses it; drop only `findSolution`.)

- [ ] **Step 3: Engine gate**

Run: `pnpm --filter @apogee/engine test && pnpm typecheck`

Expected: PASS. `campaign-levels.test.ts` runs in well under a second now (no brute force). Engine test count: −2 +2.

- [ ] **Step 4: Commit**

```bash
git add packages/engine/src/campaign/solutions.ts packages/engine/tests/campaign-levels.test.ts
git commit -m "test(engine): CI replays a stored reference shot for every level

SOLUTIONS now covers all thirty ids with the sweep's shortest-playback
reference; the static brute-force solvability test is retired (a level
tuned to the test band can have no hit on the coarse grid).

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018VCA3FTbkfMqByjoKBDp3r"
```

---

### Task 4: Chapters (engine data + CI test)

**Files:**
- Create: `packages/engine/src/campaign/chapters.ts`
- Modify: `packages/engine/src/campaign/index.ts`
- Create: `packages/engine/tests/campaign-chapters.test.ts`

**Interfaces:**
- Produces: `interface Chapter { index: number; title: string; mechanic: string; levelIds: string[] }` and `CHAPTERS: Chapter[]` (10 entries, three ids each, ladder order), exported from `@apogee/engine`. Task 5 consumes both.

- [ ] **Step 1: Write the failing test**

Create `packages/engine/tests/campaign-chapters.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CHAPTERS } from "../src/campaign/chapters";
import { LEVELS } from "../src/campaign/levels";

describe("chapters", () => {
  it("are ten chapters of three levels each, in ladder order", () => {
    expect(CHAPTERS).toHaveLength(10);
    CHAPTERS.forEach((c, i) => {
      expect(c.index).toBe(i + 1);
      expect(c.levelIds).toHaveLength(3);
      expect(c.title.length).toBeGreaterThan(0);
      expect(c.mechanic.length).toBeGreaterThan(0);
    });
  });

  it("cover every level id exactly once, in LEVELS order", () => {
    expect(CHAPTERS.flatMap((c) => c.levelIds)).toEqual(LEVELS.map((l) => l.id));
  });

  it("put each chapter's intro on its first level only", () => {
    const byId = new Map(LEVELS.map((l) => [l.id, l]));
    for (const c of CHAPTERS) {
      const [first, ...rest] = c.levelIds;
      expect(byId.get(first!)!.intro, `${c.index} first level has an intro`).toBeDefined();
      for (const id of rest) expect(byId.get(id)!.intro, `${id} carries no intro`).toBeUndefined();
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @apogee/engine exec vitest run campaign-chapters`

Expected: FAIL — cannot resolve `../src/campaign/chapters`.

- [ ] **Step 3: Write the data**

Create `packages/engine/src/campaign/chapters.ts`:

```ts
/** A chapter of the campaign ladder: three levels teaching one idea. Presentation data;
 *  the simulation never reads it. */
export interface Chapter {
  index: number;
  title: string;
  mechanic: string;
  levelIds: string[];
}

const LADDER: [title: string, mechanic: string][] = [
  ["Gravity", "reach the goal"],
  ["Blockers", "curve around what kills you"],
  ["Keys", "unlock, then land"],
  ["Marks", "hit every target"],
  ["Combined", "everything so far"],
  ["Moons", "moving gravity"],
  ["Moons & more", "timing meets guards and keys"],
  ["Wormholes", "in one mouth, out the other"],
  ["Wormholes & more", "portals with keys, marks, guards"],
  ["Capstone", "all of it"],
];

export const CHAPTERS: Chapter[] = LADDER.map(([title, mechanic], i) => ({
  index: i + 1,
  title,
  mechanic,
  levelIds: [1, 2, 3].map((n) => `${i + 1}-${n}`),
}));
```

Add to `packages/engine/src/campaign/index.ts`, after the `LEVELS` export line:

```ts
export { CHAPTERS, type Chapter } from "./chapters";
```

- [ ] **Step 4: Run the test, then the gate**

Run: `pnpm --filter @apogee/engine exec vitest run campaign-chapters`

Expected: PASS, 3/3.

Run: `pnpm --filter @apogee/engine test && pnpm typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src/campaign/chapters.ts packages/engine/src/campaign/index.ts packages/engine/tests/campaign-chapters.test.ts
git commit -m "feat(engine): CHAPTERS — ten titled chapters over the level ladder

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018VCA3FTbkfMqByjoKBDp3r"
```

---

### Task 5: Map with chapter headers and a star total

**Files:**
- Create: `packages/web/src/campaign/mapModel.ts`
- Create: `packages/web/tests/campaign/mapModel.test.ts`
- Modify: `packages/web/src/campaign/CampaignMap.tsx`
- Modify: `packages/web/src/styles.css:125-128` (and the 480 px media block)

**Interfaces:**
- Consumes: `CHAPTERS`, `LEVELS` from `@apogee/engine`; `isUnlocked`, `loadProgress`, `CampaignProgress` from `./campaignStorage`; `appStorage`.
- Produces: `chapterSections(progress)`, `totalStars(progress)`, `MAX_STARS` (= 90). Only `CampaignMap` consumes them.

- [ ] **Step 1: Write the failing tests**

Create `packages/web/tests/campaign/mapModel.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MAX_STARS, chapterSections, totalStars } from "../../src/campaign/mapModel";
import type { CampaignProgress } from "../../src/campaign/campaignStorage";

describe("chapter sections", () => {
  it("groups thirty numbered tiles under ten chapters in order", () => {
    const sections = chapterSections({});
    expect(sections).toHaveLength(10);
    const numbers = sections.flatMap((s) => s.tiles.map((t) => t.number));
    expect(numbers).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    expect(sections[2]!.chapter.title).toBe("Keys");
    expect(sections[2]!.tiles.map((t) => t.level.id)).toEqual(["3-1", "3-2", "3-3"]);
  });

  it("unlocks only the first tile on a fresh profile", () => {
    const tiles = chapterSections({}).flatMap((s) => s.tiles);
    expect(tiles.filter((t) => t.unlocked).map((t) => t.number)).toEqual([1]);
    expect(tiles.every((t) => t.stars === 0)).toBe(true);
  });

  it("carries best stars and unlocks the next tile after a clear", () => {
    const progress: CampaignProgress = { "1-1": { cleared: true, stars: 2 } };
    const tiles = chapterSections(progress).flatMap((s) => s.tiles);
    expect(tiles[0]!.stars).toBe(2);
    expect(tiles[1]!.unlocked).toBe(true);
    expect(tiles[2]!.unlocked).toBe(false);
  });
});

describe("total stars", () => {
  it("is 90 at most and 0 on a fresh profile", () => {
    expect(MAX_STARS).toBe(90);
    expect(totalStars({})).toBe(0);
  });

  it("sums best stars across levels, clamped to 3 each, ignoring unknown ids", () => {
    const progress: CampaignProgress = {
      "1-1": { cleared: true, stars: 3 },
      "1-2": { cleared: true, stars: 1 },
      "2-1": { cleared: false, stars: 0 },
      "9-9": { cleared: true, stars: 3 },
      "3-1": { cleared: true, stars: 7 },
    };
    expect(totalStars(progress)).toBe(7);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @apogee/web exec vitest run mapModel`

Expected: FAIL — cannot resolve `../../src/campaign/mapModel`.

- [ ] **Step 3: Write the model**

Create `packages/web/src/campaign/mapModel.ts`:

```ts
import { CHAPTERS, LEVELS, type Chapter, type Level } from "@apogee/engine";
import { isUnlocked, type CampaignProgress } from "./campaignStorage";

export const MAX_STARS = LEVELS.length * 3;

export interface Tile {
  level: Level;
  /** 1-based position in the ladder, as printed on the tile. */
  number: number;
  unlocked: boolean;
  stars: number;
}

export interface ChapterSection {
  chapter: Chapter;
  tiles: Tile[];
}

/** The map, chapter by chapter. Unlocking stays linear across the whole ladder. */
export function chapterSections(progress: CampaignProgress): ChapterSection[] {
  const ids = LEVELS.map((l) => l.id);
  return CHAPTERS.map((chapter) => ({
    chapter,
    tiles: chapter.levelIds.map((id) => {
      const index = ids.indexOf(id);
      return {
        level: LEVELS[index]!,
        number: index + 1,
        unlocked: isUnlocked(progress, ids, index),
        stars: clampStars(progress[id]?.stars),
      };
    }),
  }));
}

/** Best stars summed over every level; the HUD shows it as `★ n / MAX_STARS`. */
export function totalStars(progress: CampaignProgress): number {
  return LEVELS.reduce((sum, l) => sum + clampStars(progress[l.id]?.stars), 0);
}

function clampStars(n: number | undefined): number {
  if (n === undefined || !Number.isFinite(n)) return 0;
  return Math.min(3, Math.max(0, Math.floor(n)));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @apogee/web exec vitest run mapModel`

Expected: PASS, 5/5.

- [ ] **Step 5: Render from the model**

Replace `packages/web/src/campaign/CampaignMap.tsx` with:

```tsx
import { useMemo } from "react";
import { loadProgress } from "./campaignStorage";
import { MAX_STARS, chapterSections, totalStars } from "./mapModel";
import { appStorage } from "../safeStorage";

interface Props {
  onExit: () => void;
  onPlay: (index: number) => void;
}

export function CampaignMap({ onExit, onPlay }: Props) {
  const progress = useMemo(() => loadProgress(appStorage), []);
  const sections = useMemo(() => chapterSections(progress), [progress]);
  const stars = totalStars(progress);

  return (
    <>
      <div className="hud">
        <button className="back" onClick={onExit} aria-label="Back to menu" title="Back to menu">←</button>
        <h1>Campaign</h1>
        <span className="stat total-stars" aria-label={`${stars} of ${MAX_STARS} stars`}>
          ★ {stars} / {MAX_STARS}
        </span>
      </div>
      <div className="chapters">
        {sections.map(({ chapter, tiles }) => (
          <section className="chapter" key={chapter.index}>
            <div className="chapter-head">
              <span className="chapter-title">Chapter {chapter.index} · {chapter.title}</span>
              <span className="chapter-mechanic">{chapter.mechanic}</span>
            </div>
            <div className="level-grid">
              {tiles.map((t) => (
                <button
                  key={t.level.id}
                  className={`level-tile${t.unlocked ? "" : " locked"}`}
                  disabled={!t.unlocked}
                  onClick={() => onPlay(t.number - 1)}
                >
                  <span className="num">{t.number}</span>
                  <span className="name">{t.level.name}</span>
                  <span className="stars">
                    {t.unlocked ? "★".repeat(t.stars) + "☆".repeat(3 - t.stars) : "🔒"}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 6: Style the sections**

In `packages/web/src/styles.css`, replace the `.level-grid` rule (lines 125–128) with:

```css
.chapters { display: flex; flex-direction: column; gap: 22px; max-width: 1100px; width: 100%; }
.chapter { display: flex; flex-direction: column; gap: 10px; }
.chapter-head {
  display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap;
  padding-bottom: 4px; border-bottom: 1px solid rgba(128, 170, 230, 0.12);
}
.chapter-title { letter-spacing: 0.14em; font-weight: 700; text-transform: uppercase; font-size: 0.85rem; }
.chapter-mechanic { color: var(--muted); font-size: 0.85rem; }
.level-grid {
  display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px; width: 100%;
}
```

and inside the existing `@media (max-width: 480px)` block (line 50), add:

```css
  .level-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .chapters { gap: 18px; }
```

- [ ] **Step 7: Web gate and a visual check**

Run: `pnpm --filter @apogee/web typecheck && pnpm --filter @apogee/web test`

Expected: PASS; web tests 106 + 5 = 111.

Start `pnpm --filter @apogee/web exec vite --port 5199 --strictPort` in the background and, in a browser (Chrome MCP or a Playwright script), open Campaign at 1280 × 800 and at 390 × 844. Expected: ten headers reading `CHAPTER 1 · GRAVITY` with the mechanic line beside them, three tiles per row on desktop and two per row at 390 px, tile numbers 1–30 in order, the HUD reading `★ 0 / 90`, `.hud` on one line at 390 px (`scrollWidth === clientWidth`). Take a screenshot of each and save them in the workspace. Then seed `localStorage.setItem("apogee-campaign-progress", JSON.stringify({"1-1":{cleared:true,stars:3},"1-2":{cleared:true,stars:2}}))`, reload, and confirm `★ 5 / 90` and tile 3 unlocked.

- [ ] **Step 8: Commit**

```bash
git add packages/web/src/campaign/mapModel.ts packages/web/tests/campaign/mapModel.test.ts packages/web/src/campaign/CampaignMap.tsx packages/web/src/styles.css
git commit -m "feat(web): campaign map in chapters with a star total

Pure mapModel groups the ladder under CHAPTERS and sums best stars; the
map renders a header row per chapter over three-tile rows (two on
phones) and the HUD shows ★ n / 90.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018VCA3FTbkfMqByjoKBDp3r"
```

---

## The tuning loop (Tasks 6–9 share it)

Each of Tasks 6–9 tunes one group of levels with this loop. The sweep is the referee; the spec's Section 2 row is the starting action; the levers are ordered in the Global Constraints.

For each level in the task's group, in ladder order:

1. **Read the "before" row** (`before.tsv`, or the running `tuning-log.md` if an earlier task in this sprint already touched it) and the level's Section 2 action.
2. **Decide the edit** against the verdict column: forgiveness band (on `clear1` for par 1, `progress` for par 2+), 3★ band, ref ≤ 720 steps. Prefer the first applicable lever: sensor radius (keys 26–36, targets 22–30, goals 32–44) → sensor position along the natural arc → blocker position → body radius/mass → budget. Keep the level's name, theme, and body count recognisable; a "tighten hard" row may move the goal, not add a mechanic.
3. **Edit the level literal** in `packages/engine/src/campaign/levels.ts`. Keep comments that explain a non-obvious choice; add one when the new geometry is non-obvious.
4. **Re-measure just that level:** `SOLVE=1 LEVELS=<id> pnpm --filter @apogee/engine exec vitest run level-stats` (bash) or the PowerShell form from Task 1. Iterate steps 2–4 until the verdict is `in band`. Cap: **six iterations per level**; if still out of band, keep the best iteration, and record the level as an exception with its measured numbers and what was tried.
5. **Refresh the reference:** paste the row's `ref input` JSON into `SOLUTIONS[<id>]`; set `par` to its length. If `par > launchBudget − 1`, set `launchBudget = par + 2`. A par-2 level whose reference is now one launch becomes par 1 (and its role band switches to `clear1`); re-measure once more after changing par, because `star3` on par-2+ depends on it.
6. **Moving levels only:** `SOLVE=1 LEVELS=<id> pnpm --filter @apogee/engine exec vitest run ablation-audit` must print `mechanic required` on every twin. If it prints `BYPASSABLE`, the printed sequence shows the hole — go back to step 3 (a relayout that opens a bypass is wrong, whatever the band says).
7. **CI gate:** `pnpm --filter @apogee/engine test` — the replay test must pass for the new reference; goldens unchanged (`git status --short` shows no `.snap` with content hunks; `git diff --stat` shows none).
8. **Log the row** in `.superpowers/sdd/2026-09-09-apogee-difficulty-structure/tuning-log.md`: `| id name | before: metric / star3 / ref | action (lever, numbers) | after: metric / star3 / ref / verdict | iterations |`.

One commit per task (all its levels), plus a second commit if `launchBudget` or `par` changed for any level so the diff reads clearly — the task's Step 3 says which.

---

### Task 6: Tune chapters 1–2 (levels 1-1 … 2-3)

**Files:**
- Modify: `packages/engine/src/campaign/levels.ts` (levels `1-1` … `2-3` only)
- Modify: `packages/engine/src/campaign/solutions.ts` (those ids)
- Create/append: `.superpowers/sdd/2026-09-09-apogee-difficulty-structure/tuning-log.md`

**Interfaces:** the tuning loop above. Section 2 rows: 1-1 keep; 1-2 tighten slightly (goal radius or position); 1-3 tighten hard — the goal must sit where only a slingshot reaches it; 2-1 keep; 2-2 keep; 2-3 tighten (narrow the corridor). Sprint-1 note: 1-1 and 2-2 had 3★ shares above 40 % — retune by goal radius within 32–44.

- [ ] **Step 1: Run the loop for 1-1, 1-2, 1-3, 2-1, 2-2, 2-3**

"Keep" rows still get measured and, if the verdict is out of band (3★ share, most likely), a sensor-radius change only.

- [ ] **Step 2: Group re-measure and gate**

Run: `SOLVE=1 LEVELS=1-1,1-2,1-3,2-1,2-2,2-3 pnpm --filter @apogee/engine exec vitest run level-stats`

Expected: six rows, every verdict `in band` (exceptions recorded in the log with numbers). Then `pnpm --filter @apogee/engine test && pnpm typecheck` → PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/engine/src/campaign/levels.ts packages/engine/src/campaign/solutions.ts
git commit -m "feat(engine): tune chapters 1-2 to teach / twist / test

<one line per changed level: id, lever, before → after forgiveness and 3★>

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018VCA3FTbkfMqByjoKBDp3r"
```

---

### Task 7: Tune chapters 3–5 (levels 3-1 … 5-3)

**Files:** as Task 6, for ids `3-1` … `5-3`.

**Interfaces:** the tuning loop. Section 2 rows: 3-1 loosen (larger key 26→up to 36, or key on the natural arc); 3-2 loosen slightly; 3-3 relayout so the intended shot is direct (ref was 45 s), keep the test band; 4-1, 4-2, 4-3 measure `progress %`, then act; 5-1 measure, then act — and the sticky-max check: if `star3` is above 40 % because the reference's first launch bullseyes the target, change the layout so the natural first launch collects the key (keys carry no precision) and the second launch takes target and goal, or move the target so the first pass cannot be a bullseye; 5-2 loosen slightly; 5-3 relayout so the reference ≤ 720 steps (was 29 s).

- [ ] **Step 1: Run the loop for 3-1, 3-2, 3-3, 4-1, 4-2, 4-3, 5-1, 5-2, 5-3**

Par-2 levels: the band is on `progress %`; `star3` is measured on the last launch after the reference prefix. A par-2 level whose reference becomes one launch is now par 1 — set it, and re-measure.

- [ ] **Step 2: Group re-measure and gate**

Run: `SOLVE=1 LEVELS=3-1,3-2,3-3,4-1,4-2,4-3,5-1,5-2,5-3 pnpm --filter @apogee/engine exec vitest run level-stats`

Expected: nine rows in band (exceptions logged). `pnpm --filter @apogee/engine test && pnpm typecheck` → PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/engine/src/campaign/levels.ts packages/engine/src/campaign/solutions.ts
git commit -m "feat(engine): tune chapters 3-5 — keys loosen, tests tighten, no orbit references

<one line per changed level>

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018VCA3FTbkfMqByjoKBDp3r"
```

---

### Task 8: Tune chapters 6–7 (levels 6-1 … 7-3, moving)

**Files:** as Task 6, for ids `6-1` … `7-3`.

**Interfaces:** the tuning loop, including step 6 (ablation) for every level here except `7-2` and `7-3` if they carry only sensor motion (the audit prints `audit n/a` for those). Section 2 rows: 6-1..6-3 re-measure after relayouts, expect 6-2 and 6-3 to need tightening; 7-1 keep unless the relayout moved it; 7-2 loosen (was 0.10 %); 7-3 keep (3★ was 100 % — retune by target radius 22–30 or position). The fun-debt clearance rule binds: every moon over its whole orbit ≥ 12 units from every blocker.

- [ ] **Step 1: Run the loop for 6-1, 6-2, 6-3, 7-1, 7-2, 7-3**

- [ ] **Step 2: Group re-measure, ablation, gate**

Run: `SOLVE=1 LEVELS=6-1,6-2,6-3,7-1,7-2,7-3 pnpm --filter @apogee/engine exec vitest run level-stats`
Run: `SOLVE=1 LEVELS=6-1,6-2,6-3,7-1,7-2,7-3 pnpm --filter @apogee/engine exec vitest run ablation-audit`

Expected: six rows in band; every audited twin `mechanic required`. `pnpm --filter @apogee/engine test && pnpm typecheck` → PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/engine/src/campaign/levels.ts packages/engine/src/campaign/solutions.ts
git commit -m "feat(engine): tune chapters 6-7 — moons ramp teach / twist / test

<one line per changed level>

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018VCA3FTbkfMqByjoKBDp3r"
```

---

### Task 9: Tune chapters 8–10 (levels 8-1 … 10-3, portals and moons)

**Files:** as Task 6, for ids `8-1` … `10-3`.

**Interfaces:** the tuning loop with ablation on every level. Section 2 rows: 8-1..8-3 re-measure (8-1 may need loosening, 8-3 tightening); 9-1 loosen (0.16 %); 9-2 measure, then act, with the sticky-max check as in 5-1; 9-3 tighten hard and shorten the reference (was 15 s); 10-1 loosen; 10-2 relayout for a direct reference (was 45 s), loosen toward the twist band; 10-3 measure, then act. Walls in these chapters are load-bearing for the audit (see the comments in `levels.ts`): tune by moving mouths, sensors, and the moon system before touching a wall, and keep the 12-unit clearance.

- [ ] **Step 1: Run the loop for 8-1, 8-2, 8-3, 9-1, 9-2, 9-3, 10-1, 10-2, 10-3**

- [ ] **Step 2: Group re-measure, ablation, gate**

Run: `SOLVE=1 LEVELS=8-1,8-2,8-3,9-1,9-2,9-3,10-1,10-2,10-3 pnpm --filter @apogee/engine exec vitest run level-stats`
Run: `SOLVE=1 LEVELS=8-1,8-2,8-3,9-1,9-2,9-3,10-1,10-2,10-3 pnpm --filter @apogee/engine exec vitest run ablation-audit`

Expected: nine rows in band; every twin `mechanic required`. `pnpm --filter @apogee/engine test && pnpm typecheck` → PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/engine/src/campaign/levels.ts packages/engine/src/campaign/solutions.ts
git commit -m "feat(engine): tune chapters 8-10 — doors and clocks ramp, references under 12 s

<one line per changed level>

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018VCA3FTbkfMqByjoKBDp3r"
```

---

### Task 10: Full sweep, full audit, "after" table

**Files:**
- Modify: `docs/superpowers/specs/2026-09-01-apogee-difficulty-structure-design.md` (§7 "After")
- Create (workspace): `after.tsv`, `ablation-after.txt`

**Interfaces:** consumes everything above; produces the "after" table Task 12's playtest and the final review read.

- [ ] **Step 1: Run everything**

```bash
W=.superpowers/sdd/2026-09-09-apogee-difficulty-structure
SOLVE=1 pnpm --filter @apogee/engine exec vitest run level-stats 2>&1 | grep -E $'^(id|[0-9]+-[0-9]+)\t' > $W/after.tsv
SOLVE=1 pnpm --filter @apogee/engine exec vitest run ablation-audit 2>&1 | grep -E '^[0-9]+-[0-9]+' > $W/ablation-after.txt
grep -c "in band" $W/after.tsv; grep -v "in band" $W/after.tsv | tail -n +2
grep -vc "mechanic required\|audit n/a" $W/ablation-after.txt
```

Expected: `in band` count 30 (any other row is an exception that Tasks 6–9 logged — list them); the last count 0. Then confirm `SOLUTIONS` still matches: for every level, `after.tsv`'s `ref input` should replay to a clear (the CI test proves it) and have length = `par`.

- [ ] **Step 2: Write the "after" table**

Under spec §7 `### After`, replace the placeholder with the same table shape as "before", generated with the Task 2 Step 2 `awk` line over `after.tsv`, headed `### After (2026-09-xx, level-stats @ <short SHA of Task 9's commit>)`, followed by an `**Exceptions**` list (level, measured numbers, what was tried, why it stands) copied from `tuning-log.md` — or `None.`

- [ ] **Step 3: Full gate and commit**

Run: `pnpm test && pnpm typecheck && pnpm --filter @apogee/web build`

Expected: green; daily and campaign goldens unchanged (`git diff --stat` shows no `.snap`).

```bash
git add docs/superpowers/specs/2026-09-01-apogee-difficulty-structure-design.md
git commit -m "docs(spec): difficulty sprint tuning record — after table

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_018VCA3FTbkfMqByjoKBDp3r"
```

---

### Task 11: Sprint verification sweep (controller)

**Files:** none new unless something shakes loose.

- [ ] **Step 1: Constraints held**

```bash
git diff --stat main..HEAD -- packages/engine/src
git diff main..HEAD -- packages/engine/src | grep -nE "^\+.*Math\.(cos|sin|tan|atan|pow|exp|log)" || echo "no trig in src"
git diff --stat main..HEAD -- packages/engine/tests/__snapshots__ packages/engine/src/scoring.ts packages/engine/src/campaign/scoring.ts packages/engine/src/campaign/simulate.ts packages/engine/src/physics.ts
```

Expected: `src` diff is exactly `campaign/levels.ts`, `campaign/solutions.ts`, `campaign/chapters.ts`, `campaign/index.ts`; no trig lines; the second stat is empty.

- [ ] **Step 2: Success criteria against `after.tsv`**

1. Every level in its role band; every chapter reads teach / twist / test — from `after.tsv`, the three forgiveness values per chapter must be strictly decreasing x-1 > x-2 > x-3 (print the ten triples).
2. 3★ share 10–40 % on every level (column `star3 %`).
3. Every `ref steps` ≤ 720; every audited twin `mechanic required` (`ablation-after.txt`).
4. Map shows chapters and a star total (Task 5's screenshots).
5. Criterion 5 is Kevin's (Task 12).

- [ ] **Step 3: Push, PR, CI**

`git push -u origin feat/difficulty-structure`; Kevin opens the PR from `https://github.com/kcselm/apogee/compare/main...feat/difficulty-structure?expand=1` (title `Difficulty & campaign structure (sprint 5)`); CI must be green. Deploy a preview for the playtest: `pnpm --filter @apogee/web build && npx wrangler pages deploy packages/web/dist --project-name apogee --branch feat-difficulty-structure` → `https://feat-difficulty-structure.apogee-7w9.pages.dev`.

---

### Task 12: Playtest checkpoint (Kevin — not an agent task)

On the preview URL, from a fresh profile:

1. Play each chapter's third level once, cold. Which ones felt like a test? Which felt like luck?
2. Count first-try 3★ on the test levels (target: at most two of ten) and teach levels cleared within two attempts (target: all ten).
3. Do the chapter 8–10 doors read as doors after the retune, or do you still slingshot the wall?
4. Does the map read as a ladder now?

Answers go into spec §7 `### Playtest notes` as a data-only commit. Anything that needs a layout change re-enters the tuning loop for that level (one more commit, then re-run Task 10's sweep for the touched ids and refresh the "after" rows).

---

### Task 13: Finish (Kevin's merge, controller's deploy)

- [ ] Merge `--no-ff` with a body naming the sprint and the "after" verdict counts; push `main`; delete the branch; deploy production with the Global Constraints command; check `https://apogee-7w9.pages.dev` on a phone: map shows chapters, `★ n / 90`, and a tuned level plays.

---

## Self-review

**Spec coverage.** Decision 1 / §1 sweep tool → Task 1 (with the `LEVELS` filter, deviation 5). Decision 2 bands → `BANDS` and `verdict` in Task 1, enforced in Tasks 6–9, proven in Tasks 10–11. Decision 3 (3★ 10–40 %, never by editing `RINGS`) → `STAR3_BAND`, the levers list, Global Constraints. Decision 4 (reference ≤ 12 s, shortest-playback) → `REF_STEP_CAP`, `referenceSequence`, loop step 5. Decision 5 (chapters 1–5 may change) → Tasks 6–7. Decision 6 (map headers, star total) → Tasks 4–5. Decision 7 (playtest before the record is committed) → Task 12 sits before Task 13, and Task 10's "after" table is amended by Task 12 if needed. §2 actions → the Interfaces block of each tuning task quotes its rows. §3 → Task 3 and loop step 5. §4 → Tasks 4–5 verbatim titles. §5 process → Tasks 2, 6–9, 3, 10, 12, 10. §6 testing → Task 1 helpers tests, Task 3 replay test, Task 4 chapters test, Task 5 model tests; goldens covered by the constraint. §7 → Tasks 2, 10, 12.

**Placeholders.** Tasks 6–9 cannot carry final numbers by design: the spec says "measure, then act" and every action is gated by a measured verdict; each task states its rows, its levers, its iteration cap, its commands, and its exception rule. Commit-message `<one line per changed level>` lines are filled from `tuning-log.md`. `<short SHA …>` in Tasks 2 and 10 is the commit the executor just made.

**Type consistency.** `LevelStats`, `Reference`, `Role`, `verdict`, `toTsvRow`, `TSV_HEADER` are defined once in Task 1 and used by its own printer and tests; `Chapter`/`CHAPTERS` defined in Task 4, consumed in Task 5 through `@apogee/engine`; `CampaignProgress` and `isUnlocked` already exist in `campaignStorage.ts` with the signatures Task 5 calls. `SOLUTIONS: Record<string, LaunchInput[]>` keeps its type in Task 3.

**Checked at plan time.** `MAX_SPEED / POWER_SCALE = 600 / 3 = 200` (deviation 3). `clearedAtStep` is a trace index (`simulate.ts:71-73`), so `clearedAtStep + 1` steps play. Keys carry no precision (`simulate.ts`, "Keys carry no precision"), which is the layout lever for 5-1 / 9-2. The campaign golden fixtures are literals in the test file, not `LEVELS` entries. Web tests run in Node with no DOM, which is why the map's logic lives in a pure `mapModel.ts`. `isUnlocked(progress, ids, index)` takes the global index, so linear unlocking survives grouping.

**Risks.** The full fine-grid sweep on moving levels multiplies the reference search by 8 ticks and up to three layers for par-3 (10-3); if Task 2's run exceeds 30 minutes, lower `perSignature` to 2 in `referenceSequence`'s call from `levelStats` and note it. A level that cannot reach its band by layout within six iterations is an exception, not a blocker; the sprint's bar is the "after" table with its exceptions visible, and Kevin's playtest decides whether they stand.
