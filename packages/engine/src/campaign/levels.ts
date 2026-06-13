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
];
