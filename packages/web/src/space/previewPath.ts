export interface Pt {
  x: number;
  y: number;
}

/**
 * Split a polyline into contiguous segments, breaking wherever two consecutive
 * points jump farther than `sqrt(gap2)` apart. A flying probe moves at most
 * ~MAX_SPEED*DT units per step, so any larger gap is a wormhole teleport — the
 * caller draws each segment separately so a preview/trail goes INTO one portal
 * and OUT the other instead of drawing a straight line across the map.
 */
export function pathSegments(path: readonly Pt[], gap2: number): Pt[][] {
  const segments: Pt[][] = [];
  let current: Pt[] = [];
  let prev: Pt | null = null;
  for (const p of path) {
    if (prev) {
      const dx = p.x - prev.x;
      const dy = p.y - prev.y;
      if (dx * dx + dy * dy > gap2) {
        if (current.length) segments.push(current);
        current = [];
      }
    }
    current.push(p);
    prev = p;
  }
  if (current.length) segments.push(current);
  return segments;
}
