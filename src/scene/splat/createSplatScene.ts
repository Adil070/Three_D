import type { SplatScene } from './SplatScene';

/**
 * The single place that decides which splat library is used.
 * To migrate (e.g. to Spark), implement SplatScene in a new adapter and return it here.
 * The library is imported lazily so it never blocks first paint.
 */
export async function createSplatScene(): Promise<SplatScene> {
  const { GaussianSplats3DAdapter } = await import('./GaussianSplats3DAdapter');
  return new GaussianSplats3DAdapter();
}
