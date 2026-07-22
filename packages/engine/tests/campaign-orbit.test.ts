import { describe, expect, it } from "vitest";
import { BOARD_PERIOD } from "../src/campaign/constants";
import { advanceOrbit, makeOrbit, orbitOffsetAt, orbitPositionAt } from "../src/campaign/orbit";

describe("orbit math", () => {
  it("keeps the offset on the orbit radius over a long run", () => {
    const orbit = makeOrbit({ x: 800, y: 500 }, 160, 0, 1);
    let off = { x: orbit.offset0.x, y: orbit.offset0.y };
    for (let i = 0; i < 5000; i++) off = advanceOrbit(off, orbit);
    expect(Math.sqrt(off.x * off.x + off.y * off.y)).toBeCloseTo(160, 6);
  });

  it("orbitOffsetAt(tick) equals stepping from offset0 tick times", () => {
    const orbit = makeOrbit({ x: 800, y: 500 }, 120, 0.25, 2);
    let off = { x: orbit.offset0.x, y: orbit.offset0.y };
    for (let i = 0; i < 37; i++) off = advanceOrbit(off, orbit);
    const at = orbitOffsetAt(orbit, 37);
    expect(at.x).toBe(off.x);
    expect(at.y).toBe(off.y);
  });

  it("is periodic modulo BOARD_PERIOD", () => {
    const orbit = makeOrbit({ x: 0, y: 0 }, 100, 0.1, 1);
    const a = orbitOffsetAt(orbit, 5);
    const b = orbitOffsetAt(orbit, 5 + BOARD_PERIOD);
    expect(b.x).toBe(a.x);
    expect(b.y).toBe(a.y);
  });

  it("orbitPositionAt adds the center", () => {
    const orbit = makeOrbit({ x: 300, y: 200 }, 80, 0, 1);
    expect(orbitPositionAt(orbit, 0)).toEqual({ x: 380, y: 200 });
  });
});
