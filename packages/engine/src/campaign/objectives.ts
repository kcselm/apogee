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
