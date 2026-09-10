import { describe, expect, it } from "vitest";
import { MAX_STARS, chapterSections, totalStars } from "../../src/campaign/mapModel";
import type { CampaignProgress } from "../../src/campaign/campaignStorage";

describe("chapter sections", () => {
  it("groups thirty numbered tiles under ten chapters in order", () => {
    const sections = chapterSections({});
    expect(sections).toHaveLength(10);
    const numbers = sections.flatMap((s) => s.tiles.map((t) => t.number));
    expect(numbers).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    expect(sections[2]!.chapter.title).toBe("Keys");
    expect(sections[2]!.tiles.map((t) => t.level.id)).toEqual(["3-1", "3-2", "3-3"]);
  });

  it("unlocks only the first tile on a fresh profile", () => {
    const tiles = chapterSections({}).flatMap((s) => s.tiles);
    expect(tiles.filter((t) => t.unlocked).map((t) => t.number)).toEqual([1]);
    expect(tiles.every((t) => t.stars === 0)).toBe(true);
  });

  it("carries best stars and unlocks the next tile after a clear", () => {
    const progress: CampaignProgress = { "1-1": { cleared: true, stars: 2 } };
    const tiles = chapterSections(progress).flatMap((s) => s.tiles);
    expect(tiles[0]!.stars).toBe(2);
    expect(tiles[1]!.unlocked).toBe(true);
    expect(tiles[2]!.unlocked).toBe(false);
  });
});

describe("total stars", () => {
  it("is 90 at most and 0 on a fresh profile", () => {
    expect(MAX_STARS).toBe(90);
    expect(totalStars({})).toBe(0);
  });

  it("sums best stars across levels, clamped to 3 each, ignoring unknown ids", () => {
    const progress: CampaignProgress = {
      "1-1": { cleared: true, stars: 3 },
      "1-2": { cleared: true, stars: 1 },
      "2-1": { cleared: false, stars: 0 },
      "9-9": { cleared: true, stars: 3 },
      "3-1": { cleared: true, stars: 7 },
    };
    expect(totalStars(progress)).toBe(7);
  });
});
