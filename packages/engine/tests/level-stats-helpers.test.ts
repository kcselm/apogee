import { describe, expect, it } from "vitest";
import { LEVELS } from "../src/campaign/levels";
import { evaluateObjectives } from "../src/campaign/objectives";
import { createLevel, simulateCampaignLaunch } from "../src/campaign/simulate";
import {
  REF_STEP_CAP,
  TSV_HEADER,
  candidateGrid,
  levelStats,
  referenceSequence,
  roleOf,
  toTsvRow,
  verdict,
  type LevelStats,
} from "./level-stats";

// A coarse grid keeps these CI tests to a couple of seconds; the fine grid is the SOLVE tool's job.
const COARSE = { directions: 72, powers: [60, 100, 140, 180] };
const firstLight = LEVELS.find((l) => l.id === "1-1")!;
const moonrise = LEVELS.find((l) => l.id === "6-1")!;

describe("candidate grid", () => {
  it("is directions × powers on a static level, with no launch tick", () => {
    const grid = candidateGrid(firstLight, COARSE);
    expect(grid).toHaveLength(72 * 4);
    expect(grid.every((c) => c.launchTick === undefined)).toBe(true);
  });

  it("multiplies by 8 board ticks on a moving level", () => {
    const grid = candidateGrid(moonrise, COARSE);
    expect(grid).toHaveLength(72 * 4 * 8);
    expect(new Set(grid.map((c) => c.launchTick)).size).toBe(8);
  });

  it("never exceeds the 200-unit drawn cap", () => {
    for (const c of candidateGrid(firstLight)) {
      expect(Math.hypot(c.dx, c.dy)).toBeLessThanOrEqual(200.0001);
    }
  });
});

describe("reference sequence", () => {
  it("finds a clearing sequence within par on First Light and reports its playback steps", () => {
    const grid = candidateGrid(firstLight, COARSE);
    const ref = referenceSequence(firstLight, grid);
    expect(ref).not.toBeNull();
    expect(ref!.seq.length).toBeLessThanOrEqual(firstLight.par);
    let s = createLevel(firstLight);
    let steps = 0;
    for (const input of ref!.seq) {
      const res = simulateCampaignLaunch(s, input);
      steps += res.clearedAtStep !== null ? res.clearedAtStep + 1 : res.trace.length;
      s = res.state;
    }
    expect(evaluateObjectives(s).cleared).toBe(true);
    expect(ref!.steps).toBe(steps);
    expect(ref!.steps).toBeGreaterThan(0);
  });

  it("returns null when nothing on the grid clears within the depth", () => {
    const grid = candidateGrid(firstLight, { directions: 4, powers: [20] });
    expect(referenceSequence(firstLight, grid, 1)).toBeNull();
  });
});

describe("level stats", () => {
  it("measures shares in [0, 1] with progress ≥ clear1 and a positive reference", () => {
    const s = levelStats(firstLight, candidateGrid(firstLight, COARSE));
    expect(s.id).toBe("1-1");
    expect(s.role).toBe("teach");
    expect(s.clear1).toBeGreaterThan(0);
    expect(s.clear1).toBeLessThanOrEqual(s.progress);
    expect(s.progress).toBeLessThanOrEqual(1);
    expect(s.refSteps).not.toBeNull();
    expect(s.refSteps!).toBeGreaterThan(0);
    expect(s.maxSteps).toBeGreaterThanOrEqual(s.refSteps!);
    expect(s.star3).not.toBeNull();
    expect(s.star3!).toBeGreaterThanOrEqual(0);
    expect(s.star3!).toBeLessThanOrEqual(1);
  });
});

describe("roles, bands, and TSV", () => {
  it("derives the role from the id suffix", () => {
    expect(roleOf("1-1")).toBe("teach");
    expect(roleOf("4-2")).toBe("twist");
    expect(roleOf("10-3")).toBe("test");
  });

  const base: LevelStats = {
    id: "2-2", name: "Bent Path", par: 1, role: "twist",
    clear1: 0.012, progress: 0.3, star3: 0.25, refSteps: 300, maxSteps: 900, ref: [{ dx: 80, dy: -10 }],
  };

  it("reports an in-band level with no violations", () => {
    expect(verdict(base)).toEqual([]);
  });

  it("names every violated band", () => {
    const bad: LevelStats = { ...base, clear1: 0.05, star3: 0.6, refSteps: REF_STEP_CAP + 1 };
    const v = verdict(bad);
    expect(v.some((m) => m.startsWith("forgiveness above"))).toBe(true);
    expect(v.some((m) => m.startsWith("3★ above"))).toBe(true);
    expect(v.some((m) => m.startsWith("ref"))).toBe(true);
  });

  it("uses progress instead of clear1 on par-2 levels", () => {
    const par2: LevelStats = { ...base, id: "4-1", role: "teach", par: 2, clear1: 0, progress: 0.04 };
    expect(verdict(par2)).toEqual([]);
  });

  it("flags a missing reference", () => {
    expect(verdict({ ...base, refSteps: null, ref: null })).toContain("no reference within par");
  });

  it("emits one tab-separated row matching the header", () => {
    const row = toTsvRow(base);
    expect(row.split("\t")).toHaveLength(TSV_HEADER.split("\t").length);
    expect(row.startsWith("2-2\tBent Path\t1\ttwist\t1.20\t30.00\t25.00\t300\t900\t")).toBe(true);
  });
});
