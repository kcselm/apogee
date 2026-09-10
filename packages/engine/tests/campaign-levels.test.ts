import { describe, expect, it } from "vitest";
import { LEVELS, isMovingLevel } from "../src/campaign/levels";
import { evaluateObjectives } from "../src/campaign/objectives";
import { createLevel, simulateCampaignLaunch } from "../src/campaign/simulate";
import { SOLUTIONS } from "../src/campaign/solutions";
import { PROBE_RADIUS } from "../src/constants";
import type { Orbit } from "../src/campaign/types";
import type { Vec2 } from "../src/types";

describe("authored levels", () => {
  it("every level has a unique id", () => {
    const ids = LEVELS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("exactly the ten chapter-opening levels carry an intro of at most 90 characters", () => {
    const withIntro = LEVELS.filter((l) => l.intro !== undefined).map((l) => l.id);
    expect(withIntro).toEqual(["1-1", "2-1", "3-1", "4-1", "5-1", "6-1", "7-1", "8-1", "9-1", "10-1"]);
    for (const lvl of LEVELS) {
      if (lvl.intro === undefined) continue;
      expect(lvl.intro.length, lvl.id).toBeLessThanOrEqual(90);
      expect(lvl.intro.trim(), lvl.id).toBe(lvl.intro);
    }
  });

  it("every level declares at least one objective with the data it needs", () => {
    for (const lvl of LEVELS) {
      expect(lvl.objectives.length).toBeGreaterThan(0);
      for (const o of lvl.objectives) {
        if (o.kind === "reach-goal") expect(lvl.goal, lvl.id).toBeDefined();
        if (o.kind === "hit-all-targets") expect(lvl.targets.length, lvl.id).toBeGreaterThan(0);
      }
    }
  });

  it("every portal links to a valid, mutually-paired portal", () => {
    for (const lvl of LEVELS) {
      const ps = lvl.portals ?? [];
      ps.forEach((p, i) => {
        expect(p.link, `${lvl.id} portal ${i} link`).toBeGreaterThanOrEqual(0);
        expect(p.link, `${lvl.id} portal ${i} link`).toBeLessThan(ps.length);
        expect(ps[p.link]!.link, `${lvl.id} portal ${i} pairing`).toBe(i);
        expect(p.link, `${lvl.id} portal ${i} self-link`).not.toBe(i);
      });
    }
  });

  it("every level has a stored reference that clears within budget and par", () => {
    for (const lvl of LEVELS) {
      const seq = SOLUTIONS[lvl.id];
      expect(seq, `no reference for ${lvl.id} — run SOLVE=1 level-stats and paste its ref input`).toBeDefined();
      expect(seq!.length, `${lvl.id} reference exceeds budget`).toBeLessThanOrEqual(lvl.launchBudget);
      expect(seq!.length, `${lvl.id} par is aspirational`).toBeLessThanOrEqual(lvl.par);
      if (!isMovingLevel(lvl)) {
        expect(seq!.every((i) => i.launchTick === undefined), `${lvl.id} is static; drop launchTick`).toBe(true);
      }
      let s = createLevel(lvl);
      for (const input of seq!) s = simulateCampaignLaunch(s, input).state;
      expect(evaluateObjectives(s).cleared, `reference for ${lvl.id} no longer clears`).toBe(true);
    }
  });

  it("no sensor zone reaches into a body's surface, over every orbit", () => {
    // A sensor whose trigger zone (radius + PROBE_RADIUS) reaches a body's surface
    // is drawn over the body and can never take a bullseye. Orbiting things are
    // checked at their closest possible approach (centre distance minus orbit radii).
    // Closest the two centres ever come, as circles (a radius-0 "circle" is a static
    // point). Separated: d - ra - rb. Nested — one path entirely inside the other,
    // e.g. a mark orbiting concentrically around its planet — |ra - rb| - d. Dropping
    // the nested term reads a concentric orbit (d = 0) as passing through the centre.
    const closest = (a: { pos: Vec2; orbit?: Orbit }, b: { pos: Vec2; orbit?: Orbit }): number => {
      const ca = a.orbit ? a.orbit.center : a.pos;
      const cb = b.orbit ? b.orbit.center : b.pos;
      const d = Math.hypot(ca.x - cb.x, ca.y - cb.y);
      const ra = a.orbit?.radius ?? 0;
      const rb = b.orbit?.radius ?? 0;
      return Math.max(0, d - ra - rb, Math.abs(ra - rb) - d);
    };
    for (const lvl of LEVELS) {
      const sensors = [
        ...lvl.keys.map((k, i) => ({ what: `key ${i}`, pos: k.pos, radius: k.radius, orbit: k.orbit })),
        ...lvl.targets.map((t, i) => ({ what: `target ${i}`, pos: t.pos, radius: t.radius, orbit: t.orbit })),
        ...(lvl.goal ? [{ what: "goal", pos: lvl.goal.pos, radius: lvl.goal.radius, orbit: undefined }] : []),
        ...(lvl.portals ?? []).map((p, i) => ({ what: `portal ${i}`, pos: p.pos, radius: p.radius, orbit: undefined })),
      ];
      for (const s of sensors) {
        for (const [bi, b] of lvl.bodies.entries()) {
          const gap = closest(s, b) - b.radius - (s.radius + PROBE_RADIUS);
          expect(gap, `${lvl.id} ${s.what} reaches ${(-gap).toFixed(1)}u into body ${bi} (${b.kind} r${b.radius})`).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it("no reference is stored for an id that is not a level", () => {
    const ids = new Set(LEVELS.map((l) => l.id));
    for (const id of Object.keys(SOLUTIONS)) expect(ids.has(id), `stale SOLUTIONS entry ${id}`).toBe(true);
  });
});
