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
