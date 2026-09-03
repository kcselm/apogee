import { describe, expect, it } from "vitest";
import { MAX_SPEED, POWER_SCALE } from "@apogee/engine";
import {
  MAX_PULL,
  MIN_PULL,
  clampPull,
  pullLength,
  pullVector,
  shouldFire,
} from "../../src/space/aim";

describe("pullVector", () => {
  it("is origin minus pointer: pull back to shoot forward", () => {
    expect(pullVector({ x: 100, y: 200 }, { x: 40, y: 230 })).toEqual({ dx: 60, dy: -30 });
  });
  it("is zero when the pointer has not moved", () => {
    expect(pullVector({ x: 5, y: 5 }, { x: 5, y: 5 })).toEqual({ dx: 0, dy: 0 });
  });
});

describe("pullLength", () => {
  it("is the Euclidean length", () => {
    expect(pullLength({ dx: 3, dy: 4 })).toBe(5);
    expect(pullLength({ dx: 0, dy: 0 })).toBe(0);
  });
});

describe("shouldFire", () => {
  it("never fires a zero pull", () => {
    expect(shouldFire({ dx: 0, dy: 0 })).toBe(false);
  });
  it("is false just under MIN_PULL", () => {
    expect(MIN_PULL).toBe(10);
    expect(shouldFire({ dx: 9.99, dy: 0 })).toBe(false);
    expect(shouldFire({ dx: 6, dy: 7.9 })).toBe(false); // length ≈ 9.92
  });
  it("is true at exactly MIN_PULL and beyond", () => {
    expect(shouldFire({ dx: 10, dy: 0 })).toBe(true);
    expect(shouldFire({ dx: 6, dy: 8 })).toBe(true); // length 10
    expect(shouldFire({ dx: -150, dy: 20 })).toBe(true);
  });
});

describe("clampPull", () => {
  it("caps at MAX_PULL, the engine's speed cap in drag units", () => {
    expect(MAX_PULL).toBe(MAX_SPEED / POWER_SCALE);
    expect(MAX_PULL).toBe(200);
  });
  it("leaves a pull within the cap unchanged", () => {
    expect(clampPull({ dx: 3, dy: 4 })).toEqual({ dx: 3, dy: 4 });
    expect(clampPull({ dx: 120, dy: -160 })).toEqual({ dx: 120, dy: -160 }); // length 200
  });
  it("preserves direction and caps the length", () => {
    const c = clampPull({ dx: 300, dy: -400 }); // length 500
    expect(pullLength(c)).toBeCloseTo(200, 9);
    expect(c.dx / c.dy).toBeCloseTo(300 / -400, 9);
    expect(c.dx).toBeGreaterThan(0);
    expect(c.dy).toBeLessThan(0);
  });
});
