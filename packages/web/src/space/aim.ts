import { MAX_SPEED, POWER_SCALE, type Vec2 } from "@apogee/engine";

/** World units of pull below which a release cancels instead of launching. */
export const MIN_PULL = 10;
/** Longest pull worth drawing: the engine's speed cap, in drag units. */
export const MAX_PULL = MAX_SPEED / POWER_SCALE;

export interface Pull {
  dx: number;
  dy: number;
}

/** A drag in progress: where the board was pressed (world units) and the pull so far. */
export interface AimDrag extends Pull {
  origin: Vec2;
}

/**
 * Pull from the press point toward the current pointer, both in world units.
 * `origin − pointer`: pulling back (away from the target) points the pull at
 * the target, the slingshot way. The engine launches along +(dx, dy).
 */
export function pullVector(origin: Vec2, pointer: Vec2): Pull {
  return { dx: origin.x - pointer.x, dy: origin.y - pointer.y };
}

export function pullLength(p: Pull): number {
  return Math.sqrt(p.dx * p.dx + p.dy * p.dy);
}

/** A release launches only when the pull is at least MIN_PULL long. */
export function shouldFire(p: Pull): boolean {
  return pullLength(p) >= MIN_PULL;
}

/** Same direction, length capped at MAX_PULL — for drawing only; the engine clamps speed itself. */
export function clampPull(p: Pull): Pull {
  const len = pullLength(p);
  if (len <= MAX_PULL) return p;
  const k = MAX_PULL / len;
  return { dx: p.dx * k, dy: p.dy * k };
}
