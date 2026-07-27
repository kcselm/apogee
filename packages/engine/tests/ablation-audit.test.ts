import { describe, it } from "vitest";
import { LEVELS, isMovingLevel } from "../src/campaign/levels";
import type { Level } from "../src/campaign/types";
import { findTimedSolution } from "./campaign-solver-timed";

declare const process: { env: { SOLVE?: string } };

/** The level with its signature mechanic deleted: orbiting bodies keep their
 *  position, radius, and collision but lose gravity (mass 0); portals are
 *  removed. Orbiting keys/targets are objectives, not mechanics — untouched. */
function ablate(lvl: Level): Level {
  return {
    ...lvl,
    bodies: lvl.bodies.map((b) => (b.orbit ? { ...b, mass: 0 } : b)),
    portals: undefined,
  };
}

// A moving level is BYPASSABLE if it clears with its mechanic deleted.
// Spec target: every flagged level gets relayouted until this prints clean.
// Skipped in CI (brute-force). Run:
//   $env:SOLVE=1; pnpm --filter @apogee/engine exec vitest run ablation-audit
describe.skipIf(!process.env.SOLVE)("ablation audit — moving levels", () => {
  it("prints any level clearable without its mechanic", () => {
    for (const lvl of LEVELS) {
      if (!isMovingLevel(lvl)) continue;
      const hasMechanic =
        lvl.bodies.some((b) => b.orbit != null) || (lvl.portals?.length ?? 0) > 0;
      if (!hasMechanic) {
        // eslint-disable-next-line no-console
        console.log(`${lvl.id}: sensor-motion level — audit n/a`);
        continue;
      }
      const bypass = findTimedSolution(ablate(lvl));
      // eslint-disable-next-line no-console
      console.log(
        `${lvl.id}: ${bypass ? `BYPASSABLE (${bypass.length} launches) ` + JSON.stringify(bypass) : "mechanic required"}`,
      );
    }
  });
});
