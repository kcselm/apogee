import { describe, expect, it } from "vitest";
import { LEVELS, isMovingLevel } from "../src/campaign/levels";
import { evaluateObjectives } from "../src/campaign/objectives";
import { createLevel, simulateCampaignLaunch } from "../src/campaign/simulate";
import { SOLUTIONS } from "../src/campaign/solutions";

describe("authored levels", () => {
  it("every level has a unique id", () => {
    const ids = LEVELS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("exactly the ten chapter-opening levels carry an intro of at most 90 characters", () => {
    const withIntro = LEVELS.filter((l) => l.intro !== undefined).map((l) => l.id);
    expect(withIntro).toEqual(["1-1", "2-1", "3-1", "4-1", "5-1", "6-1", "7-1", "8-1", "9-1", "10-1"]);
    for (const lvl of LEVELS) {
      if (lvl.intro === undefined) continue;
      expect(lvl.intro.length, lvl.id).toBeLessThanOrEqual(90);
      expect(lvl.intro.trim(), lvl.id).toBe(lvl.intro);
    }
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
        expect(p.link, `${lvl.id} portal ${i} self-link`).not.toBe(i);
      });
    }
  });

  it("every level has a stored reference that clears within budget and par", () => {
    for (const lvl of LEVELS) {
      const seq = SOLUTIONS[lvl.id];
      expect(seq, `no reference for ${lvl.id} — run SOLVE=1 level-stats and paste its ref input`).toBeDefined();
      expect(seq!.length, `${lvl.id} reference exceeds budget`).toBeLessThanOrEqual(lvl.launchBudget);
      expect(seq!.length, `${lvl.id} par is aspirational`).toBeLessThanOrEqual(lvl.par);
      if (!isMovingLevel(lvl)) {
        expect(seq!.every((i) => i.launchTick === undefined), `${lvl.id} is static; drop launchTick`).toBe(true);
      }
      let s = createLevel(lvl);
      for (const input of seq!) s = simulateCampaignLaunch(s, input).state;
      expect(evaluateObjectives(s).cleared, `reference for ${lvl.id} no longer clears`).toBe(true);
    }
  });

  it("no reference is stored for an id that is not a level", () => {
    const ids = new Set(LEVELS.map((l) => l.id));
    for (const id of Object.keys(SOLUTIONS)) expect(ids.has(id), `stale SOLUTIONS entry ${id}`).toBe(true);
  });
});
