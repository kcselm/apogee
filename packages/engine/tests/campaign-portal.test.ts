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
  // Empty space, two mouths both facing -x. This is a double-bounce: since both
  // portals share the same facing, each traversal flips the probe's velocity and
  // drops it at a fixed anchor next to the OTHER portal (exit.pos + facing *
  // reach) — it doesn't cross straight through.
  //   Jump 1 (~step 92): probe flying +x enters A head-on, exits along B.facing
  //     = -x — AWAY from B, back toward A. Not cooldown-relevant.
  //   Jump 2 (~step 178, gap 86): cooldown had long since expired; ~86 steps of
  //     plain -x travel later, the probe re-enters A from the far side (tail-on).
  //   Jump 3 (~step 185, gap 7): that entry exits along B.facing again, but this
  //     time the anchor point sits ~2 units inside B's own disc and the probe is
  //     moving +x, i.e. INTO B's own disc. Without the guard this would
  //     re-teleport next step; PORTAL_COOLDOWN=6 blocks steps 179-184 while the
  //     probe drifts across B's 35-unit contact reach at drag 100 (300 u/s =
  //     5 u/step), so the legitimate re-teleport fires at the first legal step —
  //     gap exactly PORTAL_COOLDOWN + 1, never 1.
  // (Observed trace: jumps [92, 178, 185], gaps [86, 7].)
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
