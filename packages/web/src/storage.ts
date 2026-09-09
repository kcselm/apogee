import type { AppStorage } from "./safeStorage";

function key(day: string): string {
  return `apogee-best-${day}`;
}

export function loadBest(storage: Pick<Storage, "getItem">, day: string): number | null {
  const raw = storage.getItem(key(day));
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Records the score if it beats the stored best; returns the resulting best. */
export function recordScore(storage: AppStorage, day: string, score: number): number {
  const prev = loadBest(storage, day);
  const best = prev === null ? score : Math.max(prev, score);
  storage.setItem(key(day), String(best));
  return best;
}
