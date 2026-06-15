import { describe, expect, it } from "vitest";
import { activeShootingStars } from "../../src/space/shootingStars";

describe("activeShootingStars", () => {
  it("is deterministic for the same inputs", () => {
    for (const t of [0, 3000, 7200, 26000]) {
      expect(activeShootingStars(42, 1600, 1000, t)).toEqual(
        activeShootingStars(42, 1600, 1000, t),
      );
    }
  });
  it("returns at most two and progress stays in 0..1", () => {
    for (let t = 0; t < 60000; t += 137) {
      const stars = activeShootingStars(42, 1600, 1000, t);
      expect(stars.length).toBeLessThanOrEqual(2);
      for (const s of stars) {
        expect(s.progress).toBeGreaterThanOrEqual(0);
        expect(s.progress).toBeLessThanOrEqual(1);
      }
    }
  });
  it("produces at least one star over a long window", () => {
    let seen = 0;
    for (let t = 0; t < 60000; t += 50) seen += activeShootingStars(42, 1600, 1000, t).length;
    expect(seen).toBeGreaterThan(0);
  });
});
