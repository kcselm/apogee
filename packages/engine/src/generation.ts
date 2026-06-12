import { WORLD_HEIGHT, WORLD_WIDTH } from "./constants";
import { mulberry32 } from "./rng";
import type { Planet, StarSystem, Vec2, Zone } from "./types";

const LAUNCH_POS: Vec2 = { x: 80, y: 500 };
const ZONE_COUNT = 3;
const PLANET_GAP = 180;
const LAUNCH_CLEARANCE = 150;

/** Random unit vector WITHOUT trig (determinism): rejection-sample the disc. */
function randUnitVec(rng: () => number): Vec2 {
  for (;;) {
    const x = rng() * 2 - 1;
    const y = rng() * 2 - 1;
    const d2 = x * x + y * y;
    if (d2 >= 0.01 && d2 <= 1) {
      const d = Math.sqrt(d2);
      return { x: x / d, y: y / d };
    }
  }
}

function isValidLayout(planets: Planet[]): boolean {
  for (let i = 0; i < planets.length; i++) {
    const a = planets[i]!;
    if (
      a.pos.x - a.radius <= 0 ||
      a.pos.x + a.radius >= WORLD_WIDTH ||
      a.pos.y - a.radius <= 0 ||
      a.pos.y + a.radius >= WORLD_HEIGHT
    ) {
      return false;
    }
    const lx = LAUNCH_POS.x - a.pos.x;
    const ly = LAUNCH_POS.y - a.pos.y;
    if (Math.sqrt(lx * lx + ly * ly) < a.radius + LAUNCH_CLEARANCE) return false;
    for (let j = i + 1; j < planets.length; j++) {
      const b = planets[j]!;
      const dx = a.pos.x - b.pos.x;
      const dy = a.pos.y - b.pos.y;
      if (Math.sqrt(dx * dx + dy * dy) < a.radius + b.radius + PLANET_GAP) return false;
    }
  }
  return true;
}

/** Deterministic daily system. Re-rolls from derived seeds until valid. */
export function generateSystem(seed: number): StarSystem {
  for (let attempt = 0; ; attempt++) {
    const rng = mulberry32((seed + attempt * 0x9e3779b9) >>> 0);
    const planetCount = 2 + Math.floor(rng() * 2); // 2 or 3
    const planets: Planet[] = [];
    for (let i = 0; i < planetCount; i++) {
      const radius = 40 + rng() * 50;
      planets.push({
        pos: {
          x: 300 + rng() * (WORLD_WIDTH - 500),
          y: 150 + rng() * (WORLD_HEIGHT - 300),
        },
        radius,
        mass: radius * radius,
      });
    }
    if (!isValidLayout(planets)) continue;

    const zones: Zone[] = [];
    for (let i = 0; i < ZONE_COUNT; i++) {
      const planetIndex = Math.floor(rng() * planets.length);
      const planet = planets[planetIndex]!;
      const dir = randUnitVec(rng);
      zones.push({
        planetIndex,
        center: {
          x: planet.pos.x + dir.x * planet.radius,
          y: planet.pos.y + dir.y * planet.radius,
        },
      });
    }

    return {
      planets,
      zones,
      launchPos: { ...LAUNCH_POS },
      bounds: { width: WORLD_WIDTH, height: WORLD_HEIGHT },
    };
  }
}
