import type { Probe, Vec2 } from "../types";

export type BodyKind = "planet" | "blocker";

/** A gravity source. Planets are landable; blockers are lethal on contact. */
export interface Body {
  pos: Vec2;
  radius: number;
  mass: number;
  kind: BodyKind;
}

/** Fly a probe through it to collect (persists for the rest of the level). */
export interface Key {
  pos: Vec2;
  radius: number;
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
}

export type Objective = { kind: "reach-goal" } | { kind: "hit-all-targets" };

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
  starThresholds: { two: number; three: number };
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
