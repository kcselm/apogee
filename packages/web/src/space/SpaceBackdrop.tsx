import { useEffect, useRef } from "react";
import { createNebula, drawBackdrop, type NebulaCache } from "./cosmos";
import { generateStarfield, type Starfield } from "./starfield";
import { prefersReducedMotion, watchReducedMotion } from "./motion";

/** Stable seed for the shared sky ("cosmos"). */
const SEED = 0xc05705;

export function SpaceBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let nebula: NebulaCache;
    let field: Starfield;
    let reduce = prefersReducedMotion();
    let raf = 0;
    let cancelled = false;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      nebula = createNebula(width, height);
      field = generateStarfield(SEED, width, height);
    };

    const frame = (t: number) => {
      if (cancelled) return;
      drawBackdrop(ctx, {
        width,
        height,
        nebula,
        field,
        seed: SEED,
        time: t,
        drag: null,
        animate: !reduce && !document.hidden,
      });
      if (!reduce && !document.hidden) raf = requestAnimationFrame(frame);
      else raf = 0;
    };

    const start = () => {
      cancelAnimationFrame(raf);
      if (!reduce && !document.hidden) raf = requestAnimationFrame(frame);
      else frame(0); // one static paint
    };

    const onResize = () => {
      resize();
      if (!raf) frame(0);
    };
    const onVisibility = () => start();
    const unwatch = watchReducedMotion((r) => {
      reduce = r;
      start();
    });

    resize();
    start();
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      unwatch();
    };
  }, []);

  return <canvas ref={ref} className="space-backdrop" aria-hidden="true" />;
}
