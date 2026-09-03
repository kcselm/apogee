import type { CampaignLevelState } from "@apogee/engine";

/** One HUD objective, as a glyph plus a short count or word. */
export interface Chip {
  glyph: "◆" | "◎" | "⊚";
  text: string;
  tone: "key" | "target" | "goal";
  done: boolean;
}

/**
 * The level's objectives as chips, in the order a player works them: keys
 * unlock the goal, marks are independent, the goal is last. Replaces the older
 * prose string ("keys 0/1 · goal locked"), which no longer fits a phone row.
 */
export function describeObjectives(state: CampaignLevelState): Chip[] {
  const chips: Chip[] = [];
  const { level } = state;

  if (level.keys.length > 0) {
    const got = state.keysCollected.filter(Boolean).length;
    chips.push({
      glyph: "◆",
      text: `${got}/${level.keys.length}`,
      tone: "key",
      done: got === level.keys.length,
    });
  }
  if (level.targets.length > 0) {
    const hit = state.targetsHit.filter(Boolean).length;
    chips.push({
      glyph: "◎",
      text: `${hit}/${level.targets.length}`,
      tone: "target",
      done: hit === level.targets.length,
    });
  }
  if (level.objectives.some((o) => o.kind === "reach-goal")) {
    const open = state.keysCollected.every(Boolean);
    chips.push({
      glyph: "⊚",
      text: state.goalReached ? "✓" : open ? "open" : "locked",
      tone: "goal",
      done: state.goalReached,
    });
  }
  return chips;
}
