import { MAX_SPEED, MAX_STEPS, POWER_SCALE, PROBE_RADIUS } from "../constants";
import { contacts, integrate, landOn, resolveCollisions, voidCheck } from "../physics";
import type { LaunchInput, Probe, ProbeFrame } from "../types";
import { precisionPoints } from "./scoring";
import type { CampaignLevelState, Level, SensorEvent } from "./types";

export function createLevel(level: Level): CampaignLevelState {
  return {
    level,
    probes: [],
    launchesUsed: 0,
    keysCollected: level.keys.map(() => false),
    targetsHit: level.targets.map(() => false),
    goalReached: false,
    bestPrecision: 0,
  };
}

function cloneProbe(p: Probe): Probe {
  return { pos: { ...p.pos }, vel: { ...p.vel }, state: p.state };
}

function within(probe: Probe, cx: number, cy: number, reach: number): boolean {
  const dx = probe.pos.x - cx;
  const dy = probe.pos.y - cy;
  return Math.sqrt(dx * dx + dy * dy) <= reach;
}

function distTo(probe: Probe, cx: number, cy: number): number {
  const dx = probe.pos.x - cx;
  const dy = probe.pos.y - cy;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Run one campaign launch to completion (or maxSteps). Pure: returns new state.
 * Adds blocker death and a sensor pass (keys -> targets -> goal) on top of the
 * daily physics loop. Sticky progress (keys/targets/goal) persists across launches.
 */
export function simulateCampaignLaunch(
  state: CampaignLevelState,
  input: LaunchInput,
  maxSteps: number = MAX_STEPS,
): { state: CampaignLevelState; trace: ProbeFrame[][]; events: SensorEvent[] } {
  const level = state.level;
  const len = Math.sqrt(input.dx * input.dx + input.dy * input.dy);
  const speed = Math.min(len * POWER_SCALE, MAX_SPEED);
  const probes = state.probes.map(cloneProbe);
  probes.push({
    pos: { ...level.launchPos },
    vel:
      len === 0
        ? { x: 0, y: 0 }
        : { x: (input.dx / len) * speed, y: (input.dy / len) * speed },
    state: "flying",
  });

  const keysCollected = state.keysCollected.slice();
  const targetsHit = state.targetsHit.slice();
  let goalReached = state.goalReached;
  let bestPrecision = state.bestPrecision;

  const trace: ProbeFrame[][] = [];
  const events: SensorEvent[] = [];

  for (let step = 0; step < maxSteps; step++) {
    // 1. Integrate flying probes (planets AND blockers both pull).
    for (const probe of probes) {
      if (probe.state === "flying") integrate(level.bodies, probe);
    }
    // 2. Body contact: land on planets, die on blockers.
    for (const probe of probes) {
      if (probe.state !== "flying") continue;
      for (const body of level.bodies) {
        if (!contacts(body, probe)) continue;
        if (body.kind === "blocker") probe.state = "lost";
        else landOn(body, probe);
        break;
      }
    }
    // 3. Sensors (keys -> targets -> goal). Checked for any non-lost probe so a
    //    probe that lands exactly on a goal/target still registers.
    for (const probe of probes) {
      if (probe.state === "lost") continue;
      level.keys.forEach((k, i) => {
        if (!keysCollected[i] && within(probe, k.pos.x, k.pos.y, k.radius + PROBE_RADIUS)) {
          keysCollected[i] = true;
          events.push({ step, type: "key", index: i });
        }
      });
      level.targets.forEach((t, i) => {
        if (!targetsHit[i] && within(probe, t.pos.x, t.pos.y, t.radius + PROBE_RADIUS)) {
          targetsHit[i] = true;
          bestPrecision = Math.max(bestPrecision, precisionPoints(distTo(probe, t.pos.x, t.pos.y)));
          events.push({ step, type: "target", index: i });
        }
      });
      if (level.goal && !goalReached && keysCollected.every(Boolean)) {
        if (within(probe, level.goal.pos.x, level.goal.pos.y, level.goal.radius + PROBE_RADIUS)) {
          goalReached = true;
          bestPrecision = Math.max(bestPrecision, precisionPoints(distTo(probe, level.goal.pos.x, level.goal.pos.y)));
          events.push({ step, type: "goal", index: 0 });
        }
      }
    }
    // 4. Probe-probe collisions, then void check.
    resolveCollisions(probes);
    for (const probe of probes) voidCheck(level.bounds, probe);

    trace.push(probes.map((p) => ({ x: p.pos.x, y: p.pos.y, state: p.state })));
    if (probes.every((p) => p.state !== "flying")) break;
  }
  for (const p of probes) if (p.state === "flying") p.state = "lost";

  return {
    state: {
      level,
      probes,
      launchesUsed: state.launchesUsed + 1,
      keysCollected,
      targetsHit,
      goalReached,
      bestPrecision,
    },
    trace,
    events,
  };
}
