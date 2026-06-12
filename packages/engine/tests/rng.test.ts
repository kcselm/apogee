import { describe, expect, it } from "vitest";
import { hashString, mulberry32 } from "../src/rng";

describe("mulberry32", () => {
  it("produces the same sequence for the same seed", () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    for (let i = 0; i < 100; i++) {
      expect(a()).toBe(b());
    }
  });

  it("produces different sequences for different seeds", () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    const aVals = Array.from({ length: 10 }, () => a());
    const bVals = Array.from({ length: 10 }, () => b());
    expect(aVals).not.toEqual(bVals);
  });

  it("produces values in [0, 1)", () => {
    const rng = mulberry32(999);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("hashString", () => {
  it("is deterministic", () => {
    expect(hashString("2026-06-11")).toBe(hashString("2026-06-11"));
  });

  it("differs for different strings", () => {
    expect(hashString("2026-06-11")).not.toBe(hashString("2026-06-12"));
  });

  it("returns an unsigned 32-bit integer", () => {
    const h = hashString("apogee");
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });
});
