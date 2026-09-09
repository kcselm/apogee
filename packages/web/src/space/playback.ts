/** Frames of playback kept after the step that cleared the level (0.6 s at 60 Hz). */
export const CLEAR_TAIL = 36;

/**
 * Shorten a launch trace so playback ends shortly after the level is cleared.
 * The engine still simulated the whole flight (state is unaffected); this only
 * changes what the player watches. Returns the input array itself when the
 * launch did not clear the level.
 */
export function trimToClear<T>(trace: T[], clearedAtStep: number | null, tail = CLEAR_TAIL): T[] {
  if (clearedAtStep === null) return trace;
  const end = clearedAtStep + 1 + tail;
  return end >= trace.length ? trace : trace.slice(0, end);
}

/** Fixed-rate sim clock: converts rAF wall-clock timestamps into whole sim
 *  steps at SIM_HZ, independent of display refresh rate. */
export const SIM_HZ = 60;
const STEP_MS = 1000 / SIM_HZ;
/** Cap per-frame catch-up so a stall (tab switch, GC) skips instead of
 *  fast-forwarding the board. */
export const MAX_CATCHUP_STEPS = 5;
/** Guard against float error when timestamps are exact STEP_MS multiples. */
const EPSILON = 1e-6;

export interface PlaybackClock {
  last: number | null;
}

export function createPlaybackClock(): PlaybackClock {
  return { last: null };
}

/** Whole steps owed at `nowMs`. First call anchors the clock and returns 0. */
export function advanceClock(clock: PlaybackClock, nowMs: number): number {
  if (clock.last === null) {
    clock.last = nowMs;
    return 0;
  }
  const steps = Math.floor((nowMs - clock.last) / STEP_MS + EPSILON);
  if (steps <= 0) return 0;
  if (steps > MAX_CATCHUP_STEPS) {
    clock.last = nowMs;
    return MAX_CATCHUP_STEPS;
  }
  clock.last += steps * STEP_MS;
  return steps;
}

/**
 * Advance a playback index by up to `steps` sim frames, never past the trace's
 * last frame (`len - 1`). `consumed` lists the indices advanced TO, in frame
 * order — the frames the trail should receive. 0 steps (or an index already
 * at the end) returns the same `idx` with an empty `consumed`.
 */
export function advancePlayback(idx: number, steps: number, len: number): { idx: number; consumed: number[] } {
  const consumed: number[] = [];
  let i = idx;
  for (let s = 0; s < steps && i < len - 1; s++) {
    i++;
    consumed.push(i);
  }
  return { idx: i, consumed };
}

/** The final frame index of a trace of length `len`; where skip jumps to. */
export function skipTarget(len: number): number {
  return len - 1;
}

/** Whether playback has reached (or passed) the trace's final frame. */
export function isPlaybackDone(idx: number, len: number): boolean {
  return idx >= len - 1;
}
