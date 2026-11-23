import {
  DropInViewer,
  LogLevel,
  SceneFormat,
  type AbortablePromise,
  type SceneFormatValue,
} from '@mkkellogg/gaussian-splats-3d';
import type { SplatLoadOptions, SplatScene } from './SplatScene';

function formatFromUrl(url: string): SceneFormatValue {
  const path = new URL(url, window.location.href).pathname.toLowerCase();
  if (path.endsWith('.ksplat')) return SceneFormat.KSplat;
  if (path.endsWith('.splat')) return SceneFormat.Splat;
  if (path.endsWith('.spz')) return SceneFormat.Spz;
  if (path.endsWith('.ply')) return SceneFormat.Ply;
  throw new Error(`Unsupported splat format: ${path} (use .ply, .splat, .ksplat or .spz)`);
}

/** SplatScene backed by @mkkellogg/gaussian-splats-3d's DropInViewer. */
export class GaussianSplats3DAdapter implements SplatScene {
  readonly object3D: DropInViewer;
  private pending: AbortablePromise<void> | null = null;
  private disposed = false;

  constructor() {
    this.object3D = new DropInViewer({
      // SharedArrayBuffer is only available when the page is cross-origin isolated
      // (COOP/COEP headers). Use it when present, fall back to message passing otherwise.
      sharedMemoryForWorkers: typeof window !== 'undefined' && window.crossOriginIsolated === true,
      gpuAcceleratedSort: false,
      dynamicScene: false,
      logLevel: LogLevel.None,
    });
  }

  load(url: string, options: SplatLoadOptions = {}): Promise<void> {
    if (this.disposed) return Promise.reject(new Error('SplatScene already disposed'));
    const { onProgress, signal } = options;
    if (signal?.aborted) return Promise.reject(signal.reason);

    let format: SceneFormatValue;
    try {
      format = formatFromUrl(url);
    } catch (err) {
      return Promise.reject(err);
    }

    const pending = this.object3D.addSplatScene(url, {
      format,
      showLoadingUI: false,
      progressiveLoad: false,
      splatAlphaRemovalThreshold: 5,
      onProgress: (percent) => {
        onProgress?.(Number.isFinite(percent) && percent > 0 ? Math.min(percent / 100, 1) : null);
      },
    });
    this.pending = pending;

    return new Promise<void>((resolve, reject) => {
      const onAbort = () => {
        pending.abort(signal?.reason);
        reject(signal?.reason ?? new Error('aborted'));
      };
      signal?.addEventListener('abort', onAbort, { once: true });
      // AbortablePromise ignores then()'s reject argument — chain catch() explicitly.
      pending
        .then(() => {
          signal?.removeEventListener('abort', onAbort);
          this.pending = null;
          resolve();
        })
        .catch((err) => {
          signal?.removeEventListener('abort', onAbort);
          this.pending = null;
          reject(err);
        });
    });
  }

  onTransformChanged(): void {
    if (this.disposed) return;
    // Sorting is normally triggered by camera movement only; force one after a move.
    void this.object3D.viewer.runSplatSort(true, true).catch(() => undefined);
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    this.pending?.abort('disposed');
    this.pending = null;
    this.object3D.removeFromParent();
    try {
      await this.object3D.dispose();
    } catch {
      // Aborted downloads reject inside the library's dispose; nothing left to clean up.
    }
  }
}
