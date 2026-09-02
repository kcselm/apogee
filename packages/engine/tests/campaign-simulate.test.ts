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

describe("closest-approach precision", () => {
  const goalLevel = (gx: number, gy: number, radius = 30): Level =>
    base({ goal: { pos: { x: gx, y: gy }, radius }, objectives: [{ kind: "reach-goal" }] });

  it("a straight pass through the goal center scores the bullseye (not first contact)", () => {
    // First contact is at x=670 (30 units out → 3 under the old rule); closest approach is 0.
    const r = simulateCampaignLaunch(createLevel(goalLevel(700, 500)), { dx: 200, dy: 0 });
    expect(r.state.goalReached).toBe(true);
    expect(r.state.bestPrecision).toBe(5);
    expect(r.events).toEqual([{ step: 58, type: "goal", index: 0 }]); // trigger step unchanged
  });

  it("a pass 12 units off-center still scores the bullseye", () => {
    // Old rule: first contact at (670, 500) is 32.3 units out → 1 point.
    const r = simulateCampaignLaunch(createLevel(goalLevel(700, 512)), { dx: 200, dy: 0 });
    expect(r.state.bestPrecision).toBe(5);
  });

  it("a pass 20 units off-center scores the inner ring", () => {
    const r = simulateCampaignLaunch(createLevel(goalLevel(700, 520)), { dx: 200, dy: 0 });
    expect(r.state.bestPrecision).toBe(3);
  });

  it("a graze 33 units off-center scores the outer ring", () => {
    const r = simulateCampaignLaunch(createLevel(goalLevel(700, 533)), { dx: 200, dy: 0 });
    expect(r.state.goalReached).toBe(true);
    expect(r.state.bestPrecision).toBe(1);
  });

  it("a probe that lands inside a surface goal closes its pass at launch end", () => {
    // Planet at (800,500) r60: the probe snaps to (735,500). Goal center (735,520) → 20 units → 3.
    const lvl = base({
      bodies: [{ pos: { x: 800, y: 500 }, radius: 60, mass: 3600, kind: "planet" }],
      goal: { pos: { x: 735, y: 520 }, radius: 30 },
      objectives: [{ kind: "reach-goal" }],
    });
    const r = simulateCampaignLaunch(createLevel(lvl), { dx: 200, dy: 0 });
    expect(r.state.probes[0]!.state).toBe("landed");
    expect(r.state.probes[0]!.pos.x).toBeCloseTo(735, 6);
    expect(r.state.bestPrecision).toBe(3);
  });

  it("each target crossed in one flight gets its own pass; bestPrecision is the max", () => {
    // Target 0 at (400,520) r20: closest 20 → 3. Target 1 at (700,512) r20: closest 12 → 5.
    const lvl = base({
      targets: [{ pos: { x: 400, y: 520 }, radius: 20 }, { pos: { x: 700, y: 512 }, radius: 20 }],
      objectives: [{ kind: "hit-all-targets" }],
    });
    const r = simulateCampaignLaunch(createLevel(lvl), { dx: 200, dy: 0 });
    expect(r.state.targetsHit).toEqual([true, true]);
    expect(r.state.bestPrecision).toBe(5);
    expect(r.events.map((e) => e.index)).toEqual([0, 1]);
  });

  it("a reached goal never re-triggers, and a later launch cannot lower bestPrecision", () => {
    const r1 = simulateCampaignLaunch(createLevel(goalLevel(700, 512)), { dx: 200, dy: 0 });
    expect(r1.state.bestPrecision).toBe(5);
    const r2 = simulateCampaignLaunch(r1.state, { dx: 200, dy: 0 });
    expect(r2.events).toEqual([]);
    expect(r2.state.bestPrecision).toBe(5);
    expect(r2.state.launchesUsed).toBe(2);
  });
});
