import { WORLD_HEIGHT, WORLD_WIDTH } from "../constants";
import type { Level } from "./types";

const BOUNDS = { width: WORLD_WIDTH, height: WORLD_HEIGHT };
const LAUNCH = { x: 80, y: 500 };

function planet(x: number, y: number, radius: number) {
  return { pos: { x, y }, radius, mass: radius * radius, kind: "planet" as const };
}
function blocker(x: number, y: number, radius: number) {
  return { pos: { x, y }, radius, mass: radius * radius, kind: "blocker" as const };
}

/** True when a level has any orbiting body/sensor or any wormhole — i.e. it needs
 *  a timed, replayed solution rather than the static brute-force solver. */
export function isMovingLevel(level: Level): boolean {
  return (
    level.bodies.some((b) => b.orbit != null) ||
    level.keys.some((k) => k.orbit != null) ||
    level.targets.some((t) => t.orbit != null) ||
    (level.portals?.length ?? 0) > 0
  );
}

export const LEVELS: Level[] = [
  // --- Chapter 1: reach the goal, learn gravity (1-3) ---
  {
    id: "1-1", name: "First Light",
    bodies: [planet(800, 520, 80)],
    keys: [], goal: { pos: { x: 1180, y: 360 }, radius: 40 }, targets: [],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 3,
    objectives: [{ kind: "reach-goal" }], starThresholds: { two: 6, three: 11 },
  },
  {
    id: "1-2", name: "Two Worlds",
    bodies: [planet(620, 360, 64), planet(1040, 640, 72)],
    keys: [], goal: { pos: { x: 1320, y: 360 }, radius: 38 }, targets: [],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 3,
    objectives: [{ kind: "reach-goal" }], starThresholds: { two: 6, three: 11 },
  },
  {
    id: "1-3", name: "Slingshot",
    bodies: [planet(760, 500, 96)],
    keys: [], goal: { pos: { x: 700, y: 640 }, radius: 36 }, targets: [],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 4,
    objectives: [{ kind: "reach-goal" }], starThresholds: { two: 6, three: 11 },
  },

  // --- Chapter 2: blockers (4-6) ---
  {
    id: "2-1", name: "In The Way",
    bodies: [blocker(560, 500, 70), planet(1050, 520, 80)],
    keys: [], goal: { pos: { x: 1180, y: 360 }, radius: 40 }, targets: [],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 4,
    objectives: [{ kind: "reach-goal" }], starThresholds: { two: 6, three: 11 },
  },
  {
    id: "2-2", name: "Bent Path",
    bodies: [planet(640, 360, 80), blocker(980, 560, 60)],
    keys: [], goal: { pos: { x: 1300, y: 420 }, radius: 38 }, targets: [],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 4,
    objectives: [{ kind: "reach-goal" }], starThresholds: { two: 6, three: 11 },
  },
  {
    id: "2-3", name: "Threading",
    bodies: [blocker(560, 420, 56), blocker(720, 700, 56), planet(1080, 520, 84)],
    keys: [], goal: { pos: { x: 1240, y: 360 }, radius: 38 }, targets: [],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 5,
    objectives: [{ kind: "reach-goal" }], starThresholds: { two: 6, three: 11 },
  },

  // --- Chapter 3: collect a key, then reach the goal (7-9) ---
  {
    id: "3-1", name: "The Key",
    bodies: [planet(820, 520, 76)],
    keys: [{ pos: { x: 480, y: 300 }, radius: 28 }],
    goal: { pos: { x: 1180, y: 360 }, radius: 40 }, targets: [],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 3,
    objectives: [{ kind: "reach-goal" }], starThresholds: { two: 6, three: 11 },
  },
  {
    id: "3-2", name: "Hidden Key",
    bodies: [planet(700, 420, 84), planet(1120, 640, 70)],
    keys: [{ pos: { x: 760, y: 640 }, radius: 26 }],
    goal: { pos: { x: 1320, y: 360 }, radius: 38 }, targets: [],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 3,
    objectives: [{ kind: "reach-goal" }], starThresholds: { two: 6, three: 11 },
  },
  {
    id: "3-3", name: "Key & Guard",
    bodies: [blocker(620, 520, 60), planet(1040, 460, 80)],
    keys: [{ pos: { x: 520, y: 280 }, radius: 26 }],
    goal: { pos: { x: 1220, y: 620 }, radius: 38 }, targets: [],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 4,
    objectives: [{ kind: "reach-goal" }], starThresholds: { two: 6, three: 11 },
  },

  // --- Chapter 4: hit every target (10-12) ---
  {
    id: "4-1", name: "Double Tap",
    bodies: [planet(840, 520, 74)],
    keys: [], goal: undefined,
    targets: [{ pos: { x: 1120, y: 320 }, radius: 26 }, { pos: { x: 1120, y: 720 }, radius: 26 }],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 4,
    objectives: [{ kind: "hit-all-targets" }], starThresholds: { two: 6, three: 11 },
  },
  {
    id: "4-2", name: "Spread",
    bodies: [planet(700, 380, 70), planet(1000, 680, 74)],
    keys: [], goal: undefined,
    targets: [{ pos: { x: 520, y: 700 }, radius: 24 }, { pos: { x: 1280, y: 360 }, radius: 24 }, { pos: { x: 1300, y: 720 }, radius: 24 }],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 5,
    objectives: [{ kind: "hit-all-targets" }], starThresholds: { two: 6, three: 11 },
  },
  {
    id: "4-3", name: "Guarded Marks",
    bodies: [blocker(720, 520, 64), planet(1100, 520, 78)],
    keys: [], goal: undefined,
    targets: [{ pos: { x: 980, y: 300 }, radius: 24 }, { pos: { x: 980, y: 740 }, radius: 24 }],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 5,
    objectives: [{ kind: "hit-all-targets" }], starThresholds: { two: 6, three: 11 },
  },

  // --- Chapter 5: combine everything (13-15) ---
  {
    id: "5-1", name: "Key & Marks",
    bodies: [planet(820, 540, 76)],
    keys: [{ pos: { x: 460, y: 300 }, radius: 26 }],
    goal: { pos: { x: 1240, y: 360 }, radius: 38 },
    targets: [{ pos: { x: 1080, y: 720 }, radius: 24 }],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 5,
    objectives: [{ kind: "hit-all-targets" }, { kind: "reach-goal" }], starThresholds: { two: 8, three: 14 },
  },
  {
    id: "5-2", name: "Tight Squeeze",
    bodies: [blocker(560, 420, 56), blocker(700, 700, 56), planet(1080, 500, 82)],
    keys: [{ pos: { x: 520, y: 600 }, radius: 26 }],
    goal: { pos: { x: 1260, y: 360 }, radius: 36 }, targets: [],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 4,
    objectives: [{ kind: "reach-goal" }], starThresholds: { two: 6, three: 11 },
  },
  {
    id: "5-3", name: "Apogee",
    bodies: [blocker(620, 460, 58), planet(940, 640, 78), blocker(1180, 380, 54)],
    keys: [{ pos: { x: 500, y: 700 }, radius: 26 }],
    goal: { pos: { x: 1360, y: 640 }, radius: 36 },
    targets: [{ pos: { x: 900, y: 280 }, radius: 24 }],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 6,
    objectives: [{ kind: "hit-all-targets" }, { kind: "reach-goal" }], starThresholds: { two: 9, three: 15 },
  },
];
