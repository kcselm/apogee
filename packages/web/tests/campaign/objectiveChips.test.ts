import { LEVELS, createLevel, type CampaignLevelState } from "@apogee/engine";
import { describe, expect, it } from "vitest";
import { describeObjectives } from "../../src/campaign/objectiveChips";

/** A level state built from a real level, with objective progress overridden. */
function stateFor(levelId: string, over: Partial<CampaignLevelState> = {}): CampaignLevelState {
  const level = LEVELS.find((l) => l.id === levelId);
  if (level === undefined) throw new Error(`no level ${levelId}`);
  return { ...createLevel(level), ...over };
}

describe("objective chips", () => {
  it("shows a goal-only level as one locked-or-open goal chip", () => {
    const chips = describeObjectives(stateFor("1-1"));
    expect(chips).toEqual([{ glyph: "⊚", label: "goal", text: "open", tone: "goal", done: false }]);
  });

  it("marks the goal done once reached", () => {
    const chips = describeObjectives(stateFor("1-1", { goalReached: true }));
    expect(chips).toEqual([{ glyph: "⊚", label: "goal", text: "✓", tone: "goal", done: true }]);
  });

  it("locks the goal while a key is uncollected", () => {
    const chips = describeObjectives(stateFor("3-1", { keysCollected: [false] }));
    expect(chips).toEqual([
      { glyph: "◆", label: "key", text: "0/1", tone: "key", done: false },
      { glyph: "⊚", label: "goal", text: "locked", tone: "goal", done: false },
    ]);
  });

  it("opens the goal once every key is collected", () => {
    const chips = describeObjectives(stateFor("3-1", { keysCollected: [true] }));
    expect(chips).toEqual([
      { glyph: "◆", label: "key", text: "1/1", tone: "key", done: true },
      { glyph: "⊚", label: "goal", text: "open", tone: "goal", done: false },
    ]);
  });

  it("counts targets and marks them done when all are hit", () => {
    const partial = describeObjectives(stateFor("4-1", { targetsHit: [true, false] }));
    expect(partial).toEqual([{ glyph: "◎", label: "mark", text: "1/2", tone: "target", done: false }]);
    const all = describeObjectives(stateFor("4-1", { targetsHit: [true, true] }));
    expect(all).toEqual([{ glyph: "◎", label: "mark", text: "2/2", tone: "target", done: true }]);
  });

  it("labels each chip with the word the intro cards use for that mechanic", () => {
    const keyChip = describeObjectives(stateFor("3-1", { keysCollected: [false] }))[0]!;
    expect(keyChip.label).toBe("key");
    const markChip = describeObjectives(stateFor("4-1", { targetsHit: [false, false] }))[0]!;
    expect(markChip.label).toBe("mark");
    const goalChip = describeObjectives(stateFor("1-1"))[0]!;
    expect(goalChip.label).toBe("goal");
  });

  it("never emits more than three chips on any authored level", () => {
    for (const level of LEVELS) {
      expect(describeObjectives(createLevel(level)).length, level.id).toBeLessThanOrEqual(3);
    }
  });
});
