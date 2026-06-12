export interface Vec2 {
  x: number;
  y: number;
}

export interface Planet {
  pos: Vec2;
  radius: number;
  /** = radius * radius (set at generation). */
  mass: number;
}

/** A bullseye point on a planet's surface. */
export interface Zone {
  planetIndex: number;
  center: Vec2;
}

export interface StarSystem {
  planets: Planet[];
  zones: Zone[];
  launchPos: Vec2;
  bounds: { width: number; height: number };
}

export type ProbeState = "flying" | "landed" | "lost";

export interface Probe {
  pos: Vec2;
  vel: Vec2;
  state: ProbeState;
}

/** Raw drag vector from aiming; engine derives direction and clamped speed. */
export interface LaunchInput {
  dx: number;
  dy: number;
}

/** One probe's position+state at one sim step (for animation/preview). */
export interface ProbeFrame {
  x: number;
  y: number;
  state: ProbeState;
}

export interface GameState {
  system: StarSystem;
  probes: Probe[];
  launchesUsed: number;
}
