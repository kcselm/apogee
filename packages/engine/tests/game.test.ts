import { describe, expect, it } from "vitest";
import { MAX_SPEED, PREVIEW_STEPS } from "../src/constants";
import { simulateLaunch } from "../src/game";
import type { GameState, Planet, StarSystem } from "../src/types";

function makePlanet(x: number, y: number, radius = 60): Planet {
  return { pos: { x, y }, radius, mass: radius * radius };
}

function makeState(planets: Planet[]): GameState {
  const system: StarSystem = {
    planets,
    zones: [],
    launchPos: { x: 80, y: 500 },
    bounds: { width: 1600, height: 1000 },
  };
  return { system, probes: [], launchesUsed: 0 };
}

describe("simulateLaunch", () => {
  it("adds a probe, increments launchesUsed, and resolves to a non-flying state", () => {
    const state = makeState([makePlanet(800, 500)]);
    const result = simulateLaunch(state, { dx: 200, dy: 0 });
    expect(result.state.launchesUsed).toBe(1);
    expect(result.state.probes).toHaveLength(1);
    expect(result.state.probes[0]!.state).not.toBe("flying");
    expect(result.trace.length).toBeGreaterThan(0);
  });

  it("does not mutate the input state", () => {
    const state = makeState([makePlanet(800, 500)]);
    const before = JSON.stringify(state);
    simulateLaunch(state, { dx: 200, dy: 0 });
    expect(JSON.stringify(state)).toBe(before);
  });

  it("clamps launch speed to MAX_SPEED", () => {
    const state = makeState([makePlanet(800, 2000, 40)]); // weak, far pull
    const result = simulateLaunch(state, { dx: 100000, dy: 0 }, 1);
    const frame = result.trace[0]![0]!;
    // After one step at clamped speed, x advanced by at most MAX_SPEED*DT (+ tiny gravity).
    expect(frame.x - 80).toBeLessThanOrEqual(MAX_SPEED / 60 + 1);
  });

  it("respects maxSteps for previews", () => {
    const state = makeState([makePlanet(800, 2000, 40)]);
    const result = simulateLaunch(state, { dx: 50, dy: -50 }, PREVIEW_STEPS);
    expect(result.trace.length).toBeLessThanOrEqual(PREVIEW_STEPS);
  });

  it("is deterministic: identical inputs produce identical results", () => {
    const a = simulateLaunch(makeState([makePlanet(800, 500)]), { dx: 173.5, dy: -42.25 });
    const b = simulateLaunch(makeState([makePlanet(800, 500)]), { dx: 173.5, dy: -42.25 });
    expect(a).toEqual(b);
  });
});
