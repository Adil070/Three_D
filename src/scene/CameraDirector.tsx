import { useThree, type RootState } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { findUnit } from '../config/loadProject';
import { DEG } from '../config/transform';
import { EYE_HEIGHT } from '../controls/constants';
import type { OrbitControlsImpl } from '../controls/ExteriorControls';
import { useAppStore, waitForStore } from '../state/store';
import { easeInOutCubic, easeOutCubic, tween, wait } from './tween';

/** Must match the CSS transition on .fade-veil. */
export const FADE_MS = 450;

interface ExteriorView {
  position: THREE.Vector3;
  target: THREE.Vector3;
}

/** Orbit view to return to after leaving an interior. */
let savedExterior: ExteriorView | null = null;

const set = useAppStore.setState;
const get = useAppStore.getState;

type GetR3F = () => RootState;

/** Always read live: the orbit controls unmount/remount when the mode changes. */
function orbitControls(getR3F: GetR3F): OrbitControlsImpl | null {
  return (getR3F().controls as OrbitControlsImpl | null) ?? null;
}

/**
 * Exterior → interior:
 *   fly toward the unit's hotspot, fade to white, swap scenes, wait for the interior
 *   splat, then ease from slightly behind/above the spawn point into it while fading in.
 */
async function enterUnit(getR3F: GetR3F, unitId: string) {
  const project = get().project;
  const unit = project ? findUnit(project, unitId) : undefined;
  if (!project || !unit) return;
  const camera = getR3F().camera;
  const controls = orbitControls(getR3F);
  const ext = project.config.exterior;

  set({ transition: 'entering', selectedUnitId: null });

  const startPos = camera.position.clone();
  const startTarget = controls ? controls.target.clone() : new THREE.Vector3(...ext.camera.target);
  savedExterior = { position: startPos.clone(), target: startTarget.clone() };

  const hotspot = ext.hotspots.find((h) => h.unitId === unitId);
  const focus = hotspot ? new THREE.Vector3(...hotspot.position) : startTarget.clone();
  const endPos = focus.clone().add(startPos.clone().sub(focus).setLength(3));
  const look = new THREE.Vector3();
  let faded = false;

  await tween(1.2, (k) => {
    camera.position.lerpVectors(startPos, endPos, k);
    camera.lookAt(look.lerpVectors(startTarget, focus, k));
    if (k > 0.55 && !faded) {
      faded = true;
      set({ fade: true });
    }
  });
  await wait(FADE_MS);
  if (get().project !== project) return;

  set({ mode: 'interior', activeUnitId: unitId, interiorReady: false, currentRoom: null });
  await waitForStore((s) => s.interiorReady || s.project !== project);
  if (get().project !== project) return;

  const { spawn, floorHeight } = unit.interior;
  const yaw = spawn.yaw * DEG;
  const eye = new THREE.Vector3(spawn.position[0], floorHeight + EYE_HEIGHT, spawn.position[1]);
  // Start 1.5 m behind and 0.5 m above the spawn, looking slightly down.
  const back = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(1.5);
  const from = eye
    .clone()
    .add(back)
    .add(new THREE.Vector3(0, 0.5, 0));
  camera.rotation.set(-0.2, yaw, 0, 'YXZ');
  camera.position.copy(from);

  set({ fade: false });
  await tween(
    1.4,
    (k) => {
      camera.position.lerpVectors(from, eye, k);
      camera.rotation.set(-0.2 * (1 - k), yaw, 0, 'YXZ');
    },
    easeOutCubic,
  );
  set({ transition: 'none' });
}

/**
 * Interior → exterior: fade out, swap scenes (reloading the exterior on mobile), then pull
 * back from the unit's hotspot to the orbit view the buyer left from.
 */
async function exitUnit(getR3F: GetR3F) {
  const project = get().project;
  if (!project) return;
  const unitId = get().activeUnitId;
  const ext = project.config.exterior;
  const camera = getR3F().camera;

  set({ transition: 'exiting', fade: true });
  await wait(FADE_MS);

  set({ mode: 'exterior', activeUnitId: null, interiorReady: false, currentRoom: null });
  await waitForStore((s) => s.exteriorReady || s.project !== project);
  if (get().project !== project) return;

  const view = savedExterior ?? {
    position: new THREE.Vector3(...ext.camera.position),
    target: new THREE.Vector3(...ext.camera.target),
  };
  const hotspot = ext.hotspots.find((h) => h.unitId === unitId);
  const focus = hotspot ? new THREE.Vector3(...hotspot.position) : view.target.clone();
  const from = focus.clone().add(view.position.clone().sub(focus).setLength(3));
  const look = new THREE.Vector3();

  camera.rotation.order = 'YXZ';
  camera.position.copy(from);
  camera.lookAt(focus);
  set({ fade: false });

  await tween(
    1.5,
    (k) => {
      camera.position.lerpVectors(from, view.position, k);
      camera.lookAt(look.lerpVectors(focus, view.target, k));
    },
    easeInOutCubic,
  );

  const controls = orbitControls(getR3F);
  if (controls) {
    controls.target.copy(view.target);
    controls.update();
  }
  set({ transition: 'none' });
}

/** Runs enter/exit choreography in response to store navigation requests. */
export function CameraDirector() {
  const getR3F = useThree((s) => s.get);
  const navRequest = useAppStore((s) => s.navRequest);
  const project = useAppStore((s) => s.project);
  const handled = useRef(0);

  useEffect(() => {
    savedExterior = null;
  }, [project]);

  useEffect(() => {
    if (!navRequest || navRequest.nonce === handled.current) return;
    handled.current = navRequest.nonce;
    const run =
      navRequest.kind === 'enter' ? enterUnit(getR3F, navRequest.unitId) : exitUnit(getR3F);
    run.catch((err: unknown) => {
      console.error('[director] transition failed', err);
      set({ transition: 'none', fade: false });
    });
  }, [navRequest, getR3F]);

  return null;
}
