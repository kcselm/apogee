import type { AppStorage } from "../safeStorage";

export interface LevelProgress {
  cleared: boolean;
  stars: number;
}
export type CampaignProgress = Record<string, LevelProgress>;

const KEY = "apogee-campaign-progress";

export function loadProgress(storage: Pick<Storage, "getItem">): CampaignProgress {
  const raw = storage.getItem(KEY);
  if (raw === null) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    // Corrupted/unexpected shape -> fresh progress (matches daily storage's
    // "treat corrupted values as absent" behavior). Deliberate fallback.
    if (typeof parsed !== "object" || parsed === null) return {};
    return parsed as CampaignProgress;
  } catch {
    return {};
  }
}

/** Merge a result in, keeping best stars and sticky cleared. Returns new progress. */
export function recordResult(
  storage: AppStorage,
  levelId: string,
  cleared: boolean,
  stars: number,
): CampaignProgress {
  const progress = loadProgress(storage);
  const prev = progress[levelId];
  progress[levelId] = {
    cleared: cleared || (prev?.cleared ?? false),
    stars: Math.max(stars, prev?.stars ?? 0),
  };
  storage.setItem(KEY, JSON.stringify(progress));
  return progress;
}

/** Level `index` is open if it is the first or the previous level is cleared. */
export function isUnlocked(
  progress: CampaignProgress,
  levelIds: string[],
  index: number,
): boolean {
  if (index <= 0) return true;
  const prevId = levelIds[index - 1];
  return prevId !== undefined && (progress[prevId]?.cleared ?? false);
}
