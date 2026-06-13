import { DT, GRAVITY, PROBE_RADIUS, VOID_MARGIN } from "./constants";
import type { Probe, StarSystem, Vec2 } from "./types";

/** The minimal shape physics needs from a gravitating, collidable body. */
export interface GravityBody {
  pos: Vec2;
  radius: number;
  mass: number;
}

/** Net gravitational acceleration at a point. Only + - * / sqrt — determinism. */
export function gravityAt(
  bodies: readonly GravityBody[],
  x: number,
  y: number,
): { ax: number; ay: number } {
  let ax = 0;
  let ay = 0;
  for (const p of bodies) {
    const dx = p.pos.x - x;
    const dy = p.pos.y - y;
    const d2 = dx * dx + dy * dy;
    const d = Math.sqrt(d2);
    const a = (GRAVITY * p.mass) / d2;
    ax += (a * dx) / d;
    ay += (a * dy) / d;
  }
  return { ax, ay };
}

/** Advance one flying probe a single fixed step (semi-implicit Euler). */
export function integrate(bodies: readonly GravityBody[], probe: Probe): void {
  const { ax, ay } = gravityAt(bodies, probe.pos.x, probe.pos.y);
  probe.vel.x += ax * DT;
  probe.vel.y += ay * DT;
  probe.pos.x += probe.vel.x * DT;
  probe.pos.y += probe.vel.y * DT;
}

/** True when a probe overlaps a body's surface. */
export function contacts(body: GravityBody, probe: Probe): boolean {
  const dx = probe.pos.x - body.pos.x;
  const dy = probe.pos.y - body.pos.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  return d <= body.radius + PROBE_RADIUS;
}

/** Snap a probe to a body's surface, zero its velocity, mark it landed. */
export function landOn(body: GravityBody, probe: Probe): void {
  const dx = probe.pos.x - body.pos.x;
  const dy = probe.pos.y - body.pos.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  const r = body.radius + PROBE_RADIUS;
  probe.pos.x = body.pos.x + (dx / d) * r;
  probe.pos.y = body.pos.y + (dy / d) * r;
  probe.vel.x = 0;
  probe.vel.y = 0;
  probe.state = "landed";
}

/** Equal-mass elastic probe-probe collisions; knocked probes fly again. */
export function resolveCollisions(probes: Probe[]): void {
  for (let i = 0; i < probes.length; i++) {
    for (let j = i + 1; j < probes.length; j++) {
      const a = probes[i]!;
      const b = probes[j]!;
      if (a.state === "lost" || b.state === "lost") continue;
      if (a.state !== "flying" && b.state !== "flying") continue;
      const dx = b.pos.x - a.pos.x;
      const dy = b.pos.y - a.pos.y;
      const d2 = dx * dx + dy * dy;
      const minD = PROBE_RADIUS * 2;
      if (d2 >= minD * minD || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const nx = dx / d;
      const ny = dy / d;
      const half = (minD - d) / 2;
      a.pos.x -= nx * half;
      a.pos.y -= ny * half;
      b.pos.x += nx * half;
      b.pos.y += ny * half;
      const avn = a.vel.x * nx + a.vel.y * ny;
      const bvn = b.vel.x * nx + b.vel.y * ny;
      a.vel.x += (bvn - avn) * nx;
      a.vel.y += (bvn - avn) * ny;
      b.vel.x += (avn - bvn) * nx;
      b.vel.y += (avn - bvn) * ny;
      a.state = "flying";
      b.state = "flying";
    }
  }
}

/** Mark a flying probe lost if it leaves the bounds + margin. */
export function voidCheck(
  bounds: { width: number; height: number },
  probe: Probe,
): void {
  if (probe.state !== "flying") return;
  if (
    probe.pos.x < -VOID_MARGIN ||
    probe.pos.x > bounds.width + VOID_MARGIN ||
    probe.pos.y < -VOID_MARGIN ||
    probe.pos.y > bounds.height + VOID_MARGIN
  ) {
    probe.state = "lost";
  }
}

/**
 * Advance all probes one fixed timestep for the DAILY game. Behavior is
 * identical to the previous inline implementation — now composed from the
 * primitives above so the campaign step can reuse them. Mutates in place.
 */
export function stepProbes(system: StarSystem, probes: Probe[]): void {
  for (const probe of probes) {
    if (probe.state !== "flying") continue;
    integrate(system.planets, probe);
  }
  for (const probe of probes) {
    if (probe.state !== "flying") continue;
    for (const planet of system.planets) {
      if (contacts(planet, probe)) {
        landOn(planet, probe);
        break;
      }
    }
  }
  resolveCollisions(probes);
  for (const probe of probes) voidCheck(system.bounds, probe);
}
