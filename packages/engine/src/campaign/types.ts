import type { Probe, Vec2 } from "../types";

export type BodyKind = "planet" | "blocker";

/** Circular orbit driving a moving body/sensor. `cosStep`/`sinStep` are baked at
 *  authoring time (the only trig); the sim only rotates + renormalizes with them. */
export interface Orbit {
  center: Vec2;
  offset0: Vec2;
  radius: number;
  cosStep: number;
  sinStep: number;
}

/** A gravity source. Planets are landable; blockers are lethal on contact. */
export interface Body {
  pos: Vec2;
  radius: number;
  mass: number;
  kind: BodyKind;
  orbit?: Orbit;
}

/** Fly a probe through it to collect (persists for the rest of the level). */
export interface Key {
  pos: Vec2;
  radius: number;
  orbit?: Orbit;
}

/** Reach to satisfy a `reach-goal` objective (locked until keys collected). */
export interface Goal {
  pos: Vec2;
  radius: number;
}

/** Pass a probe through every target to satisfy `hit-all-targets`. */
export interface Target {
  pos: Vec2;
  radius: number;
  orbit?: Orbit;
}

export type Objective = { kind: "reach-goal" } | { kind: "hit-all-targets" };

/** One mouth of a wormhole pair. `facing` is a unit vector — the direction a probe
 *  exits going. `link` is the index of the paired portal in `Level.portals`. */
export interface Portal {
  pos: Vec2;
  radius: number;
  facing: Vec2;
  link: number;
}

export interface Level {
  id: string;
  name: string;
  bodies: Body[];
  keys: Key[];
  goal?: Goal;
  targets: Target[];
  launchPos: Vec2;
  bounds: { width: number; height: number };
  launchBudget: number;
  objectives: Objective[];
  /** Optimal known launch count. Stars: 1 = clear, 2 = clear at par,
   *  3 = par AND inner-ring precision. Provable: CI asserts each level's
   *  recorded/brute-forced solution clears within par. */
  par: number;
  portals?: Portal[];
}

export interface CampaignLevelState {
  level: Level;
  probes: Probe[];
  launchesUsed: number;
  keysCollected: boolean[];
  targetsHit: boolean[];
  goalReached: boolean;
  bestPrecision: number;
}

/** A sensor pickup during one launch, surfaced for the renderer. */
export interface SensorEvent {
  step: number;
  type: "key" | "goal" | "target";
  index: number;
}
