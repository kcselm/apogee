import { describe, it } from "vitest";
import { LEVELS, isMovingLevel } from "../src/campaign/levels";
import { findSolution } from "./campaign-solver";

declare const process: { env: { SOLVE?: string } };

// Prints the minimal brute-force clear length per STATIC level, for authoring
// `par`. (findSolution searches depth 1..budget breadth-first, so the first
// solution found is minimal within the candidate grid.) Skipped in CI. Run:
//   $env:SOLVE=1; pnpm --filter @apogee/engine exec vitest run discover-pars
describe.skipIf(!process.env.SOLVE)("discover pars for static levels", () => {
  it("prints minimal clearing launch counts", () => {
    for (const lvl of LEVELS) {
      if (isMovingLevel(lvl)) continue;
      const sol = findSolution(lvl);
      // eslint-disable-next-line no-console
      console.log(`${lvl.id}: par ${sol ? sol.length : "UNSOLVABLE"}`);
    }
  });
});
