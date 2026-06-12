/** UTC date string — everyone worldwide plays the same board (per spec). */
export function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}
