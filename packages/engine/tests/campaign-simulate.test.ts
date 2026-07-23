import { describe, expect, it } from "vitest";
import { createLevel, simulateCampaignLaunch } from "../src/campaign/simulate";
import { evaluateObjectives } from "../src/campaign/objectives";
import type { Level } from "../src/campaign/types";

const BOUNDS = { width: 1600, height: 1000 };

function base(partial: Partial<Level>): Level {
  return {
    id: "t", name: "t", bodies: [], keys: [], goal: undefined, targets: [],
    launchPos: { x: 80, y: 500 }, bounds: BOUNDS, launchBudget: 3,
    objectives: [], par: 2, ...partial,
  };
}

describe("createLevel", () => {
  it("initializes sticky progress sized to keys and targets", () => {
    const lvl = base({ keys: [{ pos: { x: 1, y: 1 }, radius: 5 }], targets: [{ pos: { x: 2, y: 2 }, radius: 5 }] });
    const s = createLevel(lvl);
    expect(s.keysCollected).toEqual([false]);
    expect(s.targetsHit).toEqual([false]);
    expect(s.goalReached).toBe(false);
    expect(s.launchesUsed).toBe(0);
  });
});

describe("simulateCampaignLaunch", () => {
  it("increments launchesUsed and resolves the new probe to non-flying", () => {
    const lvl = base({ bodies: [{ pos: { x: 800, y: 500 }, radius: 60, mass: 3600, kind: "planet" }] });
    const r = simulateCampaignLaunch(createLevel(lvl), { dx: 200, dy: 0 });
    expect(r.state.launchesUsed).toBe(1);
    expect(r.state.probes[0]!.state).not.toBe("flying");
    expect(r.trace.length).toBeGreaterThan(0);
  });

  it("does not mutate the input state", () => {
    const lvl = base({ bodies: [{ pos: { x: 800, y: 500 }, radius: 60, mass: 3600, kind: "planet" }] });
    const s = createLevel(lvl);
    const before = JSON.stringify(s);
    simulateCampaignLaunch(s, { dx: 200, dy: 0 });
    expect(JSON.stringify(s)).toBe(before);
  });

  it("a blocker is lethal: contact loses the probe (no landing)", () => {
    const lvl = base({ bodies: [{ pos: { x: 400, y: 500 }, radius: 60, mass: 3600, kind: "blocker" }] });
    const r = simulateCampaignLaunch(createLevel(lvl), { dx: 200, dy: 0 });
    expect(r.state.probes[0]!.state).toBe("lost");
  });

  it("collects a key the probe flies through, and it persists across launches", () => {
    const lvl = base({ keys: [{ pos: { x: 400, y: 500 }, radius: 20 }] });
    const r1 = simulateCampaignLaunch(createLevel(lvl), { dx: 200, dy: 0 });
    expect(r1.state.keysCollected).toEqual([true]);
    const r2 = simulateCampaignLaunch(r1.state, { dx: 0, dy: -200 });
    expect(r2.state.keysCollected).toEqual([true]);
  });

  it("goal stays locked until keys are collected", () => {
    const lvl = base({
      keys: [{ pos: { x: 400, y: 300 }, radius: 20 }],
      goal: { pos: { x: 400, y: 500 }, radius: 30 },
      objectives: [{ kind: "reach-goal" }],
    });
    const locked = simulateCampaignLaunch(createLevel(lvl), { dx: 200, dy: 0 });
    expect(locked.state.goalReached).toBe(false);
  });

  it("reaches the goal once keys are in hand and records precision", () => {
    const lvl = base({
      keys: [{ pos: { x: 300, y: 500 }, radius: 20 }],
      goal: { pos: { x: 700, y: 500 }, radius: 30 },
      objectives: [{ kind: "reach-goal" }],
    });
    const r = simulateCampaignLaunch(createLevel(lvl), { dx: 200, dy: 0 });
    expect(r.state.keysCollected).toEqual([true]);
    expect(r.state.goalReached).toBe(true);
    expect(r.state.bestPrecision).toBeGreaterThan(0);
    expect(evaluateObjectives(r.state).cleared).toBe(true);
    expect(r.events.some((e) => e.type === "goal")).toBe(true);
  });

  it("hits a target the probe passes through", () => {
    const lvl = base({
      targets: [{ pos: { x: 400, y: 500 }, radius: 20 }],
      objectives: [{ kind: "hit-all-targets" }],
    });
    const r = simulateCampaignLaunch(createLevel(lvl), { dx: 200, dy: 0 });
    expect(r.state.targetsHit).toEqual([true]);
  });

  it("is deterministic: identical inputs produce identical results", () => {
    const lvl = base({ bodies: [{ pos: { x: 800, y: 500 }, radius: 60, mass: 3600, kind: "planet" }] });
    const a = simulateCampaignLaunch(createLevel(lvl), { dx: 173.5, dy: -42.25 });
    const b = simulateCampaignLaunch(createLevel(lvl), { dx: 173.5, dy: -42.25 });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
  });
});
