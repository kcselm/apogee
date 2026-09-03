import { describe, expect, it } from "vitest";
import { WORLD_HEIGHT, WORLD_WIDTH } from "@apogee/engine";
import {
  canvasSize,
  canvasToWorld,
  canvasTransform,
  pickOrientation,
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
