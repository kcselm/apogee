import { mulberry32 } from "@apogee/engine";

export interface ShootingStar {
  sx: number; // start x
  sy: number; // start y
  dx: number; // total travel x
  dy: number; // total travel y
  len: number; // tail length (px)
  progress: number; // 0..1 along travel
}

const INTERVAL = 6500; // ms between potential spawns
const DURATION = 1100; // ms a star is visible
const SPAWN_CHANCE = 0.6; // fraction of slots that actually spawn

export function activeShootingStars(
  seed: number,
  width: number,
  height: number,
  time: number,
): ShootingStar[] {
  const out: ShootingStar[] = [];
  const slot = Math.floor(time / INTERVAL);
  for (let s = slot - 1; s <= slot; s++) {
    if (s < 0) continue;
    const rng = mulberry32((seed ^ (s * 2654435761)) >>> 0);
    if (rng() > SPAWN_CHANCE) continue;
    // Spawn anywhere in the slot; a late spawn stays visible into the next
    // slot, which is why the loop also checks `slot - 1`. age<0 / age>DURATION
    // filter to the visible window, so at most one star per slot is active.
    const spawn = s * INTERVAL + rng() * INTERVAL;
    const age = time - spawn;
    if (age < 0 || age > DURATION) continue;
    const progress = age / DURATION;
    const angle = 0.25 + rng() * 0.5; // shallow downward streaks
    const travel = width * 0.5;
    out.push({
      sx: rng() * width * 0.7,
      sy: rng() * height * 0.4,
      dx: Math.cos(angle) * travel,
      dy: Math.sin(angle) * travel,
      len: 60 + rng() * 60,
      progress,
    });
  }
  return out;
}
