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
