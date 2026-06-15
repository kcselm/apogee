import { describe, expect, it } from "vitest";
import { pruneBursts, burstProgress, BURST_LIFE, type Burst } from "../../src/space/effects";

const burst = (start: number): Burst => ({ x: 0, y: 0, start, kind: "land" });

describe("burst effects", () => {
  it("keeps bursts within their lifetime and drops expired ones", () => {
    const list = [burst(0), burst(500)];
    expect(pruneBursts(list, 400)).toHaveLength(2);
    expect(pruneBursts(list, BURST_LIFE + 1)).toEqual([burst(500)]);
  });
  it("reports progress clamped to 0..1", () => {
    expect(burstProgress(burst(0), -10)).toBe(0);
    expect(burstProgress(burst(0), BURST_LIFE / 2)).toBeCloseTo(0.5, 5);
    expect(burstProgress(burst(0), BURST_LIFE * 2)).toBe(1);
  });
});
