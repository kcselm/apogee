import { describe, expect, it } from "vitest";
import { PORTAL_COOLDOWN } from "../src/campaign/constants";
import { makePortal, portalExitRotation, rotateVec } from "../src/campaign/portal";
import { createLevel, simulateCampaignLaunch } from "../src/campaign/simulate";
import type { Level } from "../src/campaign/types";

describe("portal transform", () => {
  it("head-on entry exits straight along the far portal's facing", () => {
    const a = makePortal(400, 500, 30, 0, 1); // faces +x
    const b = makePortal(900, 500, 30, 90, 0); // faces +y
    const rot = portalExitRotation(a.facing, b.facing);
    // Entering A head-on means velocity opposite A.facing: (-1,0)·speed.
    const vout = rotateVec({ x: -200, y: 0 }, rot.cos, rot.sin);
    expect(vout.x).toBeCloseTo(0, 6);
    expect(vout.y).toBeCloseTo(200, 6);
  });

  it("preserves speed for an arbitrary entry", () => {
    const a = makePortal(0, 0, 20, 37, 1);
    const b = makePortal(100, 0, 20, 211, 0);
    const rot = portalExitRotation(a.facing, b.facing);
    const vin = { x: 123, y: -45 };
    const vout = rotateVec(vin, rot.cos, rot.sin);
    expect(Math.hypot(vout.x, vout.y)).toBeCloseTo(Math.hypot(vin.x, vin.y), 6);
  });

  it("makePortal builds a unit facing vector", () => {
    const p = makePortal(10, 20, 25, 90, 1);
    expect(p.facing.x).toBeCloseTo(0, 6);
    expect(p.facing.y).toBeCloseTo(1, 6);
    expect(Math.hypot(p.facing.x, p.facing.y)).toBeCloseTo(1, 6);
  });
});

/** Steps at which the probe teleported = trace frames where it moved >100 units. */
function jumpSteps(trace: { x: number; y: number }[][]): number[] {
  const out: number[] = [];
  for (let i = 1; i < trace.length; i++) {
    const a = trace[i - 1]![0]!;
    const b = trace[i]![0]!;
    if (Math.hypot(b.x - a.x, b.y - a.y) > 100) out.push(i);
  }
  return out;
}

describe("portal re-entry cooldown", () => {
  // Empty space, two mouths both facing -x. A probe flying +x enters A head-on,
  // exits B travelling +x INTO B's own disc (exit rotation maps -x → +x), and
  // would instantly re-teleport every step without the guard. At drag 100
  // (300 u/s = 5 u/step) it needs ~14 steps to cross B's 35-unit contact
  // reach, so the cooldown expires mid-disc and a legitimate re-teleport
  // fires — the gap between jumps is exactly the guard window, never 1.
  const LEVEL: Level = {
    id: "cd", name: "cd", bodies: [], keys: [],
    goal: { pos: { x: 1500, y: 900 }, radius: 30 }, targets: [],
    launchPos: { x: 100, y: 500 }, bounds: { width: 1600, height: 1000 },
    launchBudget: 1, par: 1, objectives: [{ kind: "reach-goal" }],
    portals: [makePortal(600, 500, 30, 180, 1), makePortal(1100, 500, 30, 180, 0)],
  };

  it("never re-teleports within the cooldown window", () => {
    const { trace } = simulateCampaignLaunch(createLevel(LEVEL), { dx: 100, dy: 0 }, 400);
    const jumps = jumpSteps(trace);
    expect(jumps.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < jumps.length; i++) {
      expect(jumps[i]! - jumps[i - 1]!).toBeGreaterThan(PORTAL_COOLDOWN);
    }
  });

  it("does re-teleport once the cooldown expires while still inside a mouth", () => {
    const { trace } = simulateCampaignLaunch(createLevel(LEVEL), { dx: 100, dy: 0 }, 400);
    const jumps = jumpSteps(trace);
    // The probe crosses B's disc slower than the guard window, so at least one
    // consecutive pair of jumps sits exactly at the first legal step.
    const gaps = jumps.slice(1).map((s, i) => s - jumps[i]!);
    expect(Math.min(...gaps)).toBe(PORTAL_COOLDOWN + 1);
  });
});
