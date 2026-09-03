import { describe, expect, it } from "vitest";
import { WORLD_HEIGHT, WORLD_WIDTH } from "@apogee/engine";
import {
  canvasSize,
  canvasToWorld,
  canvasTransform,
  pickOrientation,
  pointerToWorld,
  worldToCanvas,
  type Orientation,
} from "../../src/space/orientation";

const ORIENTATIONS: Orientation[] = ["landscape", "portrait"];
const POINTS = [
  { x: 0, y: 0 },
  { x: 80, y: 500 },
  { x: 1600, y: 1000 },
  { x: 1234.5, y: 67.25 },
];

describe("pickOrientation", () => {
  it("is portrait only when the viewport is taller than it is wide", () => {
    expect(pickOrientation(390, 844)).toBe("portrait");
    expect(pickOrientation(844, 390)).toBe("landscape");
    expect(pickOrientation(800, 800)).toBe("landscape");
  });
});

describe("canvasSize", () => {
  it("is the world in landscape and the world on its side in portrait", () => {
    expect(WORLD_WIDTH).toBe(1600);
    expect(WORLD_HEIGHT).toBe(1000);
    expect(canvasSize("landscape")).toEqual({ width: 1600, height: 1000 });
    expect(canvasSize("portrait")).toEqual({ width: 1000, height: 1600 });
  });
});

describe("worldToCanvas / canvasToWorld", () => {
  it("is the identity in landscape", () => {
    for (const p of POINTS) {
      expect(worldToCanvas("landscape", p)).toEqual(p);
      expect(canvasToWorld("landscape", p)).toEqual(p);
    }
  });
  it("puts the pad (80, 500) bottom-center in portrait", () => {
    expect(worldToCanvas("portrait", { x: 80, y: 500 })).toEqual({ x: 500, y: 1520 });
  });
  it("maps world +x (toward the goals) to canvas −y (up) in portrait", () => {
    const a = worldToCanvas("portrait", { x: 100, y: 500 });
    const b = worldToCanvas("portrait", { x: 200, y: 500 });
    expect(b.x).toBe(a.x);
    expect(b.y).toBeLessThan(a.y);
  });
  it("maps the world's top edge to the canvas's left edge in portrait", () => {
    expect(worldToCanvas("portrait", { x: 700, y: 0 }).x).toBe(0);
    expect(worldToCanvas("portrait", { x: 700, y: WORLD_HEIGHT }).x).toBe(WORLD_HEIGHT);
  });
  it("keeps every world corner inside the portrait canvas", () => {
    const { width, height } = canvasSize("portrait");
    for (const p of [{ x: 0, y: 0 }, { x: 1600, y: 0 }, { x: 0, y: 1000 }, { x: 1600, y: 1000 }]) {
      const c = worldToCanvas("portrait", p);
      expect(c.x).toBeGreaterThanOrEqual(0);
      expect(c.x).toBeLessThanOrEqual(width);
      expect(c.y).toBeGreaterThanOrEqual(0);
      expect(c.y).toBeLessThanOrEqual(height);
    }
  });
  it("round-trips in both orientations", () => {
    for (const o of ORIENTATIONS) {
      for (const p of POINTS) {
        expect(canvasToWorld(o, worldToCanvas(o, p))).toEqual(p);
        expect(worldToCanvas(o, canvasToWorld(o, p))).toEqual(p);
      }
    }
  });
});

describe("pointerToWorld", () => {
  it("undoes CSS scaling in landscape (identity mapping past the rect)", () => {
    // Rect is a half-scale rendering of the 1600x1000 landscape canvas.
    const rect = { left: 20, top: 10, width: 800, height: 500 };
    expect(pointerToWorld(rect, 20 + 400, 10 + 250, "landscape")).toEqual({ x: 800, y: 500 });
  });
  it("pairs canvasSize(o).width against rect.width, not swapped, for an oddly-scaled rect", () => {
    const rect = { left: 12, top: 34, width: 250, height: 400 };
    const clientX = rect.left + 125;
    const clientY = rect.top + 200;
    const { width, height } = canvasSize("portrait");
    const manual = canvasToWorld("portrait", {
      x: ((clientX - rect.left) * width) / rect.width,
      y: ((clientY - rect.top) * height) / rect.height,
    });
    expect(pointerToWorld(rect, clientX, clientY, "portrait")).toEqual(manual);
  });
  it("pressing the visual bottom-centre of a portrait canvas lands near the launch pad (80, 500)", () => {
    // Portrait canvas pixel size is 1000x1600 (WORLD_HEIGHT x WORLD_WIDTH); this
    // rect is a phone-sized CSS rendering at the same 0.625 aspect ratio.
    const rect = { left: 100, top: 50, width: 300, height: 480 };
    const clientX = rect.left + rect.width * 0.5; // horizontal centre
    const clientY = rect.top + rect.height * (1520 / 1600); // near the bottom edge
    expect(pointerToWorld(rect, clientX, clientY, "portrait")).toEqual({ x: 80, y: 500 });
  });
  it("the landscape equivalent: the pad sits near the visual left-centre", () => {
    // Landscape canvas pixel size is 1600x1000; this rect is a scaled-down
    // rendering at the same 1.6 aspect ratio.
    const rect = { left: 5, top: 5, width: 480, height: 300 };
    const clientX = rect.left + rect.width * (80 / 1600); // near the left edge
    const clientY = rect.top + rect.height * 0.5; // vertical centre
    expect(pointerToWorld(rect, clientX, clientY, "landscape")).toEqual({ x: 80, y: 500 });
  });
});

describe("canvasTransform", () => {
  it("is worldToCanvas as a setTransform(a, b, c, d, e, f) matrix", () => {
    for (const o of ORIENTATIONS) {
      const [a, b, c, d, e, f] = canvasTransform(o);
      for (const p of POINTS) {
        expect({ x: a * p.x + c * p.y + e, y: b * p.x + d * p.y + f }).toEqual(worldToCanvas(o, p));
      }
    }
  });
  it("is the spec's matrix in portrait", () => {
    expect(canvasTransform("portrait")).toEqual([0, -1, 1, 0, 0, WORLD_WIDTH]);
    expect(canvasTransform("landscape")).toEqual([1, 0, 0, 1, 0, 0]);
  });
});
