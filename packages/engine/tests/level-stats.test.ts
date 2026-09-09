import { describe, it } from "vitest";
import { LEVELS } from "../src/campaign/levels";
import { TSV_HEADER, levelStats, toTsvRow } from "./level-stats";

declare const process: { env: { SOLVE?: string; LEVELS?: string } };

// The forgiveness sweep (spec §1): one TSV row per level on the fine aim grid.
// Skipped in CI (minutes). Run all thirty, or a subset while tuning:
//   $env:SOLVE=1; pnpm --filter @apogee/engine exec vitest run level-stats; Remove-Item Env:SOLVE
//   $env:SOLVE=1; $env:LEVELS="3-1,3-2"; pnpm --filter @apogee/engine exec vitest run level-stats; Remove-Item Env:SOLVE; Remove-Item Env:LEVELS
// Bash: SOLVE=1 LEVELS=3-1,3-2 pnpm --filter @apogee/engine exec vitest run level-stats
describe.skipIf(!process.env.SOLVE)("level stats — forgiveness sweep", () => {
  it("prints a TSV row per level", () => {
    const only = process.env.LEVELS?.split(",").map((s) => s.trim()).filter(Boolean);
    // eslint-disable-next-line no-console
    console.log(TSV_HEADER);
    for (const lvl of LEVELS) {
      if (only && only.length > 0 && !only.includes(lvl.id)) continue;
      // eslint-disable-next-line no-console
      console.log(toTsvRow(levelStats(lvl)));
    }
  }, 3_600_000);
});
