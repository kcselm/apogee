import type { Vec2 } from "../types";
import { BOARD_PERIOD } from "./constants";
import type { Orbit } from "./types";

/** One fixed-step rotation of an orbit offset, renormalized to the radius.
 *  Pure: + − × ÷ sqrt only. */
export function advanceOrbit(
  off: Vec2,
  orbit: { cosStep: number; sinStep: number; radius: number },
): Vec2 {
  const nx = off.x * orbit.cosStep - off.y * orbit.sinStep;
  const ny = off.x * orbit.sinStep + off.y * orbit.cosStep;
  const len = Math.sqrt(nx * nx + ny * ny);
  return { x: (nx / len) * orbit.radius, y: (ny / len) * orbit.radius };
}

/** Offset at an absolute tick, reconstructed by stepping from offset0. Pure.
 *  Depends on `tick` only through `tick mod BOARD_PERIOD`. */
export function orbitOffsetAt(orbit: Orbit, tick: number): Vec2 {
  const k = (((tick | 0) % BOARD_PERIOD) + BOARD_PERIOD) % BOARD_PERIOD;
  let off = { x: orbit.offset0.x, y: orbit.offset0.y };
  for (let i = 0; i < k; i++) off = advanceOrbit(off, orbit);
  return off;
}

/** Absolute position (center + offset) at a tick. Pure. */
export function orbitPositionAt(orbit: Orbit, tick: number): Vec2 {
  const off = orbitOffsetAt(orbit, tick);
  return { x: orbit.center.x + off.x, y: orbit.center.y + off.y };
}

/** Authoring helper — trig is fine here; NEVER called in the sim loop.
 *  `phaseTurns` ∈ [0,1) start angle; `turnsPerPeriod` full orbits per BOARD_PERIOD
 *  (negative = reverse). */
export function makeOrbit(
  center: Vec2,
  radius: number,
  phaseTurns: number,
  turnsPerPeriod: number,
): Orbit {
  const step = (2 * Math.PI * turnsPerPeriod) / BOARD_PERIOD;
  const phase = 2 * Math.PI * phaseTurns;
  return {
    center,
    radius,
    offset0: { x: radius * Math.cos(phase), y: radius * Math.sin(phase) },
    cosStep: Math.cos(step),
    sinStep: Math.sin(step),
  };
}
