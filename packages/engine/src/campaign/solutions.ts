import type { LaunchInput } from "../types";

/**
 * Known-good clearing input sequences (≥1★) for moving/portal levels, keyed by
 * level id. Filled by running the discovery tool:
 *   $env:SOLVE=1; pnpm --filter @apogee/engine exec vitest run discover-solutions
 * then pasting the printed sequences here. CI only REPLAYS these.
 */
export const SOLUTIONS: Record<string, LaunchInput[]> = {};
