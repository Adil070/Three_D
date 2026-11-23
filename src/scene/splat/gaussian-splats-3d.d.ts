// Minimal typings for @mkkellogg/gaussian-splats-3d@0.4.7 (the package ships no .d.ts).
// Only what GaussianSplats3DAdapter uses is declared — keep it that way so nothing else
// in the app grows a dependency on this library.
declare module '@mkkellogg/gaussian-splats-3d' {
  import type { Group } from 'three';

  export const SceneFormat: {
    readonly Splat: 0;
    readonly KSplat: 1;
    readonly Ply: 2;
    readonly Spz: 3;
  };
  export type SceneFormatValue = (typeof SceneFormat)[keyof typeof SceneFormat];

  export const LogLevel: {
    readonly None: 0;
    readonly Error: 1;
    readonly Warning: 2;
    readonly Info: 3;
    readonly Debug: 4;
  };

  export const SceneRevealMode: { readonly Default: 0; readonly Gradual: 1; readonly Instant: 2 };

  /**
   * NOT a real Promise: `then()` ignores its second argument, so `await` never rejects.
   * Always chain `.then(...).catch(...)` explicitly.
   */
  export interface AbortablePromise<T = unknown> {
    then<R>(onResolve: (value: T) => R): AbortablePromise<R>;
    catch(onFail: (error: unknown) => void): AbortablePromise<T>;
    abort(reason?: unknown): void;
  }

  export interface AddSplatSceneOptions {
    format?: SceneFormatValue;
    showLoadingUI?: boolean;
    progressiveLoad?: boolean;
    splatAlphaRemovalThreshold?: number;
    position?: [number, number, number];
    rotation?: [number, number, number, number];
    scale?: [number, number, number];
    onProgress?: (percent: number, percentLabel: string, loaderStatus: number) => void;
  }

  export interface DropInViewerOptions {
    gpuAcceleratedSort?: boolean;
    sharedMemoryForWorkers?: boolean;
    integerBasedSort?: boolean;
    dynamicScene?: boolean;
    antialiased?: boolean;
    sceneRevealMode?: (typeof SceneRevealMode)[keyof typeof SceneRevealMode];
    logLevel?: (typeof LogLevel)[keyof typeof LogLevel];
    freeIntermediateSplatData?: boolean;
    inMemoryCompressionLevel?: 0 | 1 | 2;
    sphericalHarmonicsDegree?: 0 | 1 | 2;
  }

  export class DropInViewer extends Group {
    constructor(options?: DropInViewerOptions);
    readonly viewer: {
      runSplatSort(force?: boolean, forceSortAll?: boolean): Promise<boolean>;
    };
    addSplatScene(path: string, options?: AddSplatSceneOptions): AbortablePromise<void>;
    dispose(): Promise<void>;
  }
}
