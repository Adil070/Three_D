import { z } from 'zod';

/**
 * project.json schema.
 *
 * Coordinate conventions (used everywhere in the app):
 * - Metres, right-handed, Y up (three.js default).
 * - Rotations in config are Euler angles in DEGREES, order XYZ.
 * - Yaw is in DEGREES around +Y. yaw = 0 looks toward -Z; positive yaw turns left
 *   (counter-clockwise seen from above), i.e. it is `camera.rotation.y`.
 * - Floor-plan points (spawn, rooms, collision boxes) are 2D `[x, z]` pairs because the
 *   walker's eye height is always derived from `floorHeight` + 1.6 m.
 *
 * Asset paths are relative to the project folder: /public/projects/<projectId>/.
 */

const finite = () => z.number().refine(Number.isFinite, 'must be a finite number');

export const Vec3Schema = z.tuple([finite(), finite(), finite()]);
export const Vec2Schema = z.tuple([finite(), finite()]);

export const TransformSchema = z.object({
  position: Vec3Schema.default([0, 0, 0]),
  /** Euler XYZ, degrees. */
  rotation: Vec3Schema.default([0, 0, 0]),
  /** Uniform scale (number) or per-axis [x, y, z]. */
  scale: z.union([z.number().positive(), Vec3Schema]).default(1),
});

const assetPath = z
  .string()
  .min(1)
  .refine((p) => !p.includes('..') && !/^[a-z]+:/i.test(p), {
    message: 'must be a relative path inside the project folder',
  });

export const HotspotSchema = z.object({
  unitId: z.string().min(1),
  position: Vec3Schema,
  label: z.string().min(1),
});

export const ExteriorCameraSchema = z.object({
  position: Vec3Schema,
  target: Vec3Schema,
  minDistance: z.number().positive().default(6),
  maxDistance: z.number().positive().default(80),
  /** Degrees from straight up (0) to straight down (180). */
  minPolarAngle: z.number().min(0).max(180).default(15),
  maxPolarAngle: z.number().min(0).max(180).default(85),
});

export const ExteriorSchema = z.object({
  splat: assetPath,
  transform: TransformSchema.default({ position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 }),
  camera: ExteriorCameraSchema,
  hotspots: z.array(HotspotSchema).default([]),
});

export const Rect2Schema = z
  .object({ min: Vec2Schema, max: Vec2Schema })
  .refine((b) => b.min[0] < b.max[0] && b.min[1] < b.max[1], {
    message: 'min must be smaller than max on both x and z',
  });

export const RoomSchema = z.object({
  name: z.string().min(1),
  /** Camera position on the floor plan, [x, z]. */
  position: Vec2Schema,
  yaw: finite().default(0),
  /**
   * Optional room footprint. Used to show the current room name. Rooms without bounds
   * fall back to "nearest room position".
   */
  bounds: Rect2Schema.optional(),
});

export const InteriorSchema = z.object({
  splat: assetPath,
  transform: TransformSchema.default({ position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 }),
  /** Y of the walkable floor in interior space. Eye height = floorHeight + 1.6. */
  floorHeight: finite().default(0),
  /** Wall height used for the placeholder and debug wireframes. */
  ceilingHeight: z.number().positive().default(2.7),
  spawn: z.object({ position: Vec2Schema, yaw: finite().default(0) }),
  rooms: z.array(RoomSchema).default([]),
  /** Axis-aligned walls/furniture the walker cannot pass through. */
  collision: z.array(Rect2Schema).default([]),
});

export const UnitStatusSchema = z.enum(['available', 'sold', 'on-hold']);

export const UnitSchema = z.object({
  id: z
    .string()
    .min(1)
    .regex(/^[a-z0-9_-]+$/i, 'use letters, numbers, - and _ only'),
  name: z.string().min(1),
  type: z.string().min(1),
  areaSqFt: z.number().positive(),
  floor: z.number().int(),
  status: UnitStatusSchema,
  interior: InteriorSchema,
});

export const ProjectFileSchema = z
  .object({
    project: z.object({
      name: z.string().min(1),
      location: z.string().default(''),
      description: z.string().default(''),
    }),
    exterior: ExteriorSchema,
    units: z.array(UnitSchema).min(1),
  })
  .superRefine((cfg, ctx) => {
    const ids = new Set<string>();
    cfg.units.forEach((u, i) => {
      if (ids.has(u.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['units', i, 'id'],
          message: `duplicate unit id "${u.id}"`,
        });
      }
      ids.add(u.id);
      const roomNames = new Set<string>();
      u.interior.rooms.forEach((r, j) => {
        if (roomNames.has(r.name)) {
          ctx.addIssue({
            code: 'custom',
            path: ['units', i, 'interior', 'rooms', j, 'name'],
            message: `duplicate room name "${r.name}"`,
          });
        }
        roomNames.add(r.name);
      });
    });
    cfg.exterior.hotspots.forEach((h, i) => {
      if (!ids.has(h.unitId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['exterior', 'hotspots', i, 'unitId'],
          message: `unknown unit "${h.unitId}"`,
        });
      }
    });
  });

export type Vec3 = z.infer<typeof Vec3Schema>;
export type Vec2 = z.infer<typeof Vec2Schema>;
export type Transform = z.infer<typeof TransformSchema>;
export type Rect2 = z.infer<typeof Rect2Schema>;
export type Hotspot = z.infer<typeof HotspotSchema>;
export type ExteriorConfig = z.infer<typeof ExteriorSchema>;
export type ExteriorCamera = z.infer<typeof ExteriorCameraSchema>;
export type Room = z.infer<typeof RoomSchema>;
export type InteriorConfig = z.infer<typeof InteriorSchema>;
export type UnitStatus = z.infer<typeof UnitStatusSchema>;
export type Unit = z.infer<typeof UnitSchema>;
export type ProjectFile = z.infer<typeof ProjectFileSchema>;
