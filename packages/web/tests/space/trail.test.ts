import { describe, expect, it } from "vitest";
import { createTrail, pushTrail, clearTrail } from "../../src/space/trail";

describe("trail ring buffer", () => {
  it("keeps points in push order, newest last", () => {
    const t = createTrail(3);
    pushTrail(t, 1, 1);
    pushTrail(t, 2, 2);
    expect(t.points).toEqual([{ x: 1, y: 1 }, { x: 2, y: 2 }]);
  });
  it("drops the oldest point past capacity", () => {
    const t = createTrail(2);
    pushTrail(t, 1, 1);
    pushTrail(t, 2, 2);
    pushTrail(t, 3, 3);
    expect(t.points).toEqual([{ x: 2, y: 2 }, { x: 3, y: 3 }]);
  });
  it("clears", () => {
    const t = createTrail(2);
    pushTrail(t, 1, 1);
    clearTrail(t);
    expect(t.points).toEqual([]);
  });
});
