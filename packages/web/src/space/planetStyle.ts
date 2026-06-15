import { mulberry32 } from "@apogee/engine";

export type PlanetType = "gasGiant" | "rocky" | "ice";

export interface PlanetPalette {
  core: string;
  mid: string;
  edge: string;
  halo: string; // atmosphere glow color
}

export const PLANET_PALETTES: Record<PlanetType, PlanetPalette> = {
  gasGiant: { core: "#d6b48a", mid: "#b07c54", edge: "#2c1c12", halo: "rgba(230,170,110,0.40)" },
  rocky: { core: "#8b93a6", mid: "#545d72", edge: "#262c3c", halo: "rgba(150,170,210,0.22)" },
  ice: { core: "#d8f6ff", mid: "#6fc0d8", edge: "#173b52", halo: "rgba(120,220,255,0.42)" },
};

/**
 * Deterministic planet type from world position (which is itself seed-derived
 * upstream), so the look is stable per board without touching the engine.
 */
export function planetTypeFor(pos: { x: number; y: number }, seed = 0x9e37): PlanetType {
  const key = ((Math.round(pos.x) * 73856093) ^ (Math.round(pos.y) * 19349663) ^ seed) >>> 0;
  const r = mulberry32(key)();
  return r < 0.34 ? "gasGiant" : r < 0.67 ? "rocky" : "ice";
}
