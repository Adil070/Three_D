import { useMemo } from 'react';
import * as THREE from 'three';
import type { InteriorConfig, Rect2 } from '../config/schema';

const ROOM_TINTS = ['#e8eef7', '#eef4ec', '#f3f1ea', '#eaf1f4', '#f1eef5', '#edf2f0'];
const WALL_COLOR = '#fbfcfe';
const EDGE_COLOR = '#8796ad';

// Shared unit geometries, scaled per box — one GPU buffer for every wall.
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const UNIT_EDGES = new THREE.EdgesGeometry(UNIT_BOX);

function boundsOf(rects: Rect2[]): Rect2 | null {
  if (rects.length === 0) return null;
  const min: [number, number] = [Infinity, Infinity];
  const max: [number, number] = [-Infinity, -Infinity];
  for (const r of rects) {
    min[0] = Math.min(min[0], r.min[0]);
    min[1] = Math.min(min[1], r.min[1]);
    max[0] = Math.max(max[0], r.max[0]);
    max[1] = Math.max(max[1], r.max[1]);
  }
  return { min, max };
}

/** Box mesh spanning a floor-plan rectangle between y0 and y1. */
function PlanBox({
  rect,
  y0,
  y1,
  color,
  edges = false,
}: {
  rect: Rect2;
  y0: number;
  y1: number;
  color: string;
  edges?: boolean;
}) {
  const w = rect.max[0] - rect.min[0];
  const d = rect.max[1] - rect.min[1];
  const h = y1 - y0;
  return (
    <group
      position={[(rect.min[0] + rect.max[0]) / 2, y0 + h / 2, (rect.min[1] + rect.max[1]) / 2]}
      scale={[w, h, d]}
    >
      <mesh geometry={UNIT_BOX}>
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
      {edges && (
        <lineSegments geometry={UNIT_EDGES}>
          <lineBasicMaterial color={EDGE_COLOR} />
        </lineSegments>
      )}
    </group>
  );
}

/**
 * Procedural stand-in used when a unit's interior splat is missing.
 * Built entirely from the unit's config: room footprints become tinted floors and
 * collision boxes become walls — so what you see is exactly what you collide with.
 */
export function PlaceholderApartment({ interior }: { interior: InteriorConfig }) {
  const { floorHeight: y, ceilingHeight, collision, rooms } = interior;

  const floor = useMemo(() => {
    const all = boundsOf([...collision, ...rooms.flatMap((r) => (r.bounds ? [r.bounds] : []))]);
    if (!all) return { min: [-6, -6], max: [6, 6] } as Rect2;
    return {
      min: [all.min[0] - 0.5, all.min[1] - 0.5],
      max: [all.max[0] + 0.5, all.max[1] + 0.5],
    } as Rect2;
  }, [collision, rooms]);

  return (
    <group>
      <ambientLight intensity={1.1} />
      <hemisphereLight args={['#ffffff', '#d9dee8', 0.9]} />
      {/* Two angled lights so wall faces facing different ways read differently. */}
      <directionalLight position={[3, 6, 5]} intensity={1.1} />
      <directionalLight position={[-5, 4, -2]} intensity={0.45} />

      {/* Base slab */}
      <PlanBox rect={floor} y0={y - 0.1} y1={y - 0.002} color="#dfe4ec" />

      {/* Room floors */}
      {rooms.map((r, i) =>
        r.bounds ? (
          <PlanBox
            key={r.name}
            rect={r.bounds}
            y0={y - 0.002}
            y1={y}
            color={ROOM_TINTS[i % ROOM_TINTS.length] ?? '#eeeeee'}
          />
        ) : null,
      )}

      {/* Walls = collision boxes */}
      {collision.map((c, i) => (
        <PlanBox key={i} rect={c} y0={y} y1={y + ceilingHeight} color={WALL_COLOR} edges />
      ))}

      {/* Light floor grid gives a sense of motion while walking */}
      <gridHelper
        args={[
          Math.ceil(Math.max(floor.max[0] - floor.min[0], floor.max[1] - floor.min[1])),
          Math.ceil(Math.max(floor.max[0] - floor.min[0], floor.max[1] - floor.min[1])),
          '#c5cedb',
          '#dde3ec',
        ]}
        position={[(floor.min[0] + floor.max[0]) / 2, y + 0.003, (floor.min[1] + floor.max[1]) / 2]}
      />
    </group>
  );
}
