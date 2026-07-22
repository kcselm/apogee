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
};
