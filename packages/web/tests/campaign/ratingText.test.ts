import { describe, expect, it } from "vitest";
import type { CampaignLevelState, Level } from "@apogee/engine";
import { starCriteria } from "../../src/campaign/ratingText";

function state(partial: Partial<CampaignLevelState>): CampaignLevelState {
  const level: Level = {
    id: "t", name: "t", bodies: [], keys: [], goal: { pos: { x: 1, y: 1 }, radius: 60 },
    targets: [], launchPos: { x: 0, y: 0 }, bounds: { width: 1600, height: 1000 },
    launchBudget: 4, par: 2, objectives: [{ kind: "reach-goal" }],
  };
  return {
    level, probes: [], launchesUsed: 0, keysCollected: [], targetsHit: [],
    goalReached: true, bestPrecision: 0, ...partial,
  };
}

describe("starCriteria", () => {
  it("marks all three met for a par + inner-ring clear", () => {
    const rows = starCriteria(state({ launchesUsed: 2, bestPrecision: 3 }));
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.met)).toEqual([true, true, true]);
  });

  it("marks par and precision unmet for a sloppy over-par clear", () => {
    const rows = starCriteria(state({ launchesUsed: 4, bestPrecision: 1 }));
    expect(rows.map((r) => r.met)).toEqual([true, false, false]);
  });

  it("pluralizes the par text", () => {
    const one = starCriteria(state({ launchesUsed: 1 }));
    expect(one[1]!.text).toBe("clear in 2 launches");
    const solo = starCriteria({ ...state({ launchesUsed: 1 }), level: { ...state({}).level, par: 1 } });
    expect(solo[1]!.text).toBe("clear in 1 launch");
  });
});
