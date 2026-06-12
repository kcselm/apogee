import { describe, expect, it } from "vitest";
import { DT } from "../src/constants";
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
