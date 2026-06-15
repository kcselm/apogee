import { useEffect, useState } from "react";
import { prefersReducedMotion } from "./space/motion";

/** Animates from 0 to `value` over `durationMs`. Instant under reduced motion. */
export function CountUp({ value, durationMs = 700 }: { value: number; durationMs?: number }) {
  const [n, setN] = useState(() => (prefersReducedMotion() ? value : 0));

  useEffect(() => {
    if (prefersReducedMotion()) {
      setN(value);
      return;
    }
    let raf = 0;
    let startTs: number | null = null;
    const tick = (ts: number) => {
      if (startTs === null) startTs = ts;
      const t = Math.min(1, (ts - startTs) / durationMs);
      const eased = 1 - (1 - t) * (1 - t);
      setN(Math.round(value * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);

  return <>{n}</>;
}
