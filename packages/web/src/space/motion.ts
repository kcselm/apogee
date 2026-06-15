/** True when ambient motion should run (motion allowed AND tab visible). */
export function shouldAnimate(reduceMotion: boolean, hidden: boolean): boolean {
  return !reduceMotion && !hidden;
}

/** Reads the OS "reduce motion" preference. Safe in non-DOM (returns false). */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Subscribe to changes in the reduce-motion preference. Returns an unsubscribe. */
export function watchReducedMotion(cb: (reduce: boolean) => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  const handler = () => cb(mq.matches);
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
}
