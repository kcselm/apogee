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
  if (ref === null || ref.seq.length <= 1) {
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
