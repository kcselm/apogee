import { LAUNCHES_PER_DAY, MAX_SPEED, MAX_STEPS, POWER_SCALE } from "./constants";
import { generateSystem } from "./generation";
import { hashString } from "./rng";
import { stepProbes } from "./physics";
import type { GameState, LaunchInput, Probe, ProbeFrame } from "./types";

function cloneProbe(p: Probe): Probe {
  return { pos: { ...p.pos }, vel: { ...p.vel }, state: p.state };
}

/**
 * Run one launch to completion (or maxSteps). Pure: returns a new state.
 * The trace holds every probe's frame at every step, for animation/preview.
 */
export function simulateLaunch(
  state: GameState,
  input: LaunchInput,
  maxSteps: number = MAX_STEPS,
): { state: GameState; trace: ProbeFrame[][] } {
  const len = Math.sqrt(input.dx * input.dx + input.dy * input.dy);
  const speed = Math.min(len * POWER_SCALE, MAX_SPEED);
  const probes = state.probes.map(cloneProbe);
  probes.push({
    pos: { ...state.system.launchPos },
    vel: len === 0 ? { x: 0, y: 0 } : { x: (input.dx / len) * speed, y: (input.dy / len) * speed },
    state: "flying",
  });

  const trace: ProbeFrame[][] = [];
  for (let step = 0; step < maxSteps; step++) {
    stepProbes(state.system, probes);
    trace.push(probes.map((p) => ({ x: p.pos.x, y: p.pos.y, state: p.state })));
    if (probes.every((p) => p.state !== "flying")) break;
  }
  // Anything still flying after the cap is lost to deep space (spec: endless
  // flight guard). Previews pass a small maxSteps and discard the state.
  for (const p of probes) {
    if (p.state === "flying") p.state = "lost";
  }

  return {
    state: { system: state.system, probes, launchesUsed: state.launchesUsed + 1 },
    trace,
  };
}

export function createGame(seed: number): GameState {
  return { system: generateSystem(seed), probes: [], launchesUsed: 0 };
}

export function createDailyGame(dateString: string): GameState {
  return createGame(hashString(dateString));
}

export function isGameOver(state: GameState): boolean {
  return state.launchesUsed >= LAUNCHES_PER_DAY;
}
