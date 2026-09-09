import type { Level } from "@apogee/engine";
import type { AppStorage } from "../safeStorage";

const KEY = "apogee-intro-seen";

/**
 * Level ids whose intro card the player has dismissed. Corrupted or non-array
 * payloads read as empty (as campaignStorage.loadProgress does for its own
 * shape), and any non-string entries in an otherwise-valid array are dropped.
 */
export function loadSeen(storage: Pick<Storage, "getItem">): string[] {
  const raw = storage.getItem(KEY);
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string");
  } catch {
    return [];
  }
}

/** Record that this level's intro has been shown. Returns the new list. */
export function markSeen(storage: AppStorage, levelId: string): string[] {
  const seen = loadSeen(storage);
  if (!seen.includes(levelId)) seen.push(levelId);
  storage.setItem(KEY, JSON.stringify(seen));
  return seen;
}

/** The intro to show on opening this level, or null if it has none or was seen. */
export function introToShow(level: Pick<Level, "id" | "intro">, seen: string[]): string | null {
  if (level.intro === undefined) return null;
  return seen.includes(level.id) ? null : level.intro;
}
