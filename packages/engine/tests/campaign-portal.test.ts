import { describe, expect, it } from "vitest";
import { makePortal, portalExitRotation, rotateVec } from "../src/campaign/portal";

describe("portal transform", () => {
  it("head-on entry exits straight along the far portal's facing", () => {
    const a = makePortal(400, 500, 30, 0, 1); // faces +x
    const b = makePortal(900, 500, 30, 90, 0); // faces +y
    const rot = portalExitRotation(a.facing, b.facing);
    // Entering A head-on means velocity opposite A.facing: (-1,0)·speed.
    const vout = rotateVec({ x: -200, y: 0 }, rot.cos, rot.sin);
    expect(vout.x).toBeCloseTo(0, 6);
    expect(vout.y).toBeCloseTo(200, 6);
  });

  it("preserves speed for an arbitrary entry", () => {
    const a = makePortal(0, 0, 20, 37, 1);
    const b = makePortal(100, 0, 20, 211, 0);
    const rot = portalExitRotation(a.facing, b.facing);
    const vin = { x: 123, y: -45 };
    const vout = rotateVec(vin, rot.cos, rot.sin);
    expect(Math.hypot(vout.x, vout.y)).toBeCloseTo(Math.hypot(vin.x, vin.y), 6);
  });

  it("makePortal builds a unit facing vector", () => {
    const p = makePortal(10, 20, 25, 90, 1);
    expect(p.facing.x).toBeCloseTo(0, 6);
    expect(p.facing.y).toBeCloseTo(1, 6);
    expect(Math.hypot(p.facing.x, p.facing.y)).toBeCloseTo(1, 6);
  });
});
