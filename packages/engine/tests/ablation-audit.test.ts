import { describe, it } from "vitest";
import { LEVELS, isMovingLevel } from "../src/campaign/levels";
import type { Level } from "../src/campaign/types";
import { findTimedSolution } from "./campaign-solver-timed";

declare const process: { env: { SOLVE?: string } };

/** Moon gravity deleted: orbiting bodies keep their position, radius, and
 *  collision but lose gravity (mass 0). Orbiting keys/targets are objectives,
 *  not mechanics — untouched. */
function ablateMoons(lvl: Level): Level {
  return { ...lvl, bodies: lvl.bodies.map((b) => (b.orbit ? { ...b, mass: 0 } : b)) };
}

/** Wormholes deleted. */
function ablatePortals(lvl: Level): Level {
  return { ...lvl, portals: undefined };
}

/** One ablation twin: a label and the level with exactly one mechanic deleted.
 *  A level carrying BOTH mechanics gets two twins — the spec's "necessary" test
 *  is per mechanic, so deleting both at once would only prove one of them is
 *  load-bearing. A single-mechanic level gets one unlabelled twin. */
function twins(lvl: Level): { label: string; level: Level }[] {
  const moons = lvl.bodies.some((b) => b.orbit != null);
  const portals = (lvl.portals?.length ?? 0) > 0;
  if (moons && portals) {
    return [
      { label: " (moons ablated)", level: ablateMoons(lvl) },
      { label: " (portals ablated)", level: ablatePortals(lvl) },
    ];
  }
  if (moons) return [{ label: "", level: ablateMoons(lvl) }];
  if (portals) return [{ label: "", level: ablatePortals(lvl) }];
  return [];
}

// A moving level is BYPASSABLE if it clears with a mechanic deleted.
// Spec target: every flagged level gets relayouted until this prints clean —
// for a level with both mechanics, BOTH twins must print `mechanic required`.
// Skipped in CI (brute-force). Run:
//   $env:SOLVE=1; pnpm --filter @apogee/engine exec vitest run ablation-audit
describe.skipIf(!process.env.SOLVE)("ablation audit — moving levels", () => {
  it("prints any level clearable without its mechanic", () => {
    for (const lvl of LEVELS) {
      if (!isMovingLevel(lvl)) continue;
      const variants = twins(lvl);
      if (variants.length === 0) {
        // eslint-disable-next-line no-console
        console.log(`${lvl.id}: sensor-motion level — audit n/a`);
        continue;
      }
      for (const { label, level } of variants) {
        const bypass = findTimedSolution(level);
        // eslint-disable-next-line no-console
        console.log(
          `${lvl.id}${label}: ${bypass ? `BYPASSABLE (${bypass.length} launches) ` + JSON.stringify(bypass) : "mechanic required"}`,
        );
      }
    }
  }, 600_000);
});
