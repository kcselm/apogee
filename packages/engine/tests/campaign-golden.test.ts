import { describe, expect, it } from "vitest";
import { createLevel, simulateCampaignLaunch } from "../src/campaign/simulate";
import { evaluateObjectives } from "../src/campaign/objectives";
import { starRating } from "../src/campaign/scoring";
import type { Level } from "../src/campaign/types";

/** A fixed, self-contained level: collect the key, then reach the goal. */
const LEVEL: Level = {
  id: "golden",
  name: "Golden",
  bodies: [{ pos: { x: 800, y: 520 }, radius: 70, mass: 4900, kind: "planet" }],
  keys: [{ pos: { x: 400, y: 380 }, radius: 24 }],
  goal: { pos: { x: 1150, y: 360 }, radius: 34 },
  targets: [],
  launchPos: { x: 80, y: 500 },
  bounds: { width: 1600, height: 1000 },
  launchBudget: 3,
  objectives: [{ kind: "reach-goal" }],
  starThresholds: { two: 6, three: 11 },
};

const INPUTS = [
  { dx: 94, dy: -35 },
  { dx: 82, dy: -57 },
];

describe("campaign golden replay", () => {
  it("a fixed level + inputs matches the locked snapshot", () => {
    let s = createLevel(LEVEL);
    for (const input of INPUTS) s = simulateCampaignLaunch(s, input).state;
    const summary = {
      probes: s.probes,
      keysCollected: s.keysCollected,
      goalReached: s.goalReached,
      bestPrecision: s.bestPrecision,
      cleared: evaluateObjectives(s).cleared,
      stars: starRating(s).stars,
    };
    expect(summary).toMatchSnapshot();
  });

  it("replaying twice is byte-identical (determinism)", () => {
    const run = () => {
      let s = createLevel(LEVEL);
      for (const input of INPUTS) s = simulateCampaignLaunch(s, input).state;
      return JSON.stringify(s);
    };
    expect(run()).toBe(run());
  });
});
