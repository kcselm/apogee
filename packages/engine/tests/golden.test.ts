import { describe, expect, it } from "vitest";
import { createDailyGame, simulateLaunch } from "../src/game";
import { scoreGame } from "../src/scoring";

/**
 * Golden replay: a fixed day + fixed inputs locked in as a snapshot.
 * Any physics/generation/scoring change that alters outcomes fails this test —
 * which is exactly what we want: such changes must be deliberate
 * (delete the snapshot and re-commit it alongside the change).
 */
const INPUTS = [
  { dx: -40, dy: 60 }, // lands in a scoring ring (score 5) — locks the scoring pipeline end-to-end
  { dx: 120, dy: 60 },
  { dx: 200, dy: 0 },
  { dx: 90, dy: -110 },
  { dx: 160, dy: 25 },
];

describe("golden replay", () => {
  it("full playthrough of 2026-06-11 matches the locked snapshot", () => {
    let game = createDailyGame("2026-06-11");
    for (const input of INPUTS) {
      game = simulateLaunch(game, input).state;
    }
    expect(game.launchesUsed).toBe(5);
    for (const p of game.probes) expect(p.state).not.toBe("flying");
    expect({ probes: game.probes, score: scoreGame(game) }).toMatchSnapshot();
  });

  it("replaying twice gives byte-identical results (determinism)", () => {
    const run = () => {
      let game = createDailyGame("2026-06-11");
      for (const input of INPUTS) game = simulateLaunch(game, input).state;
      return game;
    };
    expect(JSON.stringify(run())).toBe(JSON.stringify(run()));
  });
});
