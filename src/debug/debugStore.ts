import { create } from 'zustand';

/** Toggles owned by the leva panel, read by in-canvas helpers. */
export interface DebugHelpersState {
  showCollision: boolean;
  showRooms: boolean;
  showGrid: boolean;
  showStats: boolean;
}

export const useDebugStore = create<DebugHelpersState>()(() => ({
  showCollision: true,
  showRooms: true,
  showGrid: true,
  showStats: true,
}));

/**
 * Live camera readout, written every frame by <DebugScene/> and polled by the HUD.
 * Mutable on purpose: pushing 60 updates/s through React state would be wasteful.
 */
export const cameraProbe = {
  position: [0, 0, 0] as [number, number, number],
  /** Degrees, same convention as project.json (0 = looking toward -Z). */
  yaw: 0,
  pitch: 0,
  /** Orbit target in exterior mode, null in interior mode. */
  target: null as [number, number, number] | null,
};
