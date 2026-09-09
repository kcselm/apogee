import type { LaunchInput } from "../types";

/**
 * Known-good clearing input sequences (≥1★) for moving/portal levels, keyed by
 * level id. Filled by running the discovery tool:
 *   $env:SOLVE=1; pnpm --filter @apogee/engine exec vitest run discover-solutions
 * then pasting the printed sequences here. CI only REPLAYS these.
 */
export const SOLUTIONS: Record<string, LaunchInput[]> = {
  "6-1": [{ dx: 68.93654271085457, dy: 12.155372436685123, launchTick: 240 }],
  "6-2": [{ dx: 155.56349186104046, dy: 155.56349186104043, launchTick: 60 }],
  "6-3": [{ dx: 126.18681599723013, dy: 180.2134497435782, launchTick: 240 }],
  "7-1": [{ dx: 107.24622203665692, dy: 89.9902653561155, launchTick: 390 }],
  "7-2": [{ dx: 212.50368178359503, dy: 56.940189922554566, launchTick: 150 }],
  "7-3": [{ dx: 219.162833580184, dy: 19.174263404484797, launchTick: 120 }],
  "8-1": [{ dx: 40, dy: 0, launchTick: 0 }],
  "8-2": [{ dx: 141.41327413103866, dy: 168.52977748617516, launchTick: 0 }],
  "8-3": [{ dx: 206.73237657289985, dy: 75.24443153164712, launchTick: 0 }],
  "9-1": [{ dx: 163.13540166659698, dy: 76.0712871133259, launchTick: 0 }],
  "9-2": [
    { dx: 131.55696691002717, dy: 47.88282006559362, launchTick: 0 },
    { dx: -179.3150456565142, dy: -15.68803369457843, launchTick: 0 },
  ],
  "9-3": [{ dx: -177.26539554219744, dy: -31.256671980047486, launchTick: 0 }],
  "10-1": [
    { dx: 173.8666487320323, dy: 46.58742811845373, launchTick: 0 },
    { dx: -179.3150456565142, dy: -15.68803369457843, launchTick: 0 },
  ],
  "10-2": [
    { dx: -212.50368178359506, dy: -56.940189922554474, launchTick: 0 },
    { dx: -177.26539554219744, dy: -31.256671980047486, launchTick: 0 },
  ],
  "10-3": [
    { dx: -199.387713148063, dy: -92.97601758295384, launchTick: 0 },
    { dx: 180.2134497435782, dy: 126.18681599723013, launchTick: 0 },
  ],
};
