/** A chapter of the campaign ladder: three levels teaching one idea. Presentation data;
 *  the simulation never reads it. */
export interface Chapter {
  index: number;
  title: string;
  mechanic: string;
  levelIds: string[];
}

const LADDER: [title: string, mechanic: string][] = [
  ["Gravity", "reach the goal"],
  ["Blockers", "curve around what kills you"],
  ["Keys", "unlock, then land"],
  ["Marks", "hit every target"],
  ["Combined", "everything so far"],
  ["Moons", "moving gravity"],
  ["Moons & more", "timing meets guards and keys"],
  ["Wormholes", "in one mouth, out the other"],
  ["Wormholes & more", "portals with keys, marks, guards"],
  ["Capstone", "all of it"],
];

export const CHAPTERS: Chapter[] = LADDER.map(([title, mechanic], i) => ({
  index: i + 1,
  title,
  mechanic,
  levelIds: [1, 2, 3].map((n) => `${i + 1}-${n}`),
}));
