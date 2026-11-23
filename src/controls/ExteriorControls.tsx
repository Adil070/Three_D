import { OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useLayoutEffect, useRef, type ComponentRef } from 'react';
import type { ExteriorCamera } from '../config/schema';
import { DEG } from '../config/transform';
import { useAppStore } from '../state/store';

export type OrbitControlsImpl = ComponentRef<typeof OrbitControls>;

/**
 * Damped orbit around the building with limited zoom and pitch. Panning is off for
 * buyers so they can't lose the building. During transitions the CameraDirector owns the camera
 * and these controls are disabled.
 */
export function ExteriorControls({ config }: { config: ExteriorCamera }) {
  const ref = useRef<OrbitControlsImpl>(null);
  const camera = useThree((s) => s.camera);
  const enabled = useAppStore((s) => s.transition === 'none');
  // Panning is a dev aid only: it lets you move the orbit target onto a unit to read
  // its coordinates for a hotspot (see README → "Placing hotspots").
  const debug = useAppStore((s) => s.debug);

  // First mount for a project (not returning from an interior): apply the config view.
  useLayoutEffect(() => {
    const controls = ref.current;
    if (!controls) return;
    if (useAppStore.getState().transition === 'none') {
      camera.position.set(...config.position);
      controls.target.set(...config.target);
      controls.update();
    }
  }, [camera, config]);

  return (
    <OrbitControls
      ref={ref}
      makeDefault
      enabled={enabled}
      enableDamping
      dampingFactor={0.08}
      enablePan={debug}
      screenSpacePanning
      rotateSpeed={0.6}
      zoomSpeed={0.8}
      minDistance={config.minDistance}
      maxDistance={config.maxDistance}
      minPolarAngle={config.minPolarAngle * DEG}
      maxPolarAngle={config.maxPolarAngle * DEG}
    />
  );
}
