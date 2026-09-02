import { describe, expect, it } from "vitest";
import { CLEAR_TAIL, trimToClear } from "../../src/space/playback";

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
