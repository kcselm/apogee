import type { CampaignLevelState, Objective } from "./types";

/** Whether one objective is met against raw progress flags. */
function objectiveMet(
  o: Objective,
  targetsHit: readonly boolean[],
  goalReached: boolean,
): boolean {
  switch (o.kind) {
    case "reach-goal":
      return goalReached;
    case "hit-all-targets":
      return targetsHit.length > 0 && targetsHit.every(Boolean);
  }
}

/** True when every objective is met against raw progress flags (and there is at
 *  least one objective). Used by the sim to stamp `clearedAtStep` per step. */
export function allObjectivesMet(
  objectives: readonly Objective[],
  targetsHit: readonly boolean[],
  goalReached: boolean,
): boolean {
  return (
    objectives.length > 0 &&
    objectives.every((o) => objectiveMet(o, targetsHit, goalReached))
  );
}

/** Which objectives are met, and whether the level is cleared (all met). */
export function evaluateObjectives(
  state: CampaignLevelState,
): { met: boolean[]; cleared: boolean } {
  const met = state.level.objectives.map((o) =>
    objectiveMet(o, state.targetsHit, state.goalReached),
  );
  return { met, cleared: allObjectivesMet(state.level.objectives, state.targetsHit, state.goalReached) };
}

export function isLevelOver(state: CampaignLevelState): boolean {
  return (
    evaluateObjectives(state).cleared ||
    state.launchesUsed >= state.level.launchBudget
  );
}
