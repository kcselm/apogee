import type { GameState, Probe, StarSystem } from "./types";

/** Bullseye rings: distance from zone center → points. Tightest first. */
export const RINGS = [
  { maxDist: 14, points: 5 },
  { maxDist: 30, points: 3 },
  { maxDist: 55, points: 1 },
] as const;

export function scoreProbe(probe: Probe, system: StarSystem): number {
  if (probe.state !== "landed") return 0;
  let best = 0;
  for (const zone of system.zones) {
    const dx = probe.pos.x - zone.center.x;
    const dy = probe.pos.y - zone.center.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    for (const ring of RINGS) {
      if (d <= ring.maxDist) {
        if (ring.points > best) best = ring.points;
        break;
      }
    }
  }
  return best;
}

export function scoreGame(state: GameState): { total: number; perProbe: number[] } {
  const perProbe = state.probes.map((p) => scoreProbe(p, state.system));
  return { total: perProbe.reduce((sum, n) => sum + n, 0), perProbe };
}
