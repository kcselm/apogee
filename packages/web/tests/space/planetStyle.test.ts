import { describe, expect, it } from "vitest";
import { planetTypeFor, PLANET_PALETTES } from "../../src/space/planetStyle";

describe("planetTypeFor", () => {
  it("is deterministic for a given position", () => {
    expect(planetTypeFor({ x: 800, y: 520 })).toBe(planetTypeFor({ x: 800, y: 520 }));
  });
  it("produces all three types across a grid", () => {
    const seen = new Set<string>();
    for (let x = 0; x < 1600; x += 80) {
      for (let y = 0; y < 1000; y += 80) seen.add(planetTypeFor({ x, y }));
    }
    expect(seen).toEqual(new Set(["gasGiant", "rocky", "ice"]));
  });
  it("has a palette for every type", () => {
    for (const type of ["gasGiant", "rocky", "ice"] as const) {
      expect(PLANET_PALETTES[type]).toBeDefined();
    }
  });
});
