import { MAX_SPEED, MAX_STEPS, POWER_SCALE, PROBE_RADIUS } from "../constants";
import { contacts, integrate, landOn, resolveCollisions, voidCheck } from "../physics";
import type { LaunchInput, Probe, ProbeFrame, Vec2 } from "../types";
import { PORTAL_COOLDOWN, PORTAL_EXIT_MARGIN } from "./constants";
import { advanceOrbit, orbitOffsetAt } from "./orbit";
import { portalExitRotation, rotateVec } from "./portal";
import { precisionPoints } from "./scoring";
import type { CampaignLevelState, Level, Orbit, SensorEvent } from "./types";

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

/** Mutable working geometry whose position advances each step when `orbit` is set. */
interface Moving {
  pos: Vec2;
  orbit: Orbit | null;
  off: Vec2 | null;
}

function initMoving(pos: Vec2, orbit: Orbit | undefined, launchTick: number): Moving {
  if (!orbit) return { pos: { x: pos.x, y: pos.y }, orbit: null, off: null };
  const off = orbitOffsetAt(orbit, launchTick);
  return { pos: { x: orbit.center.x + off.x, y: orbit.center.y + off.y }, orbit, off };
}

function stepMoving(m: Moving): void {
  if (!m.orbit || !m.off) return;
  m.off = advanceOrbit(m.off, m.orbit);
  m.pos.x = m.orbit.center.x + m.off.x;
  m.pos.y = m.orbit.center.y + m.off.y;
}

/**
 * Run one campaign launch to completion (or maxSteps). Pure: returns new state.
 * Extends the daily physics loop with: moving bodies/sensors (orbits), blocker
 * death, a sensor pass (keys → targets → goal), and wormhole teleports. Levels
 * with no orbits and no portals reduce to the original static loop byte-for-byte.
 */
export function simulateCampaignLaunch(
  state: CampaignLevelState,
  input: LaunchInput,
  maxSteps: number = MAX_STEPS,
): { state: CampaignLevelState; trace: ProbeFrame[][]; events: SensorEvent[] } {
  const level = state.level;
  const launchTick = input.launchTick ?? 0;
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

  // Working geometry (positions advance each step when orbiting).
  const bodies = level.bodies.map((b) => ({
    kind: b.kind,
    radius: b.radius,
    mass: b.mass,
    m: initMoving(b.pos, b.orbit, launchTick),
  }));
  const gravBodies = bodies.map((b) => ({ pos: b.m.pos, radius: b.radius, mass: b.mass }));
  const keyM = level.keys.map((k) => initMoving(k.pos, k.orbit, launchTick));
  const targetM = level.targets.map((t) => initMoving(t.pos, t.orbit, launchTick));

  // Portals: precompute the entry→exit velocity rotation (pure, no trig).
  const portals = level.portals ?? [];
  const portalRot = portals.map((p) => portalExitRotation(p.facing, portals[p.link]!.facing));
  const cooldown = probes.map(() => 0);

  const trace: ProbeFrame[][] = [];
  const events: SensorEvent[] = [];

  for (let step = 0; step < maxSteps; step++) {
    // 1. Integrate flying probes over the CURRENT (possibly moved) bodies.
    for (const probe of probes) {
      if (probe.state === "flying") integrate(gravBodies, probe);
    }
    // 2. Body contact: land on planets/moons, die on blockers.
    for (const probe of probes) {
      if (probe.state !== "flying") continue;
      for (let bi = 0; bi < gravBodies.length; bi++) {
        const gb = gravBodies[bi]!;
        if (!contacts(gb, probe)) continue;
        if (bodies[bi]!.kind === "blocker") probe.state = "lost";
        else landOn(gb, probe);
        break;
      }
    }
    // 3. Sensors (keys → targets → goal), read at their current positions.
    for (const probe of probes) {
      if (probe.state === "lost") continue;
      keyM.forEach((k, i) => {
        if (!keysCollected[i] && within(probe, k.pos.x, k.pos.y, level.keys[i]!.radius + PROBE_RADIUS)) {
          keysCollected[i] = true;
          events.push({ step, type: "key", index: i });
        }
      });
      targetM.forEach((t, i) => {
        if (!targetsHit[i] && within(probe, t.pos.x, t.pos.y, level.targets[i]!.radius + PROBE_RADIUS)) {
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
    // 4. Wormholes: teleport a flying probe entering a mouth (with re-entry guard).
    if (portals.length) {
      for (let pi = 0; pi < probes.length; pi++) {
        const probe = probes[pi]!;
        if (probe.state !== "flying") continue;
        if (cooldown[pi]! > 0) {
          cooldown[pi]!--;
          continue;
        }
        for (let k = 0; k < portals.length; k++) {
          const p = portals[k]!;
          if (!within(probe, p.pos.x, p.pos.y, p.radius + PROBE_RADIUS)) continue;
          const exit = portals[p.link]!;
          const rv = rotateVec(probe.vel, portalRot[k]!.cos, portalRot[k]!.sin);
          probe.vel.x = rv.x;
          probe.vel.y = rv.y;
          probe.pos.x = exit.pos.x + exit.facing.x * (exit.radius + PROBE_RADIUS + PORTAL_EXIT_MARGIN);
          probe.pos.y = exit.pos.y + exit.facing.y * (exit.radius + PROBE_RADIUS + PORTAL_EXIT_MARGIN);
          cooldown[pi] = PORTAL_COOLDOWN;
          break;
        }
      }
    }
    // 5. Probe-probe collisions, then void check.
    resolveCollisions(probes);
    for (const probe of probes) voidCheck(level.bounds, probe);

    trace.push(probes.map((p) => ({ x: p.pos.x, y: p.pos.y, state: p.state })));
    if (probes.every((p) => p.state !== "flying")) break;

    // 6. Advance moving geometry one step for the NEXT step.
    for (const b of bodies) stepMoving(b.m);
    for (const k of keyM) stepMoving(k);
    for (const t of targetM) stepMoving(t);
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
