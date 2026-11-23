import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { lazy, Suspense, useCallback, useEffect } from 'react';
import type { PerspectiveCamera } from 'three';
import { findUnit, resolveAsset, type LoadedProject } from '../config/loadProject';
import type { Transform, Unit } from '../config/schema';
import { ExteriorControls } from '../controls/ExteriorControls';
import { FirstPersonControls } from '../controls/FirstPersonControls';
import { EXTERIOR_KEY, unitKey, useAppStore } from '../state/store';
import { CameraDirector } from './CameraDirector';
import { PlaceholderApartment } from './PlaceholderApartment';
import { PlaceholderBuilding } from './PlaceholderBuilding';
import { SplatAsset } from './SplatAsset';
import { stepTweens } from './tween';
import { UnitHotspots } from './UnitHotspots';

// Debug helpers are only downloaded when ?debug is present.
const DebugScene = lazy(() => import('../debug/DebugScene'));

/** Debug-panel override if present, otherwise the value from project.json. */
function useTransform(key: string, fallback: Transform): Transform {
  return useAppStore((s) => s.transformOverrides[key]) ?? fallback;
}

function TweenDriver() {
  useFrame((_, dt) => stepTweens(Math.min(dt, 0.1)));
  return null;
}

/** Wider FOV in portrait so phones don't feel like looking through a letterbox. */
function ResponsiveFov() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const aspect = useThree((s) => s.size.width / s.size.height);
  useEffect(() => {
    camera.fov = aspect < 1 ? 72 : 60;
    camera.updateProjectionMatrix();
  }, [aspect, camera]);
  return null;
}

function ExteriorWorld({ project }: { project: LoadedProject }) {
  const mode = useAppStore((s) => s.mode);
  const isMobile = useAppStore((s) => s.isMobile);
  const ext = project.config.exterior;
  const transform = useTransform(EXTERIOR_KEY, ext.transform);
  const onReady = useCallback(() => useAppStore.setState({ exteriorReady: true }), []);

  // Desktop keeps the exterior splat in memory (hidden) while inside a unit so "back to
  // building" is instant. Mobile frees it — GPU memory there is too tight for two splats.
  const keepLoaded = mode === 'exterior' || !isMobile;

  useEffect(() => {
    if (!keepLoaded) useAppStore.setState({ exteriorReady: false });
  }, [keepLoaded]);

  return (
    <>
      {keepLoaded && (
        <SplatAsset
          key={ext.splat}
          url={resolveAsset(project, ext.splat)}
          transform={transform}
          loadingKey="exterior"
          loadingLabel="Loading building"
          visible={mode === 'exterior'}
          fallback={<PlaceholderBuilding exterior={ext} />}
          onReady={onReady}
        />
      )}
      {mode === 'exterior' && (
        <>
          <ExteriorControls config={ext.camera} />
          <UnitHotspots project={project} />
        </>
      )}
    </>
  );
}

function InteriorWorld({ project, unit }: { project: LoadedProject; unit: Unit }) {
  const transform = useTransform(unitKey(unit.id), unit.interior.transform);
  const onReady = useCallback(() => useAppStore.setState({ interiorReady: true }), []);

  useEffect(() => () => useAppStore.setState({ interiorReady: false }), []);

  return (
    <>
      <SplatAsset
        key={unit.interior.splat}
        url={resolveAsset(project, unit.interior.splat)}
        transform={transform}
        loadingKey="interior"
        loadingLabel={`Loading ${unit.name}`}
        fallback={<PlaceholderApartment interior={unit.interior} />}
        onReady={onReady}
      />
      <FirstPersonControls interior={unit.interior} />
    </>
  );
}

export function Experience({ project }: { project: LoadedProject }) {
  const isMobile = useAppStore((s) => s.isMobile);
  const debug = useAppStore((s) => s.debug);
  const mode = useAppStore((s) => s.mode);
  const activeUnit = useAppStore((s) => findUnit(project, s.activeUnitId));
  const ext = project.config.exterior.camera;

  return (
    <Canvas
      className="viewer-canvas"
      dpr={[1, isMobile ? 1.5 : 2]}
      gl={{ antialias: !isMobile, powerPreference: 'high-performance' }}
      camera={{ fov: 60, near: 0.05, far: 2000, position: ext.position }}
      onCreated={({ camera }) => {
        camera.rotation.order = 'YXZ';
      }}
    >
      <color attach="background" args={[mode === 'exterior' ? '#eef3fa' : '#f4f6fa']} />
      <TweenDriver />
      <ResponsiveFov />
      <CameraDirector />
      <ExteriorWorld project={project} />
      {mode === 'interior' && activeUnit && (
        <InteriorWorld key={activeUnit.id} project={project} unit={activeUnit} />
      )}
      {debug && (
        <Suspense fallback={null}>
          <DebugScene project={project} />
        </Suspense>
      )}
    </Canvas>
  );
}
