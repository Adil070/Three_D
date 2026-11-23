import { create } from 'zustand';
import type { LoadedProject } from '../config/loadProject';
import type { Transform } from '../config/schema';

export type Mode = 'exterior' | 'interior';
export type Transition = 'none' | 'entering' | 'exiting';

export interface LoadingTask {
  label: string;
  /** 0..1, or null when the total size is unknown. */
  progress: number | null;
}

export type NavRequest =
  { kind: 'enter'; unitId: string; nonce: number } | { kind: 'exit'; nonce: number };

export interface RoomRequest {
  name: string;
  nonce: number;
}

/** Keys for transform overrides written by the debug panel. */
export const EXTERIOR_KEY = 'exterior';
export const unitKey = (unitId: string) => `unit:${unitId}`;

function detectDebug(): boolean {
  const hashQuery = window.location.hash.split('?')[1] ?? '';
  return (
    new URLSearchParams(window.location.search).has('debug') ||
    new URLSearchParams(hashQuery).has('debug')
  );
}

function detectMobile(): boolean {
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  return coarse || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

export interface AppState {
  readonly debug: boolean;
  readonly isMobile: boolean;

  project: LoadedProject | null;
  projectError: string | null;

  mode: Mode;
  transition: Transition;
  /** Unit whose info card is open in exterior mode. */
  selectedUnitId: string | null;
  /** Unit currently loaded in interior mode. */
  activeUnitId: string | null;
  currentRoom: string | null;
  /** White veil over the canvas, used to hide scene swaps. */
  fade: boolean;

  loading: Record<string, LoadingTask>;
  exteriorReady: boolean;
  interiorReady: boolean;

  navRequest: NavRequest | null;
  roomRequest: RoomRequest | null;

  transformOverrides: Record<string, Transform>;

  setProject: (project: LoadedProject | null, error?: string | null) => void;
  selectUnit: (unitId: string | null) => void;
  requestEnterUnit: (unitId: string) => void;
  requestExit: () => void;
  requestRoom: (name: string) => void;
  setLoading: (key: string, task: LoadingTask | null) => void;
  setTransformOverride: (key: string, t: Transform) => void;
}

let nonce = 0;

export const useAppStore = create<AppState>()((set, get) => ({
  debug: detectDebug(),
  isMobile: detectMobile(),

  project: null,
  projectError: null,

  mode: 'exterior',
  transition: 'none',
  selectedUnitId: null,
  activeUnitId: null,
  currentRoom: null,
  fade: false,

  loading: {},
  exteriorReady: false,
  interiorReady: false,

  navRequest: null,
  roomRequest: null,

  transformOverrides: {},

  setProject: (project, error = null) =>
    set({
      project,
      projectError: error,
      mode: 'exterior',
      transition: 'none',
      selectedUnitId: null,
      activeUnitId: null,
      currentRoom: null,
      fade: false,
      navRequest: null,
      roomRequest: null,
      transformOverrides: {},
    }),

  selectUnit: (unitId) => set({ selectedUnitId: unitId }),

  requestEnterUnit: (unitId) => {
    if (get().transition !== 'none') return;
    set({ navRequest: { kind: 'enter', unitId, nonce: ++nonce } });
  },

  requestExit: () => {
    const s = get();
    if (s.transition !== 'none' || s.mode !== 'interior') return;
    set({ navRequest: { kind: 'exit', nonce: ++nonce } });
  },

  requestRoom: (name) => {
    if (get().transition !== 'none') return;
    set({ roomRequest: { name, nonce: ++nonce } });
  },

  setLoading: (key, task) =>
    set((s) => {
      const loading = { ...s.loading };
      if (task) loading[key] = task;
      else delete loading[key];
      return { loading };
    }),

  setTransformOverride: (key, t) =>
    set((s) => ({ transformOverrides: { ...s.transformOverrides, [key]: t } })),
}));

/** Resolves once `predicate` holds for the store state. */
export function waitForStore(predicate: (s: AppState) => boolean): Promise<void> {
  return new Promise((resolve) => {
    if (predicate(useAppStore.getState())) {
      resolve();
      return;
    }
    const unsub = useAppStore.subscribe((s) => {
      if (predicate(s)) {
        unsub();
        resolve();
      }
    });
  });
}
