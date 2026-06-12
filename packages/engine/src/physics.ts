import { DT, GRAVITY } from "./constants";
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

/** Advance all probes one fixed timestep. Mutates the probes array in place. */
export function stepProbes(system: StarSystem, probes: Probe[]): void {
  for (const probe of probes) {
    if (probe.state !== "flying") continue;
    const { ax, ay } = gravityAt(system.planets, probe.pos.x, probe.pos.y);
    probe.vel.x += ax * DT;
    probe.vel.y += ay * DT;
    probe.pos.x += probe.vel.x * DT;
    probe.pos.y += probe.vel.y * DT;
  }
}
