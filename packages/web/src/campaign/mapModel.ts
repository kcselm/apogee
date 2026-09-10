import { CHAPTERS, LEVELS, type Chapter, type Level } from "@apogee/engine";
import { isUnlocked, type CampaignProgress } from "./campaignStorage";

export const MAX_STARS = LEVELS.length * 3;

export interface Tile {
  level: Level;
  /** 1-based position in the ladder, as printed on the tile. */
  number: number;
  unlocked: boolean;
  stars: number;
}

export interface ChapterSection {
  chapter: Chapter;
  tiles: Tile[];
}

/** The map, chapter by chapter. Unlocking stays linear across the whole ladder. */
export function chapterSections(progress: CampaignProgress): ChapterSection[] {
  const ids = LEVELS.map((l) => l.id);
  return CHAPTERS.map((chapter) => ({
    chapter,
    tiles: chapter.levelIds.map((id) => {
      const index = ids.indexOf(id);
      return {
        level: LEVELS[index]!,
        number: index + 1,
        unlocked: isUnlocked(progress, ids, index),
        stars: clampStars(progress[id]?.stars),
      };
    }),
  }));
}

/** Best stars summed over every level; the HUD shows it as `★ n / MAX_STARS`. */
export function totalStars(progress: CampaignProgress): number {
  return LEVELS.reduce((sum, l) => sum + clampStars(progress[l.id]?.stars), 0);
}

function clampStars(n: number | undefined): number {
  if (n === undefined || !Number.isFinite(n)) return 0;
  return Math.min(3, Math.max(0, Math.floor(n)));
}
