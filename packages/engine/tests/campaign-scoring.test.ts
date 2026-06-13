import { describe, expect, it } from "vitest";
import { precisionPoints, starRating } from "../src/campaign/scoring";
import type { CampaignLevelState, Level } from "../src/campaign/types";

function level(partial: Partial<Level> = {}): Level {
  return {
    id: "t", name: "t", bodies: [], keys: [], goal: { pos: { x: 1, y: 1 }, radius: 60 },
    targets: [], launchPos: { x: 0, y: 0 }, bounds: { width: 1600, height: 1000 },
    launchBudget: 3, objectives: [{ kind: "reach-goal" }], starThresholds: { two: 8, three: 13 },
    ...partial,
  };
}

function state(lvl: Level, partial: Partial<CampaignLevelState> = {}): CampaignLevelState {
  return {
    level: lvl, probes: [], launchesUsed: 0, keysCollected: [], targetsHit: [],
    goalReached: false, bestPrecision: 0, ...partial,
  };
}

describe("precisionPoints", () => {
  it("maps distance through the RINGS table (5 / 3 / 1 / 0)", () => {
    expect(precisionPoints(0)).toBe(5);
    expect(precisionPoints(14)).toBe(5);
    expect(precisionPoints(20)).toBe(3);
    expect(precisionPoints(40)).toBe(1);
    expect(precisionPoints(60)).toBe(0);
  });
});

describe("starRating", () => {
  it("is 0 stars when not cleared", () => {
    expect(starRating(state(level())).stars).toBe(0);
  });

  it("clearing at all earns at least 1 star", () => {
    const s = state(level(), { goalReached: true, launchesUsed: 3, bestPrecision: 0 });
    expect(starRating(s).stars).toBe(1);
  });

  it("efficiency + precision push to 2 and 3 stars via thresholds", () => {
    const s3 = state(level(), { goalReached: true, launchesUsed: 1, bestPrecision: 5 });
    expect(starRating(s3)).toEqual({ stars: 3, levelScore: 15 });
    const s2 = state(level(), { goalReached: true, launchesUsed: 2, bestPrecision: 3 });
    expect(starRating(s2)).toEqual({ stars: 2, levelScore: 8 });
  });
});
