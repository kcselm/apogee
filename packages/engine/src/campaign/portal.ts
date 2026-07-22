import type { Vec2 } from "../types";
import type { Portal } from "./types";

/** Rotate a vector by (cos,sin). Pure. */
export function rotateVec(v: Vec2, cos: number, sin: number): Vec2 {
  return { x: v.x * cos - v.y * sin, y: v.x * sin + v.y * cos };
}

/** (cos,sin) rotation turning a probe entering along `entryFacing` into one exiting
 *  along `exitFacing`: head-on entry (velocity = −entryFacing) exits as +exitFacing.
 *  Pure — dot/cross of the unit facings only, no trig. */
export function portalExitRotation(
  entryFacing: Vec2,
  exitFacing: Vec2,
): { cos: number; sin: number } {
  // R maps entryFacing → −exitFacing, hence −entryFacing → exitFacing.
  const cos = -(entryFacing.x * exitFacing.x + entryFacing.y * exitFacing.y);
  const sin = -(entryFacing.x * exitFacing.y - entryFacing.y * exitFacing.x);
  return { cos, sin };
}

/** Authoring helper — trig is fine here. `facingDeg`: 0 = +x, 90 = +y (canvas down). */
export function makePortal(
  x: number,
  y: number,
  radius: number,
  facingDeg: number,
  link: number,
): Portal {
  const r = (facingDeg * Math.PI) / 180;
  return { pos: { x, y }, radius, facing: { x: Math.cos(r), y: Math.sin(r) }, link };
}
