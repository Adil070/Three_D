/** Walker tuning. All distances in metres, speeds in m/s, angles in radians. */
export const EYE_HEIGHT = 1.6;
export const PLAYER_RADIUS = 0.25;
export const WALK_SPEED = 1.4;
export const RUN_MULTIPLIER = 2.2;
export const GLIDE_SPEED = 1.8;
export const MAX_TAP_DISTANCE = 12;
export const PITCH_LIMIT = (80 * Math.PI) / 180;

/** Radians of rotation per pixel dragged. */
export const LOOK_SENSITIVITY_MOUSE = 0.0042;
export const LOOK_SENSITIVITY_TOUCH = 0.0058;

/** A pointer press shorter than this and moving less than TAP_SLOP is a tap. */
export const TAP_MAX_MS = 350;
export const TAP_SLOP_PX = 8;
