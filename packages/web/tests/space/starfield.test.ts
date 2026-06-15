import { describe, expect, it } from "vitest";
import { generateStarfield, twinkleAlpha, parallax } from "../../src/space/starfield";

describe("starfield", () => {
  it("is deterministic for a given seed", () => {
    const a = generateStarfield(7, 200, 100, 12);
    const b = generateStarfield(7, 200, 100, 12);
    expect(a).toEqual(b);
  });
  it("places the requested count within bounds", () => {
    const f = generateStarfield(7, 200, 100, 30);
    expect(f.stars).toHaveLength(30);
    for (const s of f.stars) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThan(200);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThan(100);
    }
  });
  it("keeps twinkle alpha in (0.5, 1]", () => {
    const f = generateStarfield(7, 200, 100, 12);
    for (const t of [0, 500, 1234, 99999]) {
      for (const s of f.stars) {
        const a = twinkleAlpha(s, t);
        expect(a).toBeGreaterThan(0.5);
        expect(a).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
  });
  it("parallax: no drag → pure vertical drift at t=0; deeper layers shift more with drag", () => {
    expect(parallax(0.5, null, 0)).toEqual({ x: 0, y: 2 });
    const near = parallax(0.8, { dx: 100, dy: 0 }, 0).x;
    const far = parallax(0.4, { dx: 100, dy: 0 }, 0).x;
    expect(near).toBeLessThan(far); // both negative; near shifts more
  });
});
