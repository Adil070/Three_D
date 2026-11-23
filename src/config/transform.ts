import * as THREE from 'three';
import type { Transform, Vec3 } from './schema';

export const DEG = Math.PI / 180;

export function scaleVec3(scale: Transform['scale']): Vec3 {
  return typeof scale === 'number' ? [scale, scale, scale] : scale;
}

/** Writes a config transform (degrees, uniform-or-vector scale) onto an Object3D. */
export function applyTransform(obj: THREE.Object3D, t: Transform): void {
  obj.position.set(...t.position);
  obj.rotation.set(t.rotation[0] * DEG, t.rotation[1] * DEG, t.rotation[2] * DEG, 'XYZ');
  obj.scale.set(...scaleVec3(t.scale));
  obj.updateMatrixWorld(true);
}

const round = (n: number, digits: number) => {
  const f = 10 ** digits;
  const r = Math.round(n * f) / f;
  return Object.is(r, -0) ? 0 : r;
};

export const roundVec = <T extends number[]>(v: T, digits = 3): T =>
  v.map((n) => round(n, digits)) as T;

/** Transform in the exact shape project.json expects, rounded for pasting. */
export function serializeTransform(t: Transform): Transform {
  const s = scaleVec3(t.scale);
  const uniform = s[0] === s[1] && s[1] === s[2];
  return {
    position: roundVec(t.position, 3),
    rotation: roundVec(t.rotation, 2),
    scale: uniform ? round(s[0], 4) : roundVec(s, 4),
  };
}

/** Normalises an angle (radians) to (-PI, PI]. */
export function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

export { round };
