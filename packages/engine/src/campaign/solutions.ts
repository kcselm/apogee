import type { LaunchInput } from "../types";

/**
 * Known-good clearing input sequences (≥1★) for moving/portal levels, keyed by
 * level id. Filled by running the discovery tool:
 *   $env:SOLVE=1; pnpm --filter @apogee/engine exec vitest run discover-solutions
 * then pasting the printed sequences here. CI only REPLAYS these.
 */
export const SOLUTIONS: Record<string, LaunchInput[]> = {
  "6-1": [{ dx: 177.26539554219744, dy: 31.25667198004746, launchTick: 120 }],
  "6-2": [{ dx: 126.883090185131, dy: 59.16655664369792, launchTick: 30 }],
  "6-3": [{ dx: 177.26539554219744, dy: 31.25667198004746, launchTick: 60 }],
  "7-1": [{ dx: 173.8666487320323, dy: 46.58742811845373, launchTick: 0 }],
  "7-2": [{ dx: 212.50368178359503, dy: 56.940189922554566, launchTick: 150 }],
  "7-3": [{ dx: 219.162833580184, dy: 19.174263404484797, launchTick: 120 }],
  "8-1": [{ dx: 44.99513267805776, dy: 53.62311101832846, launchTick: 0 }],
  "8-2": [{ dx: 190.52558883257652, dy: 109.99999999999999, launchTick: 0 }],
  "8-3": [{ dx: 169.14467174146353, dy: 61.56362579862037, launchTick: 0 }],
};
