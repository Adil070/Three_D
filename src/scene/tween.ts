/**
 * Tiny frame-driven tween runner. <TweenDriver/> advances it from useFrame, so tweens are
 * in lock-step with rendering and pause when the tab is hidden.
 */

export type Ease = (t: number) => number;

export const easeInOutCubic: Ease = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const easeOutCubic: Ease = (t) => 1 - Math.pow(1 - t, 3);
export const easeInCubic: Ease = (t) => t * t * t;

interface ActiveTween {
  duration: number;
  elapsed: number;
  ease: Ease;
  update: (k: number) => void;
  resolve: () => void;
}

const active = new Set<ActiveTween>();

/** Runs `update(k)` with eased k in 0..1 over `duration` seconds. */
export function tween(duration: number, update: (k: number) => void, ease: Ease = easeInOutCubic) {
  return new Promise<void>((resolve) => {
    if (duration <= 0) {
      update(1);
      resolve();
      return;
    }
    update(0);
    active.add({ duration, elapsed: 0, ease, update, resolve });
  });
}

export function stepTweens(dt: number): void {
  for (const t of active) {
    t.elapsed = Math.min(t.elapsed + dt, t.duration);
    const k = t.elapsed / t.duration;
    t.update(t.ease(k));
    if (k >= 1) {
      active.delete(t);
      t.resolve();
    }
  }
}

export const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));
