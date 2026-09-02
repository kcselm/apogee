/** A short-lived expanding ring drawn where a probe lands or is lost. */
export interface Burst {
  x: number;
  y: number;
  start: number; // ms (loop time) when the burst began
  kind: "land" | "lost" | "clear";
}

/** Burst lifetime in ms. */
export const BURST_LIFE = 600;

/** Drop bursts older than `life`. */
export function pruneBursts(list: Burst[], time: number, life = BURST_LIFE): Burst[] {
  return list.filter((b) => time - b.start < life);
}

/** 0 at spawn → 1 at end of life (clamped). */
export function burstProgress(b: Burst, time: number, life = BURST_LIFE): number {
  const p = (time - b.start) / life;
  return p < 0 ? 0 : p > 1 ? 1 : p;
}
