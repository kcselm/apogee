/** Fixed simulation timestep (seconds). Frame rate must never affect physics. */
export const DT = 1 / 60;
/** Gravitational constant, tuned for feel with mass = radius^2. */
export const GRAVITY = 5000;
export const PROBE_RADIUS = 5;
/** Launch speed cap (world units / s). */
export const MAX_SPEED = 600;
/** Drag-vector length to launch-speed multiplier. */
export const POWER_SCALE = 3;
/** Max sim steps per launch (~45s); anything still flying after is lost. */
export const MAX_STEPS = 2700;
/** Steps shown in the aiming preview (~1.5s of flight). */
export const PREVIEW_STEPS = 90;
export const LAUNCHES_PER_DAY = 5;
export const WORLD_WIDTH = 1600;
export const WORLD_HEIGHT = 1000;
/** How far beyond bounds a probe may fly before it counts as lost. */
export const VOID_MARGIN = 200;
