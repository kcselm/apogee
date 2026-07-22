import { describe, expect, it } from "vitest";
import { pathSegments } from "../../src/space/previewPath";

// Matches render.ts: a probe moves <=~10 units/step, so 60^2 cleanly separates
// normal steps from a wormhole teleport (portals are hundreds of units apart).
const GAP2 = 60 * 60;

describe("pathSegments", () => {
  it("keeps a continuous path (small steps) as a single segment", () => {
    const path = [
      { x: 0, y: 0 },
      { x: 8, y: 2 },
      { x: 15, y: 5 },
      { x: 24, y: 9 },
    ];
    const segs = pathSegments(path, GAP2);
    expect(segs).toHaveLength(1);
    expect(segs[0]).toHaveLength(4);
  });

  it("breaks into two segments at a teleport-sized jump (in one portal, out the other)", () => {
    const path = [
      { x: 0, y: 0 }, // approach into portal A
      { x: 9, y: 1 },
      { x: 18, y: 2 },
      { x: 900, y: 500 }, // teleported to portal B, far away
      { x: 908, y: 503 }, // exit stub continuing from B
    ];
    const segs = pathSegments(path, GAP2);
    expect(segs).toHaveLength(2);
    expect(segs[0]).toEqual([
      { x: 0, y: 0 },
      { x: 9, y: 1 },
      { x: 18, y: 2 },
    ]);
    expect(segs[1]).toEqual([
      { x: 900, y: 500 },
      { x: 908, y: 503 },
    ]);
    // The huge A->B jump is never a segment, so it is never drawn as a line.
    for (const seg of segs) {
      for (let i = 1; i < seg.length; i++) {
        const dx = seg[i]!.x - seg[i - 1]!.x;
        const dy = seg[i]!.y - seg[i - 1]!.y;
        expect(dx * dx + dy * dy).toBeLessThanOrEqual(GAP2);
      }
    }
  });

  it("handles multiple teleports", () => {
    const path = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 500, y: 0 }, // teleport 1
      { x: 505, y: 0 },
      { x: 5, y: 900 }, // teleport 2
      { x: 9, y: 902 },
    ];
    expect(pathSegments(path, GAP2)).toHaveLength(3);
  });

  it("returns no segments for an empty path and a single-point segment for one point", () => {
    expect(pathSegments([], GAP2)).toEqual([]);
    expect(pathSegments([{ x: 3, y: 4 }], GAP2)).toEqual([[{ x: 3, y: 4 }]]);
  });
});
