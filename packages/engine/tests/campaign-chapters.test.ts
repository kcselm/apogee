import { describe, expect, it } from "vitest";
import { CHAPTERS } from "../src/campaign/chapters";
import { LEVELS } from "../src/campaign/levels";

describe("chapters", () => {
  it("are ten chapters of three levels each, in ladder order", () => {
    expect(CHAPTERS).toHaveLength(10);
    CHAPTERS.forEach((c, i) => {
      expect(c.index).toBe(i + 1);
      expect(c.levelIds).toHaveLength(3);
      expect(c.title.length).toBeGreaterThan(0);
      expect(c.mechanic.length).toBeGreaterThan(0);
    });
  });

  it("cover every level id exactly once, in LEVELS order", () => {
    expect(CHAPTERS.flatMap((c) => c.levelIds)).toEqual(LEVELS.map((l) => l.id));
  });

  it("put each chapter's intro on its first level only", () => {
    const byId = new Map(LEVELS.map((l) => [l.id, l]));
    for (const c of CHAPTERS) {
      const [first, ...rest] = c.levelIds;
      expect(byId.get(first!)!.intro, `${c.index} first level has an intro`).toBeDefined();
      for (const id of rest) expect(byId.get(id)!.intro, `${id} carries no intro`).toBeUndefined();
    }
  });
});
