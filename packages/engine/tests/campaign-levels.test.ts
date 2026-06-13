import { describe, expect, it } from "vitest";
import { LEVELS } from "../src/campaign/levels";
import { findSolution } from "./campaign-solver";

describe("authored levels", () => {
  it("every level has a unique id", () => {
    const ids = LEVELS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every level declares at least one objective with the data it needs", () => {
    for (const lvl of LEVELS) {
      expect(lvl.objectives.length).toBeGreaterThan(0);
      for (const o of lvl.objectives) {
        if (o.kind === "reach-goal") expect(lvl.goal, lvl.id).toBeDefined();
        if (o.kind === "hit-all-targets") expect(lvl.targets.length, lvl.id).toBeGreaterThan(0);
      }
    }
  });

  it("every level is solvable within its launch budget", () => {
    for (const lvl of LEVELS) {
      const solution = findSolution(lvl);
      expect(solution, `level ${lvl.id} is unsolvable — adjust its layout`).not.toBeNull();
      expect(solution!.length, lvl.id).toBeLessThanOrEqual(lvl.launchBudget);
    }
  });
});
