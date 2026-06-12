import { describe, expect, it } from "vitest";
import { RINGS, scoreGame, scoreProbe } from "../src/scoring";
import type { GameState, Probe, StarSystem } from "../src/types";

const system: StarSystem = {
  planets: [{ pos: { x: 500, y: 500 }, radius: 60, mass: 3600 }],
  zones: [{ planetIndex: 0, center: { x: 560, y: 500 } }], // east surface point
  launchPos: { x: 80, y: 500 },
  bounds: { width: 1600, height: 1000 },
};

function landedAt(x: number, y: number): Probe {
  return { pos: { x, y }, vel: { x: 0, y: 0 }, state: "landed" };
}

describe("scoreProbe", () => {
  it("scores 5 inside the bullseye ring", () => {
    expect(scoreProbe(landedAt(565, 505), system)).toBe(5); // d ≈ 7.07
  });

  it("scores 3 in the middle ring", () => {
    expect(scoreProbe(landedAt(560, 520), system)).toBe(3); // d = 20
  });

  it("scores 1 in the outer ring", () => {
    expect(scoreProbe(landedAt(560, 540), system)).toBe(1); // d = 40
  });

  it("scores 0 outside all rings", () => {
    expect(scoreProbe(landedAt(560, 600), system)).toBe(0); // d = 100
  });

  it("scores 0 for lost probes regardless of position", () => {
    const lost: Probe = { pos: { x: 560, y: 500 }, vel: { x: 0, y: 0 }, state: "lost" };
    expect(scoreProbe(lost, system)).toBe(0);
  });

  it("ring thresholds are ordered tightest-first", () => {
    expect(RINGS[0]!.maxDist).toBeLessThan(RINGS[1]!.maxDist);
    expect(RINGS[1]!.maxDist).toBeLessThan(RINGS[2]!.maxDist);
  });
});

describe("scoreGame", () => {
  it("totals per-probe scores in launch order", () => {
    const state: GameState = {
      system,
      probes: [landedAt(565, 505), landedAt(560, 540)],
      launchesUsed: 2,
    };
    expect(scoreGame(state)).toEqual({ total: 6, perProbe: [5, 1] });
  });
});
