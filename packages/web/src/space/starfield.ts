import { mulberry32 } from "@apogee/engine";

export interface Star {
  x: number;
  y: number;
  r: number;
  depth: number; // parallax factor (far → near)
  phase: number; // twinkle phase offset
  twinkle: number; // twinkle amplitude 0.3..1
  tint: string;
}

export interface Starfield {
  stars: Star[];
  width: number;
  height: number;
}

/** Parallax depths, one per layer (far, mid, near). */
const DEPTHS = [0.15, 0.4, 0.8];

export function generateStarfield(
  seed: number,
  width: number,
  height: number,
  count = 180,
): Starfield {
  const rng = mulberry32(seed >>> 0);
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    const depth = DEPTHS[i % DEPTHS.length]!;
    stars.push({
      x: rng() * width,
      y: rng() * height,
      r: 0.4 + rng() * (0.6 + depth * 1.6),
      depth,
      phase: rng() * Math.PI * 2,
      twinkle: 0.3 + rng() * 0.7,
      tint: pickTint(rng()),
    });
  }
  return { stars, width, height };
}

function pickTint(t: number): string {
  if (t < 0.7) return "#ffffff";
  if (t < 0.85) return "#cfe0ff";
  if (t < 0.95) return "#ffe6c4";
  return "#ffd1e0";
}

/** Per-star brightness oscillation in (0.55, 1]. Render-only Math.sin is fine. */
export function twinkleAlpha(star: Star, timeMs: number): number {
  const v = Math.sin(timeMs * 0.001 * (0.6 + star.depth) + star.phase);
  return 1 - star.twinkle * 0.45 * (0.5 - 0.5 * v);
}

/** Screen-space offset for a layer given the current aim drag + slow ambient drift. */
export function parallax(
  depth: number,
  drag: { dx: number; dy: number } | null,
  timeMs: number,
): { x: number; y: number } {
  const dx = drag ? -drag.dx : 0;
  const dy = drag ? -drag.dy : 0;
  return {
    x: dx * depth * 0.02 + Math.sin(timeMs * 0.00005) * depth * 6,
    y: dy * depth * 0.02 + Math.cos(timeMs * 0.00004) * depth * 4,
  };
}
