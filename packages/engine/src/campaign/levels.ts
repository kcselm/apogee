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
    // Held 20 units back off the caustic behind the planet. At x=1180 the slung
    // paths bunch so tightly that half of all clears landed a bullseye and the
    // opening level handed out 3★ automatically; a smaller ring only makes that
    // ratio worse, so the ring moves instead.
    keys: [], goal: { pos: { x: 1160, y: 360 }, radius: 40 }, targets: [],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 3,
    objectives: [{ kind: "reach-goal" }], par: 1,
    intro: "Planets pull on your probe. Bend the shot into the goal ring.",
  },
  {
    id: "1-2", name: "Two Worlds",
    bodies: [planet(620, 360, 64), planet(1040, 640, 72)],
    // Pushed further along the same outbound arc, past the point where the two
    // pulls still overlap, so the shot has to commit to one side.
    keys: [], goal: { pos: { x: 1380, y: 300 }, radius: 36 }, targets: [],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 3,
    objectives: [{ kind: "reach-goal" }], par: 1,
  },
  {
    id: "1-3", name: "Slingshot",
    // The planet sits on the launch line and is wide enough to swallow any
    // straight shot at the ring (the pad->goal segment passes 28 units inside
    // its surface), so the only way out to the far corner is around it.
    bodies: [planet(760, 500, 112)],
    keys: [], goal: { pos: { x: 1440, y: 320 }, radius: 32 }, targets: [],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 4,
    objectives: [{ kind: "reach-goal" }], par: 1,
  },

  // --- Chapter 2: blockers (4-6) ---
  {
    id: "2-1", name: "In The Way",
    bodies: [blocker(560, 500, 70), planet(1050, 520, 80)],
    keys: [], goal: { pos: { x: 1180, y: 360 }, radius: 40 }, targets: [],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 4,
    objectives: [{ kind: "reach-goal" }], par: 1,
    intro: "Red worlds pull like planets and destroy anything that touches them. Curve around.",
  },
  {
    id: "2-2", name: "Bent Path",
    bodies: [planet(640, 360, 80), blocker(980, 560, 60)],
    // Further past the blocker and a touch tighter: at (1300,420) the bent
    // paths reconverge, so nearly half of all clears were bullseyes.
    keys: [], goal: { pos: { x: 1360, y: 380 }, radius: 34 }, targets: [],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 4,
    objectives: [{ kind: "reach-goal" }], par: 1,
  },
  {
    id: "2-3", name: "Threading",
    // The corridor is the two blockers, pulled in front of the pad and squared
    // up on it: a 78-unit slot at y 461..539 instead of the old 210-unit
    // diagonal gap. Staggered further out they can simply be flown around —
    // even at radius 80 in the old spots the level bottoms out at 1.20 % clears.
    bodies: [blocker(340, 400, 56), blocker(340, 600, 56), planet(1080, 520, 84)],
    keys: [], goal: { pos: { x: 1460, y: 260 }, radius: 38 }, targets: [],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 5,
    objectives: [{ kind: "reach-goal" }], par: 1,
  },

  // --- Chapter 3: collect a key, then reach the goal (7-9) ---
  {
    id: "3-1", name: "The Key",
    bodies: [planet(820, 520, 76)],
    keys: [{ pos: { x: 480, y: 300 }, radius: 28 }],
    goal: { pos: { x: 1180, y: 360 }, radius: 40 }, targets: [],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 3,
    objectives: [{ kind: "reach-goal" }], par: 1,
    intro: "Keys unlock the goal. Fly through the key first; it stays collected between launches.",
  },
  {
    id: "3-2", name: "Hidden Key",
    bodies: [planet(700, 420, 84), planet(1120, 640, 70)],
    keys: [{ pos: { x: 760, y: 640 }, radius: 26 }],
    goal: { pos: { x: 1320, y: 360 }, radius: 38 }, targets: [],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 3,
    objectives: [{ kind: "reach-goal" }], par: 1,
  },
  {
    id: "3-3", name: "Key & Guard",
    bodies: [blocker(620, 520, 60), planet(1040, 460, 80)],
    keys: [{ pos: { x: 520, y: 280 }, radius: 26 }],
    goal: { pos: { x: 1220, y: 620 }, radius: 38 }, targets: [],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 4,
    objectives: [{ kind: "reach-goal" }], par: 1,
  },

  // --- Chapter 4: hit every target (10-12) ---
  {
    id: "4-1", name: "Double Tap",
    bodies: [planet(840, 520, 74)],
    keys: [], goal: undefined,
    targets: [{ pos: { x: 1120, y: 320 }, radius: 26 }, { pos: { x: 1120, y: 720 }, radius: 26 }],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 4,
    objectives: [{ kind: "hit-all-targets" }], par: 2,
    intro: "Marks: pass a probe through every one. Landed probes stay on the board.",
  },
  {
    id: "4-2", name: "Spread",
    bodies: [planet(700, 380, 70), planet(1000, 680, 74)],
    keys: [], goal: undefined,
    targets: [{ pos: { x: 520, y: 700 }, radius: 24 }, { pos: { x: 1280, y: 360 }, radius: 24 }, { pos: { x: 1300, y: 720 }, radius: 24 }],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 5,
    objectives: [{ kind: "hit-all-targets" }], par: 2,
  },
  {
    id: "4-3", name: "Guarded Marks",
    bodies: [blocker(720, 520, 64), planet(1100, 520, 78)],
    keys: [], goal: undefined,
    targets: [{ pos: { x: 980, y: 300 }, radius: 24 }, { pos: { x: 980, y: 740 }, radius: 24 }],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 5,
    objectives: [{ kind: "hit-all-targets" }], par: 2,
  },

  // --- Chapter 5: combine everything (13-15) ---
  {
    id: "5-1", name: "Key & Marks",
    bodies: [planet(820, 540, 76)],
    keys: [{ pos: { x: 460, y: 300 }, radius: 26 }],
    goal: { pos: { x: 1240, y: 360 }, radius: 38 },
    targets: [{ pos: { x: 1080, y: 720 }, radius: 24 }],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 5,
    objectives: [{ kind: "hit-all-targets" }, { kind: "reach-goal" }], par: 2,
    intro: "Keys, marks, and guards together. Plan the order of your launches.",
  },
  {
    id: "5-2", name: "Tight Squeeze",
    bodies: [blocker(560, 420, 56), blocker(700, 700, 56), planet(1080, 500, 82)],
    keys: [{ pos: { x: 520, y: 600 }, radius: 26 }],
    goal: { pos: { x: 1260, y: 360 }, radius: 36 }, targets: [],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 4,
    objectives: [{ kind: "reach-goal" }], par: 1,
  },
  {
    id: "5-3", name: "Apogee",
    bodies: [blocker(620, 460, 58), planet(940, 640, 78), blocker(1180, 380, 54)],
    keys: [{ pos: { x: 500, y: 700 }, radius: 26 }],
    goal: { pos: { x: 1360, y: 640 }, radius: 36 },
    targets: [{ pos: { x: 900, y: 280 }, radius: 24 }],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 6,
    objectives: [{ kind: "hit-all-targets" }, { kind: "reach-goal" }], par: 2,
  },

  // --- Chapter 6: orbiting moons, reach the goal (16-18) ---
  {
    id: "6-1", name: "Moonrise",
    bodies: [planet(640, 500, 110), moon(640, 500, 80, 280, 0, 1)],
    keys: [], goal: { pos: { x: 1296, y: 400 }, radius: 40 }, targets: [],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 4,
    objectives: [{ kind: "reach-goal" }], par: 1,
    intro: "Moons orbit on a fixed clock. Their pull moves; time your launch.",
  },
  {
    id: "6-2", name: "Slingshot Tide",
    bodies: [planet(800, 500, 130), moon(800, 500, 80, 240, 0.5, 1)],
    keys: [], goal: { pos: { x: 1520, y: 656 }, radius: 38 }, targets: [],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 4,
    objectives: [{ kind: "reach-goal" }], par: 1,
  },
  {
    id: "6-3", name: "Twin Moons",
    bodies: [planet(700, 500, 120), moon(700, 500, 60, 200, 0, 1), moon(700, 500, 60, 340, 0.5, -1)],
    keys: [], goal: { pos: { x: 1264, y: 816 }, radius: 38 }, targets: [],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 5,
    objectives: [{ kind: "reach-goal" }], par: 1,
  },

  // --- Chapter 7: moons meet blockers/keys/targets (19-21) ---
  {
    id: "7-1", name: "Moon & Guard",
    bodies: [blocker(520, 500, 110), planet(900, 500, 96), moon(900, 500, 60, 180, 0, 1)],
    keys: [], goal: { pos: { x: 1552, y: 496 }, radius: 38 }, targets: [],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 5,
    objectives: [{ kind: "reach-goal" }], par: 1,
    intro: "Moons meet guards, keys, and marks. The preview is honest; watch the clock.",
  },
  {
    id: "7-2", name: "Keyed Orbit",
    bodies: [planet(820, 520, 76)],
    keys: [{ pos: { x: 820, y: 520 }, radius: 26, orbit: makeOrbit({ x: 820, y: 520 }, 210, 0, 1) }],
    goal: { pos: { x: 1250, y: 360 }, radius: 38 }, targets: [],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 4,
    objectives: [{ kind: "reach-goal" }], par: 1,
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
    objectives: [{ kind: "hit-all-targets" }], par: 1,
  },

  // --- Chapter 8: wormholes, reach the goal (22-24) ---
  // Ch 8-10 body radii are 96-200 on purpose: a brute-force sweep of the solver's
  // 8064-input grid shows nothing smaller casts an unreachable shadow (one r<=96
  // planet leaves the whole board reachable), so a lighter wall makes the wormhole
  // optional and the ablation audit flags the level. Clearance rule (12u clearance
  // = 2 × PROBE_RADIUS + 2): keep every planet-kind disc — a moon over its whole
  // orbit — at least 12u clear of every blocker disc.
  {
    id: "8-1", name: "Through the Door",
    // Gate: the planet-and-two-guards wall makes (1520,272) ballistically unreachable.
    bodies: [planet(700, 500, 96), blocker(700, 200, 140), blocker(700, 800, 140)],
    keys: [], goal: { pos: { x: 1520, y: 272 }, radius: 40 }, targets: [],
    portals: [makePortal(400, 500, 32, 180, 1), makePortal(1380, 272, 32, 0, 0)],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 4,
    objectives: [{ kind: "reach-goal" }], par: 1,
    intro: "Wormholes: enter one mouth, leave the other, heading the way it faces.",
  },
  {
    id: "8-2", name: "Bent Passage",
    bodies: [planet(700, 340, 150), planet(700, 660, 150)],
    keys: [], goal: { pos: { x: 1488, y: 112 }, radius: 38 }, targets: [],
    // Entry mouth sits below the pad line, at (520, 800) facing 200: gravity
    // has to bend the shot down into it — it is not reachable on a straight line.
    portals: [makePortal(520, 800, 30, 200, 1), makePortal(1380, 112, 30, 0, 0)],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 4,
    objectives: [{ kind: "reach-goal" }], par: 1,
  },
  {
    id: "8-3", name: "Redirect",
    // Wall with 50u seams (12u clearance = 2 × PROBE_RADIUS + 2); the portal turns the shot ~70 deg down into the pocket.
    bodies: [blocker(700, 150, 150), planet(700, 500, 150), blocker(700, 850, 150)],
    keys: [], goal: { pos: { x: 1520, y: 944 }, radius: 38 }, targets: [],
    portals: [makePortal(420, 620, 30, 200, 1), makePortal(1520, 830, 30, 90, 0)],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 5,
    objectives: [{ kind: "reach-goal" }], par: 1,
  },

  // --- Chapter 9: wormholes meet keys/targets/blockers (25-27) ---
  {
    id: "9-1", name: "Portal Key",
    // One r200 planet instead of a wall: its field alone bends every shot short of
    // the top-right corner, so the door is the only way there. Do not shrink it.
    bodies: [planet(700, 500, 200)],
    keys: [{ pos: { x: 280, y: 590 }, radius: 26 }],
    goal: { pos: { x: 1552, y: 80 }, radius: 36 }, targets: [],
    portals: [makePortal(430, 640, 30, 200, 1), makePortal(1440, 80, 30, 0, 0)],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 5,
    objectives: [{ kind: "reach-goal" }], par: 1,
    intro: "Wormholes with keys, marks, and guards. The exit direction is the puzzle.",
  },
  {
    id: "9-2", name: "Split Marks",
    // All-blocker wall (12u clearance = 2 × PROBE_RADIUS + 2: a planet before an
    // overlapping blocker lets probes land alive inside red); the lone planet is a
    // pad-side world to bend off. One door per mark; both marks sit in the wall's
    // shadow.
    bodies: [blocker(760, 170, 170), blocker(760, 500, 170), blocker(760, 830, 170), planet(400, 850, 90)],
    keys: [], goal: undefined,
    targets: [{ pos: { x: 1424, y: 368 }, radius: 26 }, { pos: { x: 1424, y: 624 }, radius: 26 }],
    portals: [
      makePortal(400, 400, 30, 180, 1), makePortal(1300, 368, 30, 0, 0),
      makePortal(400, 600, 30, 180, 3), makePortal(1300, 624, 30, 0, 2),
    ],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 5,
    objectives: [{ kind: "hit-all-targets" }], par: 2,
  },
  {
    id: "9-3", name: "Gauntlet Gate",
    // All-blocker gauntlet, r180 so the discs overlap and leave no threadable seam.
    bodies: [blocker(640, 180, 180), blocker(640, 500, 180), blocker(640, 820, 180)],
    keys: [], goal: { pos: { x: 1296, y: 496 }, radius: 36 }, targets: [],
    portals: [makePortal(400, 380, 28, 160, 1), makePortal(1200, 496, 28, 0, 0)],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 5,
    objectives: [{ kind: "reach-goal" }], par: 1,
  },

  // --- Chapter 10: everything together (28-30) ---
  {
    id: "10-1", name: "Convergence",
    // Both mechanics are load-bearing (audit runs one twin per mechanic): the wall
    // makes the door necessary, and both marks sit past the probe's coasting range
    // out of the exit, so only the moon's slingshot reaches them. par 1 -> 2.
    bodies: [
      blocker(620, 170, 170), blocker(620, 500, 170), blocker(620, 830, 170),
      planet(1250, 700, 70), moon(1250, 700, 55, 190, 0, 1),
    ],
    keys: [], goal: undefined,
    targets: [{ pos: { x: 1296, y: 432 }, radius: 26 }, { pos: { x: 1520, y: 688 }, radius: 26 }],
    portals: [makePortal(400, 420, 28, 165, 1), makePortal(1100, 440, 28, 0, 0)],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 6,
    objectives: [{ kind: "hit-all-targets" }], par: 2,
    intro: "Capstone. Moons, wormholes, and everything before them.",
  },
  {
    id: "10-2", name: "Clockwork Lock",
    // Same twin rule: the goal is out of static range of the exit mouth, so the moon
    // has to be caught on the right side of its orbit to fling the probe there. par 1 -> 2.
    bodies: [
      blocker(700, 170, 170), blocker(700, 500, 170), blocker(700, 830, 170),
      planet(1300, 300, 70), moon(1300, 300, 55, 190, 0, 1),
    ],
    keys: [{ pos: { x: 380, y: 300 }, radius: 26 }],
    goal: { pos: { x: 1488, y: 80 }, radius: 36 }, targets: [],
    portals: [makePortal(420, 620, 28, 195, 1), makePortal(1150, 560, 28, 0, 0)],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 6,
    objectives: [{ kind: "reach-goal" }], par: 2,
  },
  {
    id: "10-3", name: "Event Horizon",
    // The works, and both twins pass: wall + door for the mark, moon slingshot for the
    // goal in the bottom-right. par 2 -> 3.
    bodies: [
      blocker(660, 170, 170), blocker(660, 500, 170), blocker(660, 830, 170),
      planet(1280, 720, 80), moon(1280, 720, 60, 190, 0, -1),
    ],
    keys: [{ pos: { x: 300, y: 200 }, radius: 26 }],
    goal: { pos: { x: 1520, y: 880 }, radius: 36 },
    targets: [{ pos: { x: 1296, y: 432 }, radius: 24 }],
    portals: [makePortal(430, 380, 26, 165, 1), makePortal(1120, 440, 26, 0, 0)],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 7,
    objectives: [{ kind: "hit-all-targets" }, { kind: "reach-goal" }], par: 3,
  },
];
