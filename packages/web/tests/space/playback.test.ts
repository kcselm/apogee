import { describe, expect, it } from "vitest";
import {
  CLEAR_TAIL,
  MAX_CATCHUP_STEPS,
  SIM_HZ,
  advanceClock,
  advancePlayback,
  createPlaybackClock,
  isPlaybackDone,
  skipTarget,
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

describe("advancePlayback / skipTarget / isPlaybackDone", () => {
  it("0 steps repeats the frame with nothing consumed", () => {
    expect(advancePlayback(10, 0, 200)).toEqual({ idx: 10, consumed: [] });
  });

  it("5 steps with 2 frames left consumes exactly 2 and lands on len - 1", () => {
    // len 200 → last index 199; starting at 197, 2 frames remain.
    expect(advancePlayback(197, 5, 200)).toEqual({ idx: 199, consumed: [198, 199] });
  });

  it("advancePlayback after skipTarget consumes nothing", () => {
    const len = 200;
    const idx = skipTarget(len);
    expect(advancePlayback(idx, 5, len)).toEqual({ idx, consumed: [] });
  });

  it("isPlaybackDone is false at len - 2, true at len - 1", () => {
    expect(isPlaybackDone(198, 200)).toBe(false);
    expect(isPlaybackDone(199, 200)).toBe(true);
  });

  it("a trace of length 1 is done at idx 0 with nothing to consume", () => {
    expect(isPlaybackDone(0, 1)).toBe(true);
    expect(advancePlayback(0, 5, 1)).toEqual({ idx: 0, consumed: [] });
  });

  it("board-clock identity start + len holds whether the end is reached by steps or by skip", () => {
    const start = 42;
    const len = 200;
    // Reached by steps (possibly across several render() calls).
    const stepped = advancePlayback(0, 1000, len);
    expect(isPlaybackDone(stepped.idx, len)).toBe(true);
    expect(start + stepped.idx).toBe(start + (len - 1));
    // Reached by skip.
    const skipped = skipTarget(len);
    expect(isPlaybackDone(skipped, len)).toBe(true);
    // Both paths land on the same final index, so start + len (the tick the
    // hook assigns on completion) is identical either way.
    expect(stepped.idx).toBe(skipped);
  });
});
