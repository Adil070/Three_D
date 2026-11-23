import type { Rect2 } from '../config/schema';

/** Mutable 2D point on the floor plan (x, z). */
export interface PlanPoint {
  x: number;
  z: number;
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/**
 * Pushes a circle (centre p, radius r) out of an axis-aligned box. Returns true if it moved.
 * Pushing along the contact normal (rather than undoing the move) is what produces
 * sliding along walls.
 */
function resolveCircleBox(p: PlanPoint, r: number, b: Rect2): boolean {
  const [minX, minZ] = b.min;
  const [maxX, maxZ] = b.max;
  const cx = clamp(p.x, minX, maxX);
  const cz = clamp(p.z, minZ, maxZ);
  const dx = p.x - cx;
  const dz = p.z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return false;

  if (d2 > 1e-12) {
    const d = Math.sqrt(d2);
    const push = (r - d) / d;
    p.x += dx * push;
    p.z += dz * push;
    return true;
  }

  // Centre is inside the box: leave through the nearest face.
  const left = p.x - minX;
  const right = maxX - p.x;
  const near = p.z - minZ;
  const far = maxZ - p.z;
  const m = Math.min(left, right, near, far);
  if (m === left) p.x = minX - r;
  else if (m === right) p.x = maxX + r;
  else if (m === near) p.z = minZ - r;
  else p.z = maxZ + r;
  return true;
}

/**
 * Moves `p` by (dx, dz) in place, colliding a circle of `radius` against `boxes`.
 * Long moves are sub-stepped so fast movement cannot tunnel through thin walls.
 */
export function moveWithCollision(
  p: PlanPoint,
  dx: number,
  dz: number,
  radius: number,
  boxes: readonly Rect2[],
): PlanPoint {
  const len = Math.hypot(dx, dz);
  const steps = Math.max(1, Math.ceil(len / (radius * 0.5)));
  const sx = dx / steps;
  const sz = dz / steps;
  for (let s = 0; s < steps; s++) {
    p.x += sx;
    p.z += sz;
    // A few relaxation passes handle corners where two boxes push in different directions.
    for (let iter = 0; iter < 4; iter++) {
      let moved = false;
      for (const b of boxes) moved = resolveCircleBox(p, radius, b) || moved;
      if (!moved) break;
    }
  }
  return p;
}

export function pointInRect(x: number, z: number, r: Rect2): boolean {
  return x >= r.min[0] && x <= r.max[0] && z >= r.min[1] && z <= r.max[1];
}
