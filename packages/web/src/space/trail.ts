export interface TrailPoint {
  x: number;
  y: number;
}

export interface Trail {
  points: TrailPoint[];
  cap: number;
}

export function createTrail(cap = 18): Trail {
  return { points: [], cap };
}

export function pushTrail(t: Trail, x: number, y: number): void {
  t.points.push({ x, y });
  if (t.points.length > t.cap) t.points.shift();
}

export function clearTrail(t: Trail): void {
  t.points.length = 0;
}
