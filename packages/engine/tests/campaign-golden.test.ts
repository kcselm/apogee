import { describe, expect, it } from "vitest";
import { createLevel, simulateCampaignLaunch } from "../src/campaign/simulate";
import { evaluateObjectives } from "../src/campaign/objectives";
import { starRating } from "../src/campaign/scoring";
import type { Level } from "../src/campaign/types";
import { makeOrbit } from "../src/campaign/orbit";
import { makePortal } from "../src/campaign/portal";

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

/** A fixed moving level: an orbiting moon plus a wormhole pair, reach the goal. */
const MOVING_LEVEL: Level = {
  id: "golden-moving",
  name: "Golden Moving",
  bodies: [
    { pos: { x: 800, y: 500 }, radius: 60, mass: 3600, kind: "planet", orbit: makeOrbit({ x: 800, y: 500 }, 150, 0, 1) },
  ],
  keys: [],
  goal: { pos: { x: 1200, y: 500 }, radius: 40 },
  targets: [],
  portals: [makePortal(500, 500, 30, 180, 1), makePortal(1000, 500, 30, 0, 0)],
  launchPos: { x: 80, y: 500 },
  bounds: { width: 1600, height: 1000 },
  launchBudget: 3,
  objectives: [{ kind: "reach-goal" }],
  starThresholds: { two: 6, three: 11 },
};

const MOVING_INPUTS = [
  { dx: 120, dy: -20, launchTick: 0 },
  { dx: 90, dy: -40, launchTick: 60 },
];

describe("campaign golden replay — moving", () => {
  it("a fixed moving level + timed inputs matches the locked snapshot", () => {
    let s = createLevel(MOVING_LEVEL);
    for (const input of MOVING_INPUTS) s = simulateCampaignLaunch(s, input).state;
    const summary = {
      probes: s.probes,
      goalReached: s.goalReached,
      bestPrecision: s.bestPrecision,
      cleared: evaluateObjectives(s).cleared,
      stars: starRating(s).stars,
    };
    expect(summary).toMatchSnapshot();
  });

  it("replaying twice is byte-identical (determinism)", () => {
    const run = () => {
      let s = createLevel(MOVING_LEVEL);
      for (const input of MOVING_INPUTS) s = simulateCampaignLaunch(s, input).state;
      return JSON.stringify(s);
    };
    expect(run()).toBe(run());
  });
});
