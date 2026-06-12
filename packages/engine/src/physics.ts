import { DT, GRAVITY, PROBE_RADIUS, VOID_MARGIN } from "./constants";
import type { Planet, Probe, StarSystem } from "./types";

/** Net gravitational acceleration at a point. Only + - * / sqrt — determinism. */
export function gravityAt(
  planets: Planet[],
  x: number,
  y: number,
): { ax: number; ay: number } {
  let ax = 0;
  let ay = 0;
  for (const p of planets) {
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

/**
 * Advance all probes one fixed timestep: integrate, land, collide, void-check.
 * Mutates the probes array in place.
 */
export function stepProbes(system: StarSystem, probes: Probe[]): void {
  // 1. Integrate flying probes (semi-implicit Euler).
  for (const probe of probes) {
    if (probe.state !== "flying") continue;
    const { ax, ay } = gravityAt(system.planets, probe.pos.x, probe.pos.y);
    probe.vel.x += ax * DT;
    probe.vel.y += ay * DT;
    probe.pos.x += probe.vel.x * DT;
    probe.pos.y += probe.vel.y * DT;
  }

  // 2. Planet landings: snap to surface, zero velocity, stick.
  for (const probe of probes) {
    if (probe.state !== "flying") continue;
    for (const planet of system.planets) {
      const dx = probe.pos.x - planet.pos.x;
      const dy = probe.pos.y - planet.pos.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= planet.radius + PROBE_RADIUS) {
        const r = planet.radius + PROBE_RADIUS;
        probe.pos.x = planet.pos.x + (dx / d) * r;
        probe.pos.y = planet.pos.y + (dy / d) * r;
        probe.vel.x = 0;
        probe.vel.y = 0;
        probe.state = "landed";
        break;
      }
    }
  }

  // 3. Probe-probe collisions: equal-mass elastic, knocked probes fly again.
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
      // Separate the overlap evenly.
      const half = (minD - d) / 2;
      a.pos.x -= nx * half;
      a.pos.y -= ny * half;
      b.pos.x += nx * half;
      b.pos.y += ny * half;
      // Equal-mass elastic collision: swap velocity components along the normal.
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

  // 4. Void check.
  for (const probe of probes) {
    if (probe.state !== "flying") continue;
    const { width, height } = system.bounds;
    if (
      probe.pos.x < -VOID_MARGIN ||
      probe.pos.x > width + VOID_MARGIN ||
      probe.pos.y < -VOID_MARGIN ||
      probe.pos.y > height + VOID_MARGIN
    ) {
      probe.state = "lost";
    }
  }
}
