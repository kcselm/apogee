import { WORLD_HEIGHT, WORLD_WIDTH, type Vec2 } from "@apogee/engine";

export type Orientation = "landscape" | "portrait";

/** Portrait whenever the viewport is taller than it is wide. */
export function pickOrientation(viewportW: number, viewportH: number): Orientation {
  return viewportH > viewportW ? "portrait" : "landscape";
}

/** Canvas pixel size: the world as-is, or turned on its side. */
export function canvasSize(o: Orientation): { width: number; height: number } {
  return o === "portrait"
    ? { width: WORLD_HEIGHT, height: WORLD_WIDTH }
    : { width: WORLD_WIDTH, height: WORLD_HEIGHT };
}

/**
 * World → canvas. Portrait turns the board 90° counter-clockwise: world +x
 * (toward the goals) becomes canvas −y (up), the world's top edge becomes the
 * canvas's left edge, and the pad lands bottom-center. The engine and the
 * renderers never see this; they stay in world units.
 */
export function worldToCanvas(o: Orientation, p: Vec2): Vec2 {
  return o === "portrait" ? { x: p.y, y: WORLD_WIDTH - p.x } : { x: p.x, y: p.y };
}

/** Canvas → world: the inverse of `worldToCanvas`, for pointer input. */
export function canvasToWorld(o: Orientation, p: Vec2): Vec2 {
  return o === "portrait" ? { x: WORLD_WIDTH - p.y, y: p.x } : { x: p.x, y: p.y };
}

/** `worldToCanvas` as the `(a, b, c, d, e, f)` arguments of `ctx.setTransform`. */
export function canvasTransform(o: Orientation): [number, number, number, number, number, number] {
  return o === "portrait" ? [0, -1, 1, 0, 0, WORLD_WIDTH] : [1, 0, 0, 1, 0, 0];
}

/**
 * Pointer input → world units: undoes CSS scaling (the canvas's on-screen
 * rect vs. its pixel size for `o`), then undoes the portrait turn. `rect` is
 * whatever `Element.getBoundingClientRect()` shape the caller has on hand.
 */
export function pointerToWorld(
  rect: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number,
  o: Orientation,
): Vec2 {
  const { width, height } = canvasSize(o);
  return canvasToWorld(o, {
    x: ((clientX - rect.left) * width) / rect.width,
    y: ((clientY - rect.top) * height) / rect.height,
  });
}
