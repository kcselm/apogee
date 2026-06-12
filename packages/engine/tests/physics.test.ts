import { describe, expect, it } from "vitest";
import { DT, PROBE_RADIUS, VOID_MARGIN } from "../src/constants";
import { gravityAt, stepProbes } from "../src/physics";
import type { Planet, Probe, StarSystem } from "../src/types";

function makePlanet(x: number, y: number, radius = 60): Planet {
  return { pos: { x, y }, radius, mass: radius * radius };
}

function makeSystem(planets: Planet[]): StarSystem {
  return {
    planets,
    zones: [],
    launchPos: { x: 80, y: 500 },
    bounds: { width: 1600, height: 1000 },
  };
}

function makeProbe(x: number, y: number, vx = 0, vy = 0): Probe {
  return { pos: { x, y }, vel: { x: vx, y: vy }, state: "flying" };
}

describe("gravityAt", () => {
  it("pulls toward a single planet with a = G*m/d^2", () => {
    const planets = [makePlanet(300, 0)];
    const { ax, ay } = gravityAt(planets, 0, 0);
    expect(ax).toBeCloseTo(200, 6);
    expect(ay).toBeCloseTo(0, 6);
  });

  it("is symmetric on the other side", () => {
    const planets = [makePlanet(300, 0)];
    const { ax } = gravityAt(planets, 600, 0);
    expect(ax).toBeCloseTo(-200, 6);
  });

  it("sums contributions from multiple planets", () => {
    // Two identical planets equidistant left and right: pulls cancel.
    const planets = [makePlanet(-300, 0), makePlanet(300, 0)];
    const { ax, ay } = gravityAt(planets, 0, 0);
    expect(ax).toBeCloseTo(0, 6);
    expect(ay).toBeCloseTo(0, 6);
  });
});

describe("stepProbes integration", () => {
  it("accelerates a resting probe toward the planet (semi-implicit Euler)", () => {
    const system = makeSystem([makePlanet(300, 0)]);
    const probe = makeProbe(0, 0);
    stepProbes(system, [probe]);
    expect(probe.vel.x).toBeCloseTo(200 * DT, 6);
    expect(probe.pos.x).toBeCloseTo(200 * DT * DT, 6);
  });

  it("does not move landed or lost probes", () => {
    const system = makeSystem([makePlanet(300, 0)]);
    const landed: Probe = { pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, state: "landed" };
    const lost: Probe = { pos: { x: 0, y: 100 }, vel: { x: 0, y: 0 }, state: "lost" };
    stepProbes(system, [landed, lost]);
    expect(landed.pos).toEqual({ x: 0, y: 0 });
    expect(lost.pos).toEqual({ x: 0, y: 100 });
  });
});

describe("landing", () => {
  it("lands a probe touching a planet surface and snaps it to the surface", () => {
    const planet = makePlanet(300, 0);
    const system = makeSystem([planet]);
    // Just inside the landing distance, moving inward.
    const probe = makeProbe(300 - planet.radius - PROBE_RADIUS + 1, 0, 50, 0);
    stepProbes(system, [probe]);
    expect(probe.state).toBe("landed");
    const dx = probe.pos.x - planet.pos.x;
    const dy = probe.pos.y - planet.pos.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    expect(d).toBeCloseTo(planet.radius + PROBE_RADIUS, 6);
    expect(probe.vel).toEqual({ x: 0, y: 0 });
  });
});

describe("void", () => {
  it("marks a probe lost beyond bounds + margin", () => {
    const system = makeSystem([makePlanet(800, 2000)]); // far away, weak pull
    const probe = makeProbe(system.bounds.width + VOID_MARGIN + 50, 500, 1, 0);
    stepProbes(system, [probe]);
    expect(probe.state).toBe("lost");
  });

  it("does not mark a probe inside the margin", () => {
    const system = makeSystem([makePlanet(800, 2000)]);
    const probe = makeProbe(system.bounds.width + 50, 500, 0, 0);
    stepProbes(system, [probe]);
    expect(probe.state).toBe("flying");
  });
});

describe("probe-probe collision", () => {
  it("knocks a landed probe loose and swaps normal velocities (head-on)", () => {
    // No planets: pure collision physics.
    const system = makeSystem([]);
    const target: Probe = {
      pos: { x: 100, y: 0 },
      vel: { x: 0, y: 0 },
      state: "landed",
    };
    const incoming = makeProbe(100 - PROBE_RADIUS * 2 + 1, 0, 120, 0);
    // Place overlapping already so a single step triggers the collision.
    const probes = [incoming, target];
    stepProbes(system, probes);
    expect(target.state).toBe("flying");
    expect(incoming.state).toBe("flying");
    // Equal masses, head-on: velocities along the normal swap.
    expect(target.vel.x).toBeGreaterThan(100);
    expect(incoming.vel.x).toBeLessThan(20);
  });

  it("separates overlapping probes", () => {
    const system = makeSystem([]);
    const a = makeProbe(0, 0, 0, 0);
    const b = makeProbe(PROBE_RADIUS, 0, 0, 0); // heavily overlapping
    stepProbes(system, [a, b]);
    const d = Math.abs(b.pos.x - a.pos.x);
    expect(d).toBeGreaterThanOrEqual(PROBE_RADIUS * 2 - 1e-6);
  });

  it("ignores lost probes", () => {
    const system = makeSystem([]);
    const lost: Probe = { pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, state: "lost" };
    const flyer = makeProbe(1, 0, 10, 0);
    stepProbes(system, [lost, flyer]);
    expect(lost.state).toBe("lost");
  });
});
