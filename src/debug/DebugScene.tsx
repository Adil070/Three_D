import { Stats } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { findUnit, type LoadedProject } from '../config/loadProject';
import type { InteriorConfig, Rect2 } from '../config/schema';
import { DEG } from '../config/transform';
import type { OrbitControlsImpl } from '../controls/ExteriorControls';
import { useAppStore } from '../state/store';
import { cameraProbe, useDebugStore } from './debugStore';

const COLLISION_COLOR = '#1A5FBE';
const ROOM_COLOR = '#3CB371';
const MARKER_COLOR = '#0D1B2A';

const UNIT_EDGES = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
const collisionMaterial = new THREE.LineBasicMaterial({ color: COLLISION_COLOR, depthTest: false });
const roomLineMaterial = new THREE.LineBasicMaterial({ color: ROOM_COLOR, depthTest: false });

function rectOutline(r: Rect2, y: number): THREE.Line {
  const [x0, z0] = r.min;
  const [x1, z1] = r.max;
  const geom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(x0, y, z0),
    new THREE.Vector3(x1, y, z0),
    new THREE.Vector3(x1, y, z1),
    new THREE.Vector3(x0, y, z1),
    new THREE.Vector3(x0, y, z0),
  ]);
  const line = new THREE.Line(geom, roomLineMaterial);
  line.renderOrder = 5;
  return line;
}

/** Wireframe collision boxes, room footprints and spawn/room camera markers. */
function InteriorHelpers({ interior }: { interior: InteriorConfig }) {
  const showCollision = useDebugStore((s) => s.showCollision);
  const showRooms = useDebugStore((s) => s.showRooms);
  const { floorHeight: y, ceilingHeight: h } = interior;

  const roomLines = useMemo(
    () =>
      interior.rooms.flatMap((r) =>
        r.bounds ? [{ name: r.name, line: rectOutline(r.bounds, y + 0.02) }] : [],
      ),
    [interior.rooms, y],
  );

  // Arrow per camera position, pointing along its yaw.
  const markers = useMemo(
    () => [
      { key: 'spawn', p: interior.spawn.position, yaw: interior.spawn.yaw },
      ...interior.rooms.map((r) => ({ key: `room:${r.name}`, p: r.position, yaw: r.yaw })),
    ],
    [interior],
  );

  return (
    <>
      {showCollision &&
        interior.collision.map((c, i) => (
          <lineSegments
            key={i}
            geometry={UNIT_EDGES}
            material={collisionMaterial}
            renderOrder={5}
            position={[(c.min[0] + c.max[0]) / 2, y + h / 2, (c.min[1] + c.max[1]) / 2]}
            scale={[c.max[0] - c.min[0], h, c.max[1] - c.min[1]]}
          />
        ))}
      {showRooms && (
        <>
          {roomLines.map(({ name, line }) => (
            <primitive key={name} object={line} />
          ))}
          {markers.map((m) => (
            <group key={m.key} position={[m.p[0], y + 0.05, m.p[1]]} rotation={[0, m.yaw * DEG, 0]}>
              {/* cone tip points along local -Z = the yaw's view direction */}
              <mesh rotation-x={-Math.PI / 2} position-z={-0.15}>
                <coneGeometry args={[0.12, 0.35, 12]} />
                <meshBasicMaterial
                  color={m.key === 'spawn' ? ROOM_COLOR : MARKER_COLOR}
                  depthTest={false}
                />
              </mesh>
            </group>
          ))}
        </>
      )}
    </>
  );
}

function AxesAndGrid({ y }: { y: number }) {
  const showGrid = useDebugStore((s) => s.showGrid);
  const axes = useMemo(() => {
    const a = new THREE.AxesHelper(2);
    // X orange, Y green, Z blue (red is avoided per brand guidelines).
    a.setColors(new THREE.Color('#E07B00'), new THREE.Color('#3CB371'), new THREE.Color('#1A5FBE'));
    return a;
  }, []);
  if (!showGrid) return null;
  return (
    <group position-y={y + 0.01}>
      <gridHelper args={[60, 60, '#5b6b80', '#a9b5c6']} />
      <primitive object={axes} />
    </group>
  );
}

/** Small marker at the orbit target, so it can be panned onto a unit to place a hotspot. */
function OrbitTargetMarker() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const t = cameraProbe.target;
    if (ref.current && t) ref.current.position.set(...t);
  });
  return (
    <mesh ref={ref} renderOrder={6}>
      <sphereGeometry args={[0.35, 16, 12]} />
      <meshBasicMaterial color={MARKER_COLOR} depthTest={false} transparent opacity={0.8} />
    </mesh>
  );
}

function CameraProbe() {
  const euler = useMemo(() => new THREE.Euler(0, 0, 0, 'YXZ'), []);
  useFrame(({ camera, controls }) => {
    const p = camera.position;
    cameraProbe.position = [p.x, p.y, p.z];
    euler.setFromQuaternion(camera.quaternion, 'YXZ');
    cameraProbe.yaw = euler.y / DEG;
    cameraProbe.pitch = euler.x / DEG;
    const orbit = controls as OrbitControlsImpl | null;
    cameraProbe.target =
      useAppStore.getState().mode === 'exterior' && orbit?.target
        ? [orbit.target.x, orbit.target.y, orbit.target.z]
        : null;
  });
  return null;
}

export default function DebugScene({ project }: { project: LoadedProject }) {
  const mode = useAppStore((s) => s.mode);
  const unit = useAppStore((s) => findUnit(project, s.activeUnitId));
  const showStats = useDebugStore((s) => s.showStats);
  const interior = mode === 'interior' ? unit?.interior : undefined;

  return (
    <>
      <CameraProbe />
      <AxesAndGrid y={interior?.floorHeight ?? 0} />
      {interior && <InteriorHelpers interior={interior} />}
      {mode === 'exterior' && <OrbitTargetMarker />}
      {showStats && <Stats className="debug-stats" />}
    </>
  );
}
