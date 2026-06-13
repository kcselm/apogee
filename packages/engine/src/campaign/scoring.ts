import { RINGS } from "../scoring";
import { LAUNCH_BONUS } from "./constants";
import { evaluateObjectives } from "./objectives";
import type { CampaignLevelState } from "./types";

/** Bullseye points (5/3/1/0) for a probe passing `dist` from a center. */
export function precisionPoints(dist: number): number {
  for (const ring of RINGS) {
    if (dist <= ring.maxDist) return ring.points;
  }
  return 0;
}

export function starRating(
  state: CampaignLevelState,
): { stars: 0 | 1 | 2 | 3; levelScore: number } {
  const launchesLeft = state.level.launchBudget - state.launchesUsed;
  const levelScore = launchesLeft * LAUNCH_BONUS + state.bestPrecision;
  if (!evaluateObjectives(state).cleared) return { stars: 0, levelScore };
  const { two, three } = state.level.starThresholds;
  const stars = levelScore >= three ? 3 : levelScore >= two ? 2 : 1;
  return { stars, levelScore };
}
