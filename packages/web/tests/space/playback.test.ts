import { describe, expect, it } from "vitest";
import {
  CLEAR_TAIL,
  MAX_CATCHUP_STEPS,
  SIM_HZ,
  advanceClock,
  createPlaybackClock,
  trimToClear,
} from "../../src/space/playback";

const frames = (n: number) => Array.from({ length: n }, (_, i) => i);

describe("trimToClear", () => {
  it("returns the same array when the launch did not clear", () => {
    const t = frames(200);
    expect(trimToClear(t, null)).toBe(t);
  });
  it("keeps the clearing frame plus CLEAR_TAIL more", () => {
    expect(CLEAR_TAIL).toBe(36);
    expect(trimToClear(frames(200), 58)).toHaveLength(58 + 1 + 36);
  });
  it("never extends past the end of the trace", () => {
    expect(trimToClear(frames(60), 58)).toHaveLength(60);
  });
  it("honours a custom tail", () => {
    expect(trimToClear(frames(10), 0, 3)).toEqual([0, 1, 2, 3]);
  });
});

const FRAME = 1000 / SIM_HZ;

describe("playback clock", () => {
  it("emits exactly one step per frame at 60 Hz", () => {
    const c = createPlaybackClock();
    expect(advanceClock(c, 0)).toBe(0); // first call only anchors the clock
    let total = 0;
    for (let k = 1; k <= 60; k++) total += advanceClock(c, k * FRAME);
    expect(total).toBe(60);
  });

  it("emits ~one step every other frame at 120 Hz (60 steps over a second)", () => {
    const c = createPlaybackClock();
    advanceClock(c, 0);
    let total = 0;
    for (let k = 1; k <= 120; k++) total += advanceClock(c, (k * 1000) / 120);
    expect(total).toBeGreaterThanOrEqual(59);
    expect(total).toBeLessThanOrEqual(60);
  });

  it("emits two steps per frame at 30 Hz", () => {
    const c = createPlaybackClock();
    advanceClock(c, 0);
    expect(advanceClock(c, 1000 / 30)).toBe(2);
  });

  it("clamps catch-up after a stall and drops the excess", () => {
    const c = createPlaybackClock();
    advanceClock(c, 0);
    expect(advanceClock(c, 5000)).toBe(MAX_CATCHUP_STEPS);
    // The stall is discarded, not replayed: the next normal frame owes 1 step.
    expect(advanceClock(c, 5000 + FRAME)).toBe(1);
  });
});
