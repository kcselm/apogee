import { BOARD_PERIOD } from "../src/campaign/constants";
import { evaluateObjectives } from "../src/campaign/objectives";
import { createLevel, simulateCampaignLaunch } from "../src/campaign/simulate";
import type { CampaignLevelState, Level } from "../src/campaign/types";
import type { LaunchInput } from "../src/types";

// Trig + broad search allowed HERE: dev authoring tool, never CI, never the sim loop.
const DIRECTIONS = 72;
const POWERS = [40, 70, 100, 140, 180, 220, 260];
const TICKS = Array.from({ length: 16 }, (_, i) => Math.round((i / 16) * BOARD_PERIOD));

function candidates(): LaunchInput[] {
  const out: LaunchInput[] = [];
  for (let d = 0; d < DIRECTIONS; d++) {
    const t = (d / DIRECTIONS) * Math.PI * 2;
    for (const p of POWERS) {
      for (const tick of TICKS) {
        out.push({ dx: Math.cos(t) * p, dy: Math.sin(t) * p, launchTick: tick });
      }
    }
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

/** Greedy progress-pruned BFS over (dx,dy,launchTick). Returns a clearing sequence
 *  within budget, or null. Same shape as the static solver, plus the tick axis. */
export function findTimedSolution(level: Level): LaunchInput[] | null {
  const cands = candidates();
  let frontier: { state: CampaignLevelState; seq: LaunchInput[] }[] = [
    { state: createLevel(level), seq: [] },
  ];
  for (let depth = 0; depth < level.launchBudget; depth++) {
    const next: typeof frontier = [];
    const seen = new Set<number>();
    for (const node of frontier) {
      const bestBySig = new Map<number, boolean>();
      const baseProg = progress(node.state);
      for (const input of cands) {
        const res = simulateCampaignLaunch(node.state, input);
        if (evaluateObjectives(res.state).cleared) return [...node.seq, input];
        if (progress(res.state) > baseProg) {
          const sig = signature(res.state);
          if (!seen.has(sig) && !bestBySig.has(sig)) {
            bestBySig.set(sig, true);
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
