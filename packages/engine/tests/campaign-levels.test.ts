import { describe, expect, it } from "vitest";
import { LEVELS, isMovingLevel } from "../src/campaign/levels";
import { evaluateObjectives } from "../src/campaign/objectives";
import { createLevel, simulateCampaignLaunch } from "../src/campaign/simulate";
import { SOLUTIONS } from "../src/campaign/solutions";
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

  it("every portal links to a valid, mutually-paired portal", () => {
    for (const lvl of LEVELS) {
      const ps = lvl.portals ?? [];
      ps.forEach((p, i) => {
        expect(p.link, `${lvl.id} portal ${i} link`).toBeGreaterThanOrEqual(0);
        expect(p.link, `${lvl.id} portal ${i} link`).toBeLessThan(ps.length);
        expect(ps[p.link]!.link, `${lvl.id} portal ${i} pairing`).toBe(i);
      });
    }
  });

  it("every STATIC level is solvable within its launch budget (brute force)", () => {
    for (const lvl of LEVELS) {
      if (isMovingLevel(lvl)) continue;
      const solution = findSolution(lvl);
      expect(solution, `level ${lvl.id} is unsolvable — adjust its layout`).not.toBeNull();
      expect(solution!.length, lvl.id).toBeLessThanOrEqual(lvl.launchBudget);
      expect(solution!.length, `${lvl.id} par is aspirational`).toBeLessThanOrEqual(lvl.par);
    }
  });

  it("every MOVING level clears when its stored solution is replayed", () => {
    for (const lvl of LEVELS) {
      if (!isMovingLevel(lvl)) continue;
      const seq = SOLUTIONS[lvl.id];
      expect(seq, `no stored solution for ${lvl.id} — run SOLVE=1 discover-solutions`).toBeDefined();
      expect(seq!.length, `${lvl.id} solution exceeds budget`).toBeLessThanOrEqual(lvl.launchBudget);
      expect(seq!.length, `${lvl.id} par is aspirational`).toBeLessThanOrEqual(lvl.par);
      let s = createLevel(lvl);
      for (const input of seq!) s = simulateCampaignLaunch(s, input).state;
      expect(evaluateObjectives(s).cleared, `stored solution for ${lvl.id} no longer clears`).toBe(true);
    }
  });
});
