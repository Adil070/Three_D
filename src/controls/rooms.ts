import type { Room } from '../config/schema';
import { pointInRect } from './collision';

/**
 * Which room is the walker in?
 * 1. A room whose `bounds` contain the point wins.
 * 2. Otherwise the nearest room *without* bounds (rooms with bounds are exact, so being
 *    outside them means "not in that room").
 * Returns null when nothing matches (e.g. standing in a doorway) — callers keep the
 * previous room in that case to avoid flicker.
 */
export function roomAt(x: number, z: number, rooms: readonly Room[]): Room | null {
  let nearest: Room | null = null;
  let best = Infinity;
  for (const room of rooms) {
    if (room.bounds) {
      if (pointInRect(x, z, room.bounds)) return room;
      continue;
    }
    const d = Math.hypot(room.position[0] - x, room.position[1] - z);
    if (d < best) {
      best = d;
      nearest = room;
    }
  }
  return nearest;
}
