"use client";

import * as React from "react";

/**
 * Animates a price toward its new value so a change reads as a recalculation
 * rather than a swap. Functional, not decorative: it is short, it never delays
 * the real value being available, and it is skipped entirely for anyone who
 * asked for reduced motion or on the very first render (so the page never
 * animates up from zero on load).
 */
export function useCountUp(target: number, durationMs = 200): number {
  const [value, setValue] = React.useState(target);
  const fromRef = React.useRef(target);
  const frameRef = React.useRef<number | null>(null);
  const isFirstRender = React.useRef(true);

  React.useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      fromRef.current = target;
      setValue(target);
      return;
    }

    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced || durationMs <= 0) {
      fromRef.current = target;
      setValue(target);
      return;
    }

    const from = fromRef.current;
    const delta = target - from;
    if (delta === 0) return;

    const start = performance.now();

    const step = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1);
      // easeOutCubic — fast to settle, no overshoot.
      const eased = 1 - (1 - progress) ** 3;
      const next = Math.round(from + delta * eased);
      setValue(next);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = target;
      }
    };

    frameRef.current = requestAnimationFrame(step);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      // Whatever happens, the committed value is the real one.
      fromRef.current = target;
    };
  }, [target, durationMs]);

  return value;
}
