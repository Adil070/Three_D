import type { Object3D } from 'three';

/**
 * Renderer-agnostic handle to one loaded Gaussian splat.
 *
 * This is the ONLY surface the rest of the app sees. To switch libraries (e.g. to Spark),
 * write another adapter that implements this interface and change `createSplatScene`
 * in ./createSplatScene.ts — nothing else needs to change.
 *
 * Contract:
 * - `object3D` is added to the R3F scene graph by <SplatAsset>. Its PARENT carries the
 *   config transform (position/rotation/scale), so adapters must honour parent world
 *   matrices and must not apply transforms of their own.
 * - `load()` resolves when the splat is renderable and rejects on network/parse errors
 *   or when `signal` aborts.
 * - `dispose()` frees GPU buffers and workers. It is safe to call more than once, and
 *   while a load is still in flight.
 */
export interface SplatScene {
  readonly object3D: Object3D;
  load(url: string, options?: SplatLoadOptions): Promise<void>;
  /** Called after the parent transform changes (debug panel) so the adapter can re-sort. */
  onTransformChanged?(): void;
  dispose(): Promise<void>;
}

export interface SplatLoadOptions {
  /** Fraction 0..1, or null when the download size is unknown. */
  onProgress?: (fraction: number | null) => void;
  signal?: AbortSignal;
}

export const SPLAT_EXTENSIONS = ['.ply', '.splat', '.ksplat', '.spz'] as const;
