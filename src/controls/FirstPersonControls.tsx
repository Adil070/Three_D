import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { InteriorConfig } from '../config/schema';
import { DEG, wrapAngle } from '../config/transform';
import { useAppStore } from '../state/store';
import { moveWithCollision, type PlanPoint } from './collision';
import {
  EYE_HEIGHT,
  GLIDE_SPEED,
  LOOK_SENSITIVITY_MOUSE,
  LOOK_SENSITIVITY_TOUCH,
  MAX_TAP_DISTANCE,
  PITCH_LIMIT,
  PLAYER_RADIUS,
  RUN_MULTIPLIER,
  TAP_MAX_MS,
  TAP_SLOP_PX,
  WALK_SPEED,
} from './constants';
import { roomAt } from './rooms';

type Motion =
  | { kind: 'idle' }
  /** Tap-to-move: walks with collision until it arrives or gets stuck. */
  | { kind: 'walkTo'; x: number; z: number; stuckFor: number }
  /** Room shortcut: collision-free eased flight to a saved camera position. */
  | {
      kind: 'fly';
      from: PlanPoint;
      to: PlanPoint;
      yawFrom: number;
      yawDelta: number;
      pitchFrom: number;
      t: number;
      duration: number;
    };

const MOVE_KEYS: Record<string, [forward: number, strafe: number]> = {
  KeyW: [1, 0],
  ArrowUp: [1, 0],
  KeyS: [-1, 0],
  ArrowDown: [-1, 0],
  KeyA: [0, -1],
  ArrowLeft: [0, -1],
  KeyD: [0, 1],
  ArrowRight: [0, 1],
};

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  return t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName);
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/**
 * First-person walker for interiors.
 * The camera itself is the source of truth for position/yaw/pitch (Euler order YXZ),
 * so the CameraDirector can animate it during transitions without syncing state.
 */
export function FirstPersonControls({ interior }: { interior: InteriorConfig }) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const enabled = useAppStore((s) => s.transition === 'none');
  const roomRequest = useAppStore((s) => s.roomRequest);

  const keys = useRef(new Set<string>());
  const motion = useRef<Motion>({ kind: 'idle' });
  const markerRef = useRef<THREE.Mesh>(null);
  const roomTimer = useRef(0);
  const lastRoomNonce = useRef(roomRequest?.nonce ?? 0);

  const eyeY = interior.floorHeight + EYE_HEIGHT;
  const floorPlane = useMemo(
    () => new THREE.Plane(new THREE.Vector3(0, 1, 0), -interior.floorHeight),
    [interior.floorHeight],
  );

  // ---- Keyboard ----------------------------------------------------------------------
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code in MOVE_KEYS || e.code.startsWith('Shift')) {
        keys.current.add(e.code);
        if (e.code.startsWith('Arrow')) e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const clear = () => keys.current.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
    };
  }, []);

  // ---- Pointer: drag to look, tap floor to move ------------------------------------
  useEffect(() => {
    const el = gl.domElement;
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const hit = new THREE.Vector3();
    let active: {
      id: number;
      x: number;
      y: number;
      startX: number;
      startY: number;
      t0: number;
      dragging: boolean;
      touch: boolean;
    } | null = null;

    const onDown = (e: PointerEvent) => {
      if (!useAppStore.getState().interiorReady) return;
      if (active || (e.pointerType === 'mouse' && e.button !== 0)) return;
      el.setPointerCapture(e.pointerId);
      active = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        startX: e.clientX,
        startY: e.clientY,
        t0: performance.now(),
        dragging: false,
        touch: e.pointerType !== 'mouse',
      };
    };

    const onMove = (e: PointerEvent) => {
      if (!active || e.pointerId !== active.id) return;
      const dx = e.clientX - active.x;
      const dy = e.clientY - active.y;
      active.x = e.clientX;
      active.y = e.clientY;
      if (!active.dragging) {
        if (Math.hypot(e.clientX - active.startX, e.clientY - active.startY) < TAP_SLOP_PX) return;
        active.dragging = true;
        el.style.cursor = 'grabbing';
      }
      if (useAppStore.getState().transition !== 'none') return;
      // "Grab the world" feel (Street View style): dragging right turns the view left.
      const s = active.touch ? LOOK_SENSITIVITY_TOUCH : LOOK_SENSITIVITY_MOUSE;
      camera.rotation.y += dx * s;
      camera.rotation.x = THREE.MathUtils.clamp(
        camera.rotation.x + dy * s,
        -PITCH_LIMIT,
        PITCH_LIMIT,
      );
      if (motion.current.kind === 'fly') motion.current = { kind: 'idle' };
    };

    const onUp = (e: PointerEvent) => {
      if (!active || e.pointerId !== active.id) return;
      const wasTap = !active.dragging && performance.now() - active.t0 < TAP_MAX_MS;
      active = null;
      el.style.cursor = '';
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      if (!wasTap || useAppStore.getState().transition !== 'none') return;

      const rect = el.getBoundingClientRect();
      ndc.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      if (!raycaster.ray.intersectPlane(floorPlane, hit)) return;
      if (hit.distanceTo(camera.position) > MAX_TAP_DISTANCE) return;
      motion.current = { kind: 'walkTo', x: hit.x, z: hit.z, stuckFor: 0 };
    };

    const onCancel = (e: PointerEvent) => {
      if (active && e.pointerId === active.id) {
        active = null;
        el.style.cursor = '';
      }
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onCancel);
    el.style.cursor = 'grab';
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onCancel);
      el.style.cursor = '';
    };
  }, [gl, camera, floorPlane]);

  // ---- Room shortcuts ---------------------------------------------------------------
  useEffect(() => {
    if (!roomRequest || roomRequest.nonce === lastRoomNonce.current) return;
    lastRoomNonce.current = roomRequest.nonce;
    const room = interior.rooms.find((r) => r.name === roomRequest.name);
    if (!room) return;
    const from = { x: camera.position.x, z: camera.position.z };
    const to = { x: room.position[0], z: room.position[1] };
    const dist = Math.hypot(to.x - from.x, to.z - from.z);
    motion.current = {
      kind: 'fly',
      from,
      to,
      yawFrom: camera.rotation.y,
      yawDelta: wrapAngle(room.yaw * DEG - camera.rotation.y),
      pitchFrom: camera.rotation.x,
      t: 0,
      duration: THREE.MathUtils.clamp(dist / 3, 0.7, 2),
    };
  }, [roomRequest, interior.rooms, camera]);

  // Reset input when transitions start/stop.
  useEffect(() => {
    if (!enabled) motion.current = { kind: 'idle' };
  }, [enabled]);

  // ---- Per-frame update -------------------------------------------------------------
  const pos: PlanPoint = useMemo(() => ({ x: 0, z: 0 }), []);
  useFrame((_, rawDt) => {
    const marker = markerRef.current;
    if (!enabled) {
      if (marker) marker.visible = false;
      return;
    }
    const dt = Math.min(rawDt, 0.05);
    const yaw = camera.rotation.y;
    pos.x = camera.position.x;
    pos.z = camera.position.z;

    // Keyboard input
    let f = 0;
    let s = 0;
    for (const k of keys.current) {
      const m = MOVE_KEYS[k];
      if (m) {
        f += m[0];
        s += m[1];
      }
    }
    const running = keys.current.has('ShiftLeft') || keys.current.has('ShiftRight');

    if (f !== 0 || s !== 0) {
      motion.current = { kind: 'idle' };
      const len = Math.hypot(f, s);
      const speed = WALK_SPEED * (running ? RUN_MULTIPLIER : 1) * dt;
      // yaw 0 faces -Z; forward = (-sin, -cos), right = (cos, -sin)
      const fx = -Math.sin(yaw);
      const fz = -Math.cos(yaw);
      const dx = ((fx * f + Math.cos(yaw) * s) / len) * speed;
      const dz = ((fz * f - Math.sin(yaw) * s) / len) * speed;
      moveWithCollision(pos, dx, dz, PLAYER_RADIUS, interior.collision);
    } else {
      const m = motion.current;
      if (m.kind === 'walkTo') {
        const tx = m.x - pos.x;
        const tz = m.z - pos.z;
        const dist = Math.hypot(tx, tz);
        if (dist < 0.04) {
          motion.current = { kind: 'idle' };
        } else {
          // Ease out over the last metre.
          const speed = Math.min(GLIDE_SPEED, 0.4 + dist * 2) * dt;
          const step = Math.min(dist, speed);
          const bx = pos.x;
          const bz = pos.z;
          moveWithCollision(
            pos,
            (tx / dist) * step,
            (tz / dist) * step,
            PLAYER_RADIUS,
            interior.collision,
          );
          const progressed = Math.hypot(pos.x - bx, pos.z - bz);
          m.stuckFor = progressed < step * 0.25 ? m.stuckFor + dt : 0;
          if (m.stuckFor > 0.25) motion.current = { kind: 'idle' };
        }
      } else if (m.kind === 'fly') {
        m.t = Math.min(m.t + dt / m.duration, 1);
        const k = easeInOut(m.t);
        pos.x = m.from.x + (m.to.x - m.from.x) * k;
        pos.z = m.from.z + (m.to.z - m.from.z) * k;
        camera.rotation.y = m.yawFrom + m.yawDelta * k;
        camera.rotation.x = m.pitchFrom * (1 - k);
        if (m.t >= 1) motion.current = { kind: 'idle' };
      }
    }

    camera.position.set(pos.x, eyeY, pos.z);

    if (marker) {
      const m = motion.current;
      marker.visible = m.kind === 'walkTo';
      if (m.kind === 'walkTo') marker.position.set(m.x, interior.floorHeight + 0.01, m.z);
    }

    roomTimer.current += dt;
    if (roomTimer.current > 0.2) {
      roomTimer.current = 0;
      const room = roomAt(pos.x, pos.z, interior.rooms);
      const state = useAppStore.getState();
      if (room && room.name !== state.currentRoom) useAppStore.setState({ currentRoom: room.name });
    }
  });

  return (
    <mesh ref={markerRef} rotation-x={-Math.PI / 2} visible={false} renderOrder={10}>
      <ringGeometry args={[0.16, 0.22, 40]} />
      <meshBasicMaterial color="#1A5FBE" transparent opacity={0.85} depthTest={false} />
    </mesh>
  );
}
