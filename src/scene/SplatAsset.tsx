import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { Group } from 'three';
import { assetExists } from '../config/loadProject';
import type { Transform } from '../config/schema';
import { applyTransform } from '../config/transform';
import { useAppStore } from '../state/store';
import { createSplatScene } from './splat/createSplatScene';
import type { SplatScene } from './splat/SplatScene';

export type SplatResult = 'splat' | 'fallback';

interface SplatAssetProps {
  url: string;
  transform: Transform;
  /** Key in the store's loading map (drives the loading screen). */
  loadingKey: string;
  loadingLabel: string;
  visible?: boolean;
  /** Rendered instead of the splat when the file is missing or fails to load. */
  fallback: ReactNode;
  onReady?: (result: SplatResult) => void;
}

/**
 * Loads one splat through the SplatScene interface and keeps it in the scene graph.
 * The config transform is applied to a wrapper group, so the debug panel can move the
 * splat live without reloading. Remount (change `key`) to load a different file.
 */
export function SplatAsset({
  url,
  transform,
  loadingKey,
  loadingLabel,
  visible = true,
  fallback,
  onReady,
}: SplatAssetProps) {
  const groupRef = useRef<Group>(null);
  const splatRef = useRef<SplatScene | null>(null);
  const onReadyRef = useRef(onReady);
  const [result, setResult] = useState<SplatResult | null>(null);
  const setLoading = useAppStore((s) => s.setLoading);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    const ac = new AbortController();
    let splat: SplatScene | null = null;

    const finish = (r: SplatResult) => {
      if (ac.signal.aborted) return;
      setLoading(loadingKey, null);
      setResult(r);
      onReadyRef.current?.(r);
    };

    const run = async () => {
      setLoading(loadingKey, { label: loadingLabel, progress: null });
      const exists = await assetExists(url, ac.signal);
      if (ac.signal.aborted) return;
      if (!exists) {
        console.info(`[splat] ${url} not found — showing placeholder.`);
        finish('fallback');
        return;
      }
      splat = await createSplatScene();
      if (ac.signal.aborted) {
        void splat.dispose();
        return;
      }
      splatRef.current = splat;
      groupRef.current?.add(splat.object3D);
      await splat.load(url, {
        signal: ac.signal,
        onProgress: (progress) => setLoading(loadingKey, { label: loadingLabel, progress }),
      });
      finish('splat');
    };

    run().catch((err: unknown) => {
      if (ac.signal.aborted) return;
      console.warn(`[splat] failed to load ${url} — showing placeholder.`, err);
      void splat?.dispose();
      splatRef.current = null;
      finish('fallback');
    });

    return () => {
      ac.abort();
      setLoading(loadingKey, null);
      void splat?.dispose();
      splatRef.current = null;
    };
  }, [url, loadingKey, loadingLabel, setLoading]);

  useLayoutEffect(() => {
    if (!groupRef.current) return;
    applyTransform(groupRef.current, transform);
    splatRef.current?.onTransformChanged?.();
  }, [transform, result]);

  return (
    <>
      <group ref={groupRef} visible={visible} />
      {result === 'fallback' && <group visible={visible}>{fallback}</group>}
    </>
  );
}
