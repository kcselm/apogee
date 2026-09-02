import { describe, expect, it } from "vitest";
import { allObjectivesMet, evaluateObjectives, isLevelOver } from "../src/campaign/objectives";
import type { CampaignLevelState, Level } from "../src/campaign/types";

function level(partial: Partial<Level>): Level {
  return {
    id: "t",
    name: "t",
    bodies: [],
    keys: [],
    goal: undefined,
    targets: [],
    launchPos: { x: 0, y: 0 },
    bounds: { width: 1600, height: 1000 },
    launchBudget: 3,
    objectives: [],
    par: 2,
    ...partial,
  };
}

function state(lvl: Level, partial: Partial<CampaignLevelState> = {}): CampaignLevelState {
  return {
    level: lvl,
    probes: [],
    launchesUsed: 0,
    keysCollected: lvl.keys.map(() => false),
    targetsHit: lvl.targets.map(() => false),
    goalReached: false,
    bestPrecision: 0,
    ...partial,
  };
}

describe("evaluateObjectives", () => {
  it("reach-goal is met only when goalReached", () => {
    const lvl = level({ goal: { pos: { x: 1, y: 1 }, radius: 10 }, objectives: [{ kind: "reach-goal" }] });
    expect(evaluateObjectives(state(lvl)).cleared).toBe(false);
    expect(evaluateObjectives(state(lvl, { goalReached: true })).cleared).toBe(true);
  });

  it("hit-all-targets needs every target hit (and at least one target)", () => {
    const lvl = level({
      targets: [{ pos: { x: 1, y: 1 }, radius: 5 }, { pos: { x: 2, y: 2 }, radius: 5 }],
      objectives: [{ kind: "hit-all-targets" }],
    });
    expect(evaluateObjectives(state(lvl, { targetsHit: [true, false] })).cleared).toBe(false);
    expect(evaluateObjectives(state(lvl, { targetsHit: [true, true] })).cleared).toBe(true);
  });

  it("a combined level needs all objectives", () => {
    const lvl = level({
      goal: { pos: { x: 1, y: 1 }, radius: 10 },
      targets: [{ pos: { x: 2, y: 2 }, radius: 5 }],
      objectives: [{ kind: "reach-goal" }, { kind: "hit-all-targets" }],
    });
    expect(evaluateObjectives(state(lvl, { goalReached: true, targetsHit: [false] })).cleared).toBe(false);
    expect(evaluateObjectives(state(lvl, { goalReached: true, targetsHit: [true] })).cleared).toBe(true);
  });

  it("isLevelOver is true when cleared or launches exhausted", () => {
    const lvl = level({ goal: { pos: { x: 1, y: 1 }, radius: 10 }, objectives: [{ kind: "reach-goal" }] });
    expect(isLevelOver(state(lvl))).toBe(false);
    expect(isLevelOver(state(lvl, { goalReached: true }))).toBe(true);
    expect(isLevelOver(state(lvl, { launchesUsed: 3 }))).toBe(true);
  });
});

describe("allObjectivesMet", () => {
  it("is false with no objectives", () => {
    expect(allObjectivesMet([], [], true)).toBe(false);
  });
  it("reach-goal follows goalReached", () => {
    expect(allObjectivesMet([{ kind: "reach-goal" }], [], false)).toBe(false);
    expect(allObjectivesMet([{ kind: "reach-goal" }], [], true)).toBe(true);
  });
  it("hit-all-targets needs every target and at least one", () => {
    expect(allObjectivesMet([{ kind: "hit-all-targets" }], [], false)).toBe(false);
    expect(allObjectivesMet([{ kind: "hit-all-targets" }], [true, false], false)).toBe(false);
    expect(allObjectivesMet([{ kind: "hit-all-targets" }], [true, true], false)).toBe(true);
  });
  it("combined objectives need both", () => {
    const both = [{ kind: "hit-all-targets" as const }, { kind: "reach-goal" as const }];
    expect(allObjectivesMet(both, [true], false)).toBe(false);
    expect(allObjectivesMet(both, [true], true)).toBe(true);
  });
});
