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
    { text: "closest approach in the bullseye", met: state.launchesUsed <= par && state.bestPrecision >= 5 },
  ];
}
