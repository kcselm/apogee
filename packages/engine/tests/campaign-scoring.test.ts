import { describe, expect, it } from "vitest";
import { precisionPoints, starRating } from "../src/campaign/scoring";
import type { CampaignLevelState, Level } from "../src/campaign/types";

function level(partial: Partial<Level> = {}): Level {
  return {
    id: "t", name: "t", bodies: [], keys: [], goal: { pos: { x: 1, y: 1 }, radius: 60 },
    targets: [], launchPos: { x: 0, y: 0 }, bounds: { width: 1600, height: 1000 },
    launchBudget: 4, par: 2, objectives: [{ kind: "reach-goal" }],
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
  it("is 0 stars when not cleared, regardless of launches and precision", () => {
    expect(starRating(state(level(), { launchesUsed: 1, bestPrecision: 5 })).stars).toBe(0);
  });

  it("clearing over par earns exactly 1 star even with perfect precision", () => {
    const s = state(level(), { goalReached: true, launchesUsed: 3, bestPrecision: 5 });
    expect(starRating(s).stars).toBe(1);
  });

  it("clearing at par with outer-ring precision earns exactly 2 stars", () => {
    const s = state(level(), { goalReached: true, launchesUsed: 2, bestPrecision: 1 });
    expect(starRating(s).stars).toBe(2);
  });

  it("clearing under par still counts as par (2 stars without precision)", () => {
    const s = state(level(), { goalReached: true, launchesUsed: 1, bestPrecision: 0 });
    expect(starRating(s).stars).toBe(2);
  });

  it("par + bullseye (precision 5) earns 3 stars", () => {
    const bull = state(level(), { goalReached: true, launchesUsed: 2, bestPrecision: 5 });
    expect(starRating(bull).stars).toBe(3);
  });

  it("par + inner ring (precision 3) earns only 2 stars", () => {
    const inner = state(level(), { goalReached: true, launchesUsed: 2, bestPrecision: 3 });
    expect(starRating(inner).stars).toBe(2);
  });

  it("precision without par caps at 1 star", () => {
    const s = state(level(), { goalReached: true, launchesUsed: 3, bestPrecision: 3 });
    expect(starRating(s).stars).toBe(1);
  });
});
