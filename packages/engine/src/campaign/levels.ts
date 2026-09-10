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
    // Both rings moved onto the arc that swings over the planet: the ring at
    // (1180,360) capped the level at 1.81 % clears BEFORE any key gate (2.04 %
    // even at radius 44), so no key placement could reach the teach floor. The
    // goal now sits in the planet's focus just past it, and the key is on the
    // way there, so a shot that takes the key keeps most of its chance.
    keys: [{ pos: { x: 920, y: 380 }, radius: 32 }],
    goal: { pos: { x: 1000, y: 500 }, radius: 44 }, targets: [],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 3,
    objectives: [{ kind: "reach-goal" }], par: 1,
    intro: "Keys unlock the goal. Fly through the key first; it stays collected between launches.",
  },
  {
    id: "3-2", name: "Hidden Key",
    bodies: [planet(700, 420, 84), planet(1120, 640, 70)],
    // The key moves into the corridor between the two worlds — still tucked out
    // of the straight line, but on the arc that actually reaches the ring, so a
    // detour for it costs a shot most of its chance instead of nearly all of it
    // (the old spot at (760,640) kept only 13 % of the ring-reaching shots).
    keys: [{ pos: { x: 960, y: 500 }, radius: 34 }],
    goal: { pos: { x: 1320, y: 360 }, radius: 44 }, targets: [],
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
    // Squared up above and below the planet instead of stacked in the caustic
    // to its right. In the old column every mark radius 26-30 near x=1120 was
    // bullseyed by a third to a half of the shots that reached it, so the
    // reference's first launch banked a bullseye and every clearing second
    // launch inherited 3★ (bestPrecision is a running max across launches).
    targets: [{ pos: { x: 820, y: 160 }, radius: 30 }, { pos: { x: 820, y: 880 }, radius: 30 }],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 4,
    objectives: [{ kind: "hit-all-targets" }], par: 2,
    intro: "Marks: pass a probe through every one. Landed probes stay on the board.",
  },
  {
    id: "4-2", name: "Spread",
    bodies: [planet(700, 380, 70), planet(1000, 680, 74)],
    keys: [], goal: undefined,
    // All three marks pushed out past the far worlds. Anywhere nearer, a mark
    // is touched by 1.5-3 % of the grid on its own, and three of those union to
    // well over the 2 % twist cap — 1.67 % is the lowest reachable union on this
    // layout. The top pair lines up on one arc (that is what makes par 2
    // possible); the low mark needs its own launch.
    targets: [{ pos: { x: 1400, y: 160 }, radius: 22 }, { pos: { x: 1500, y: 220 }, radius: 22 }, { pos: { x: 1500, y: 860 }, radius: 22 }],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 5,
    objectives: [{ kind: "hit-all-targets" }], par: 2,
  },
  {
    id: "4-3", name: "Guarded Marks",
    // The guard moves onto the launch line itself. Out at (720,520) it shades
    // almost nothing from the pad: the rarest mark anywhere on the board still
    // took 0.79 % of the grid, so two of them could not fit under the 0.70 %
    // test cap however small or however placed. Growing it in place does not
    // help either (radius 140/160/180/200 all leave the cheapest pair over the
    // cap); at x=260 it hides the far edge, which is where the marks now are.
    bodies: [blocker(260, 500, 64), planet(1100, 520, 78)],
    keys: [], goal: undefined,
    targets: [{ pos: { x: 1540, y: 200 }, radius: 22 }, { pos: { x: 1540, y: 780 }, radius: 22 }],
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
    // The key moves out of the slot itself and onto the channel just past it,
    // and the ring off the caustic behind the planet: on the old caustic spot
    // (1260,360) every goal radius 32-44 left 3★ at 29.7-41.2 %, and the key
    // in the slot kept only a ninth of the shots that reached the ring.
    keys: [{ pos: { x: 840, y: 420 }, radius: 36 }],
    goal: { pos: { x: 1320, y: 520 }, radius: 44 }, targets: [],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 4,
    objectives: [{ kind: "reach-goal" }], par: 1,
  },
  {
    id: "5-3", name: "Apogee",
    // The far guard comes back to the pad. With it out at (1180,380) the
    // cheapest sensor anywhere on the board was still touched by 0.67 % of the
    // grid, so a key and a mark together could not fit under the 0.70 % test
    // cap; from (220,560) it shades most of the board and the pair costs
    // 0.51 %. Key and mark ride the same high arc — that is what keeps par at
    // two — and the ring under the planet needs its own launch.
    bodies: [blocker(620, 460, 58), planet(940, 640, 78), blocker(220, 560, 54)],
    keys: [{ pos: { x: 1260, y: 100 }, radius: 26 }],
    goal: { pos: { x: 1060, y: 820 }, radius: 44 },
    targets: [{ pos: { x: 1500, y: 180 }, radius: 30 }],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 6,
    objectives: [{ kind: "hit-all-targets" }, { kind: "reach-goal" }], par: 2,
  },

  // --- Chapter 6: orbiting moons, reach the goal (16-18) ---
  {
    id: "6-1", name: "Moonrise",
    bodies: [planet(640, 500, 110), moon(640, 500, 80, 280, 0, 1)],
    // Pulled back onto the arc the moon throws, on the launch line. Radius alone
    // cannot open the teaching level up (every radius 32-44 at the old spot tops
    // out at 1.84 %), and the ring cannot go further in: this is the ONLY ring
    // the sweep found that clears the 2 % floor while still needing the moon's
    // pull — one unit wider and a moon-ablated shot reaches it.
    keys: [], goal: { pos: { x: 1220, y: 500 }, radius: 43 }, targets: [],
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
    // Slid out to the far edge, past where the counter-rotating pair still
    // funnels shots. Shrinking in place cannot reach the test cap (r32 at the
    // old spot still clears 1.00 %), and of the 1 944 rings swept out here only
    // nine are both under 0.70 % and still unreachable with the moons' pull
    // deleted; this is the roomiest of those that stays fully on the board.
    keys: [], goal: { pos: { x: 1560, y: 740 }, radius: 36 }, targets: [],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 5,
    objectives: [{ kind: "reach-goal" }], par: 1,
  },

  // --- Chapter 7: moons meet blockers/keys/targets (19-21) ---
  {
    id: "7-1", name: "Moon & Guard",
    // The moon now outweighs the planet it circles, which is what makes its pull
    // load-bearing: with the old r60 moon no ring anywhere reached the 2 % teach
    // floor while still failing the ablation twin (ceiling 1.26 %). Guard slid
    // back to 460 so the wider orbit keeps its 12-unit clearance — the moon's
    // closest approach leaves 34 units.
    bodies: [blocker(460, 500, 110), planet(900, 500, 80), moon(900, 500, 96, 200, 0, 1)],
    keys: [], goal: { pos: { x: 1250, y: 490 }, radius: 44 }, targets: [],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 5,
    objectives: [{ kind: "reach-goal" }], par: 1,
    intro: "Moons meet guards, keys, and marks. The preview is honest; watch the clock.",
  },
  {
    id: "7-2", name: "Keyed Orbit",
    bodies: [planet(820, 520, 76)],
    // The key sweeps OUTSIDE the ring: on the old 210 orbit no ring the arcs
    // could still reach after the gate stayed above 0.70 %, and every ring that
    // did sat on the key's own path, which collapses key and goal into one pass.
    // Widened to 270 with the ring pulled inside it, 18 units clear of the path.
    keys: [{ pos: { x: 820, y: 520 }, radius: 26, orbit: makeOrbit({ x: 820, y: 520 }, 270, 0, 1) }],
    goal: { pos: { x: 990, y: 590 }, radius: 32 }, targets: [],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 4,
    objectives: [{ kind: "reach-goal" }], par: 1,
  },
  {
    id: "7-3", name: "Moving Marks",
    bodies: [planet(760, 420, 70), planet(1040, 660, 72)],
    keys: [], goal: undefined,
    // Both marks GROW (a smaller disc would raise the 3★ share, which is what
    // was out of band at 72 %), the static one drops off the caustic between the
    // two worlds, and the moving one widens to a 230 orbit at two turns per
    // period so its bullseye no longer lines up with the static mark's.
    targets: [
      { pos: { x: 1000, y: 620 }, radius: 30 },
      { pos: { x: 760, y: 420 }, radius: 30, orbit: makeOrbit({ x: 760, y: 420 }, 230, 0, 2) },
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
    // Gate: the planet-and-two-guards wall makes the top-right corner ballistically
    // unreachable.
    bodies: [planet(700, 500, 96), blocker(700, 200, 140), blocker(700, 800, 140)],
    // The ring is held 52u ABOVE the exit line and 180u past the mouth, so the beam
    // out of the door arrives off-centre and fanned. On the exit line at (1520,272)
    // the door aimed itself: 97 % of clears banked a bullseye.
    keys: [], goal: { pos: { x: 1560, y: 220 }, radius: 32 }, targets: [],
    // Entry mouth off the pad line (y 380, not 500): a straight max-power shot no
    // longer falls into it, and the spread of entry angles fans the exit beam.
    portals: [makePortal(400, 380, 26, 180, 1), makePortal(1380, 272, 32, 0, 0)],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 4,
    objectives: [{ kind: "reach-goal" }], par: 1,
    intro: "Wormholes: enter one mouth, leave the other, heading the way it faces.",
  },
  {
    id: "8-2", name: "Bent Passage",
    bodies: [planet(700, 340, 150), planet(700, 660, 150)],
    // Both worlds sit below the exit line, so the beam out of the door sags as it
    // crosses the gap. The ring is lifted ABOVE that sag (y 40, not 112): only the
    // slice of the fan still climbing at x=1500 arrives, which is what took the
    // twist band from 3.73 % to 1.55 %.
    keys: [], goal: { pos: { x: 1500, y: 40 }, radius: 34 }, targets: [],
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
    // The ring is off the exit beam, 40u left and 24u short of where it used to sit
    // directly under the mouth. Mouth radius is NOT the lever here: the exit is only
    // 77u above the old ring, so the whole fan landed in it whatever the entry —
    // r22 still measured 6.97 %. Sliding the ring out of the fall line is what takes
    // it to the test band.
    keys: [], goal: { pos: { x: 1480, y: 910 }, radius: 38 }, targets: [],
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
    // Lifted 40u off the exit beam, which sags under the r200 planet: at (1552,80)
    // the ring sat on the beam's own line and 44 % of clears banked a bullseye.
    // Forgiveness is untouched (the corridor out of the mouth crosses either ring
    // at the same rate) — only the offset moves 3★.
    goal: { pos: { x: 1560, y: 40 }, radius: 36 }, targets: [],
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
    // Both exits pulled 150u back to x=1150 and neither mark left on its exit line:
    // at x=1300 each mouth stood 124u in front of its mark and the pair caught a
    // fifth of the whole grid. The extra travel fans each beam, and the marks now
    // sit off to the side of where their own beam lands.
    targets: [{ pos: { x: 1360, y: 300 }, radius: 22 }, { pos: { x: 1560, y: 900 }, radius: 30 }],
    portals: [
      makePortal(400, 400, 30, 180, 1), makePortal(1150, 368, 30, 0, 0),
      makePortal(400, 600, 30, 180, 3), makePortal(1150, 624, 30, 0, 2),
    ],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 5,
    objectives: [{ kind: "hit-all-targets" }], par: 2,
  },
  {
    id: "9-3", name: "Gauntlet Gate",
    // All-blocker gauntlet, r180 so the discs overlap and leave no threadable seam.
    bodies: [blocker(640, 180, 180), blocker(640, 500, 180), blocker(640, 820, 180)],
    // Exit pulled 200u back to x=1000 and the ring dropped onto where the beam has
    // fallen by x=1310. At the old (1200,496) the ring sat 59u in front of the mouth,
    // so every probe that came through the door landed in it and no ring ANYWHERE on
    // the board measured inside the test band; the extra 300u of travel is what lets
    // the blockers' pull fan and drop the beam.
    keys: [], goal: { pos: { x: 1310, y: 710 }, radius: 40 }, targets: [],
    portals: [makePortal(400, 380, 28, 160, 1), makePortal(1000, 496, 28, 0, 0)],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 5,
    objectives: [{ kind: "reach-goal" }], par: 1,
  },

  // --- Chapter 10: everything together (28-30) ---
  {
    id: "10-1", name: "Convergence",
    // Both mechanics are load-bearing (audit runs one twin per mechanic): the wall
    // makes the door necessary, and the FAR mark sits past the probe's coasting range
    // out of the exit, so only the moon's slingshot reaches it — that one mark is what
    // the moons-ablated twin cannot do. par 1 -> 2.
    bodies: [
      blocker(620, 170, 170), blocker(620, 500, 170), blocker(620, 830, 170),
      planet(1250, 700, 70), moon(1250, 700, 55, 190, 0, 1),
    ],
    // Both marks grown 26 -> 30 and the entry mouth 28 -> 34: the capstone was the
    // stingiest level in the chapter (1.66 %, under the teach floor). The near mark
    // is never bullseyed at all (no grid launch passes within 14u of it), so the
    // reference's first launch cannot bank precision the way 4-1's did; growing the
    // far mark is what pulls its own bullseye share off the 3★ cap.
    keys: [], goal: undefined,
    targets: [{ pos: { x: 1296, y: 432 }, radius: 30 }, { pos: { x: 1520, y: 688 }, radius: 30 }],
    portals: [makePortal(400, 420, 34, 165, 1), makePortal(1100, 440, 28, 0, 0)],
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
    // `progress` on this level IS the key's reach: the goal is locked until the key
    // is in hand, so no launch can raise progress any other way. Every pad-side
    // placement measured 2.4-5.8 % (the launch fan sprays over the whole pad side),
    // so the key moves past the wall's top corner — a lob over the guard — where
    // 1.15 % of the grid finds it.
    keys: [{ pos: { x: 920, y: 120 }, radius: 36 }],
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
    // Same union rule as 10-2, with three sensors instead of two: `progress` is the
    // key plus the mark (the goal is locked behind the key). The key goes to the
    // corner above the pad, which only a near-vertical lob at one power threads
    // (0.15 %), and the mark to the far edge above the moon (0.14 %); the ring stays
    // where it was, in the moon's throw, at 0.13 %.
    keys: [{ pos: { x: 140, y: 60 }, radius: 30 }],
    goal: { pos: { x: 1520, y: 880 }, radius: 36 },
    targets: [{ pos: { x: 1560, y: 460 }, radius: 30 }],
    portals: [makePortal(430, 380, 26, 165, 1), makePortal(1120, 440, 26, 0, 0)],
    launchPos: { ...LAUNCH }, bounds: BOUNDS, launchBudget: 7,
    objectives: [{ kind: "hit-all-targets" }, { kind: "reach-goal" }], par: 3,
  },
];
