import { WORLD_HEIGHT, WORLD_WIDTH } from "../constants";
import { makeOrbit } from "./orbit";
import { makePortal } from "./portal";
import type { Body, Level } from "./types";

const BOUNDS = { width: WORLD_WIDTH, height: WORLD_HEIGHT };
const LAUNCH = { x: 80, y: 500 };

function planet(x: number, y: number, radius: number) {
  return { pos: { x, y }, radius, mass: radius * radius, kind: "planet" as const };
}
function blocker(x: number, y: number, radius: number) {
  return { pos: { x, y }, radius, mass: radius * radius, kind: "blocker" as const };
}

/** A planet-kind body that orbits `(cx,cy)` — landable, gravitating, and moving. */
function moon(
  cx: number, cy: number, radius: number,
  orbitRadius: number, phaseTurns: number, turnsPerPeriod: number,
): Body {
  return {
    pos: { x: cx, y: cy },
    radius,
    mass: radius * radius,
    kind: "planet",
    orbit: makeOrbit({ x: cx, y: cy }, orbitRadius, phaseTurns, turnsPerPeriod),
  };
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

  // --- Chapter 6: orbiting moons, reach the goal (16-18) ---
  {
    id: "6-1", name: "Moonrise",
    bodies: [planet(800, 520, 70), moon(800, 520, 34, 200, 0, 1)],
    keys: [], goal: { pos: { x: 1250, y: 360 }, radius: 40 }, targets: [],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 4,
    objectives: [{ kind: "reach-goal" }], starThresholds: { two: 6, three: 11 },
  },
  {
    id: "6-2", name: "Slingshot Tide",
    bodies: [planet(760, 500, 80), moon(760, 500, 30, 190, 0.5, 1)],
    keys: [], goal: { pos: { x: 700, y: 720 }, radius: 38 }, targets: [],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 4,
    objectives: [{ kind: "reach-goal" }], starThresholds: { two: 6, three: 11 },
  },
  {
    id: "6-3", name: "Twin Moons",
    bodies: [planet(820, 500, 64), moon(820, 500, 28, 160, 0, 1), moon(820, 500, 28, 160, 0.5, -1)],
    keys: [], goal: { pos: { x: 1300, y: 520 }, radius: 38 }, targets: [],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 5,
    objectives: [{ kind: "reach-goal" }], starThresholds: { two: 6, three: 11 },
  },

  // --- Chapter 7: moons meet blockers/keys/targets (19-21) ---
  {
    id: "7-1", name: "Moon & Guard",
    bodies: [blocker(560, 500, 60), planet(1050, 520, 76), moon(1050, 520, 30, 170, 0, 1)],
    keys: [], goal: { pos: { x: 1230, y: 360 }, radius: 40 }, targets: [],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 5,
    objectives: [{ kind: "reach-goal" }], starThresholds: { two: 6, three: 11 },
  },
  {
    id: "7-2", name: "Keyed Orbit",
    bodies: [planet(820, 520, 76)],
    keys: [{ pos: { x: 820, y: 520 }, radius: 26, orbit: makeOrbit({ x: 820, y: 520 }, 210, 0, 1) }],
    goal: { pos: { x: 1250, y: 360 }, radius: 38 }, targets: [],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 4,
    objectives: [{ kind: "reach-goal" }], starThresholds: { two: 6, three: 11 },
  },
  {
    id: "7-3", name: "Moving Marks",
    bodies: [planet(760, 420, 70), planet(1040, 660, 72)],
    keys: [], goal: undefined,
    targets: [
      { pos: { x: 1220, y: 360 }, radius: 26 },
      { pos: { x: 760, y: 420 }, radius: 24, orbit: makeOrbit({ x: 760, y: 420 }, 170, 0, 1) },
    ],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 5,
    objectives: [{ kind: "hit-all-targets" }], starThresholds: { two: 6, three: 11 },
  },

  // --- Chapter 8: wormholes, reach the goal (22-24) ---
  {
    id: "8-1", name: "Through the Door",
    bodies: [planet(820, 700, 64)],
    keys: [], goal: { pos: { x: 1360, y: 300 }, radius: 40 }, targets: [],
    portals: [makePortal(520, 470, 32, 200, 1), makePortal(1150, 360, 32, 340, 0)],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 4,
    objectives: [{ kind: "reach-goal" }], starThresholds: { two: 6, three: 11 },
  },
  {
    id: "8-2", name: "Bent Passage",
    bodies: [planet(640, 360, 80), planet(1080, 640, 72)],
    keys: [], goal: { pos: { x: 1360, y: 640 }, radius: 38 }, targets: [],
    portals: [makePortal(760, 560, 30, 160, 1), makePortal(1200, 420, 30, 20, 0)],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 4,
    objectives: [{ kind: "reach-goal" }], starThresholds: { two: 6, three: 11 },
  },
  {
    id: "8-3", name: "Redirect",
    bodies: [blocker(900, 500, 64)],
    keys: [], goal: { pos: { x: 1150, y: 720 }, radius: 40 }, targets: [],
    portals: [makePortal(560, 560, 30, 120, 1), makePortal(1150, 260, 30, 90, 0)],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 5,
    objectives: [{ kind: "reach-goal" }], starThresholds: { two: 6, three: 11 },
  },
];
