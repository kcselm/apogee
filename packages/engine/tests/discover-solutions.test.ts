import { describe, it } from "vitest";
import { LEVELS, isMovingLevel } from "../src/campaign/levels";
import { SOLUTIONS } from "../src/campaign/solutions";
import { findTimedSolution } from "./campaign-solver-timed";

declare const process: { env: { SOLVE?: string } };

// Skipped in CI. Run to print solutions to paste into src/campaign/solutions.ts:
//   $env:SOLVE=1; pnpm --filter @apogee/engine exec vitest run discover-solutions
describe.skipIf(!process.env.SOLVE)("discover solutions for moving levels", () => {
  it("prints a clearing sequence for each moving level lacking one", () => {
    for (const lvl of LEVELS) {
      if (!isMovingLevel(lvl) || SOLUTIONS[lvl.id]) continue;
      const sol = findTimedSolution(lvl);
      // eslint-disable-next-line no-console
      console.log(`"${lvl.id}":`, sol ? JSON.stringify(sol) + "," : "UNSOLVABLE — adjust layout/budget");
    }
  }, 600_000);
});
