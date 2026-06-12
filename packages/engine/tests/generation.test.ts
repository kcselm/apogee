import { describe, expect, it } from "vitest";
import { PROBE_RADIUS, WORLD_HEIGHT, WORLD_WIDTH } from "../src/constants";
import { generateSystem } from "../src/generation";

describe("generateSystem", () => {
  it("is deterministic for the same seed", () => {
    expect(generateSystem(42)).toEqual(generateSystem(42));
  });

  it("differs across seeds", () => {
    expect(generateSystem(1)).not.toEqual(generateSystem(2));
  });

  it("produces valid systems for 500 consecutive seeds", () => {
    for (let seed = 0; seed < 500; seed++) {
      const sys = generateSystem(seed);
      expect(sys.planets.length).toBeGreaterThanOrEqual(2);
      expect(sys.planets.length).toBeLessThanOrEqual(3);
      expect(sys.zones.length).toBe(3);
      // Planets inside the world with breathing room.
      for (const p of sys.planets) {
        expect(p.pos.x - p.radius).toBeGreaterThan(0);
        expect(p.pos.x + p.radius).toBeLessThan(WORLD_WIDTH);
        expect(p.pos.y - p.radius).toBeGreaterThan(0);
        expect(p.pos.y + p.radius).toBeLessThan(WORLD_HEIGHT);
        expect(p.mass).toBeCloseTo(p.radius * p.radius, 6);
      }
      // No overlapping planets (with corridor gap).
      for (let i = 0; i < sys.planets.length; i++) {
        for (let j = i + 1; j < sys.planets.length; j++) {
          const a = sys.planets[i]!;
          const b = sys.planets[j]!;
          const dx = a.pos.x - b.pos.x;
          const dy = a.pos.y - b.pos.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          expect(d).toBeGreaterThanOrEqual(a.radius + b.radius + 180);
        }
      }
      // Launch position clear of planets.
      for (const p of sys.planets) {
        const dx = sys.launchPos.x - p.pos.x;
        const dy = sys.launchPos.y - p.pos.y;
        expect(Math.sqrt(dx * dx + dy * dy)).toBeGreaterThanOrEqual(p.radius + 150);
      }
      // Zones sit exactly on their planet's surface.
      for (const z of sys.zones) {
        const planet = sys.planets[z.planetIndex]!;
        const dx = z.center.x - planet.pos.x;
        const dy = z.center.y - planet.pos.y;
        expect(Math.sqrt(dx * dx + dy * dy)).toBeCloseTo(planet.radius, 4);
      }
      expect(PROBE_RADIUS).toBeLessThan(14); // probes can reach the 5-ring (sanity)
    }
  });
});
