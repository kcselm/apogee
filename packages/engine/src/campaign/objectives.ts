import type { CampaignLevelState } from "./types";

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
  return { met, cleared: met.length > 0 && met.every(Boolean) };
}

export function isLevelOver(state: CampaignLevelState): boolean {
  return (
    evaluateObjectives(state).cleared ||
    state.launchesUsed >= state.level.launchBudget
  );
}
