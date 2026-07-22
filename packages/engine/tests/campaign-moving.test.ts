import { describe, expect, it } from "vitest";
import { makeOrbit } from "../src/campaign/orbit";
import { makePortal } from "../src/campaign/portal";
import { createLevel, simulateCampaignLaunch } from "../src/campaign/simulate";
import type { Level } from "../src/campaign/types";

const BOUNDS = { width: 1600, height: 1000 };
function base(partial: Partial<Level>): Level {
  return {
    id: "t", name: "t", bodies: [], keys: [], goal: undefined, targets: [],
    launchPos: { x: 80, y: 500 }, bounds: BOUNDS, launchBudget: 3,
    objectives: [], starThresholds: { two: 8, three: 13 }, ...partial,
  };
}

describe("moving bodies", () => {
  it("the field moves: different launch ticks give different flights", () => {
    const orbit = makeOrbit({ x: 800, y: 500 }, 150, 0, 1);
    const lvl = base({
      bodies: [{ pos: { x: 800, y: 500 }, radius: 40, mass: 1600, kind: "planet", orbit }],
    });
    const a = simulateCampaignLaunch(createLevel(lvl), { dx: 220, dy: -60, launchTick: 0 });
    const b = simulateCampaignLaunch(createLevel(lvl), { dx: 220, dy: -60, launchTick: 120 });
    expect(JSON.stringify(a.state.probes)).not.toBe(JSON.stringify(b.state.probes));
  });

  it("launchTick defaults to 0 and stays deterministic", () => {
    const orbit = makeOrbit({ x: 800, y: 500 }, 150, 0, 1);
    const lvl = base({
      bodies: [{ pos: { x: 800, y: 500 }, radius: 40, mass: 1600, kind: "planet", orbit }],
    });
    const a = simulateCampaignLaunch(createLevel(lvl), { dx: 220, dy: -60 });
    const b = simulateCampaignLaunch(createLevel(lvl), { dx: 220, dy: -60, launchTick: 0 });
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
  });

  it("a probe can land on a moon (orbiting planet-kind body)", () => {
    // turnsPerPeriod 0 → a stationary body sitting at center+offset0 (radius 60 → x=460).
    const orbit = makeOrbit({ x: 400, y: 500 }, 60, 0, 0);
    const lvl = base({
      bodies: [{ pos: { x: 400, y: 500 }, radius: 50, mass: 2500, kind: "planet", orbit }],
    });
    const r = simulateCampaignLaunch(createLevel(lvl), { dx: 200, dy: 0 });
    expect(r.state.probes[0]!.state).toBe("landed");
  });

  it("a moving target is hit at its current position", () => {
    const orbit = makeOrbit({ x: 400, y: 500 }, 20, 0, 0); // parked at (420,500)
    const lvl = base({
      targets: [{ pos: { x: 400, y: 500 }, radius: 30, orbit }],
      objectives: [{ kind: "hit-all-targets" }],
    });
    const r = simulateCampaignLaunch(createLevel(lvl), { dx: 200, dy: 0 });
    expect(r.state.targetsHit).toEqual([true]);
  });
});

describe("wormholes in simulate", () => {
  it("teleports a probe to the paired portal, exiting along its facing at the same speed", () => {
    const lvl = base({
      portals: [makePortal(400, 500, 30, 180, 1), makePortal(1000, 300, 30, 90, 0)],
    });
    const r = simulateCampaignLaunch(createLevel(lvl), { dx: 200, dy: 0 }); // speed 600
    const f = r.trace.map((fr) => fr[0]!);
    // After teleport the probe sits at x≈1000 (no gravity) moving +y.
    const i = f.findIndex((p) => p.x > 950 && p.x < 1050);
    expect(i).toBeGreaterThan(0);
    const d = Math.hypot(f[i + 1]!.x - f[i]!.x, f[i + 1]!.y - f[i]!.y);
    expect(d).toBeCloseTo(600 / 60, 3); // MAX_SPEED · DT — speed preserved
    expect(Math.abs(f[i + 1]!.x - f[i]!.x)).toBeLessThan(1e-6); // moving straight +y
  });

  it("resolves rather than trapping when portals are far apart", () => {
    const lvl = base({
      portals: [makePortal(400, 500, 30, 180, 1), makePortal(1000, 300, 30, 90, 0)],
    });
    const r = simulateCampaignLaunch(createLevel(lvl), { dx: 200, dy: 0 });
    expect(r.state.probes[0]!.state).not.toBe("flying");
    expect(r.trace.length).toBeLessThan(500);
  });
});
