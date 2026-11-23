import { useMemo } from 'react';
import type { ExteriorConfig } from '../config/schema';

const FLOOR_HEIGHT = 3.2;

/**
 * Procedural tower used when the exterior (drone) splat is missing.
 * Sized around the hotspots so they sit on its facade.
 */
export function PlaceholderBuilding({ exterior }: { exterior: ExteriorConfig }) {
  const { cx, cz, halfW, halfD, floors } = useMemo(() => {
    const [tx, , tz] = exterior.camera.target;
    let hw = 7;
    let hd = 7;
    let top = 24;
    for (const h of exterior.hotspots) {
      hw = Math.max(hw, Math.abs(h.position[0] - tx) - 0.3);
      hd = Math.max(hd, Math.abs(h.position[2] - tz) - 0.3);
      top = Math.max(top, h.position[1] + 6);
    }
    return { cx: tx, cz: tz, halfW: hw, halfD: hd, floors: Math.ceil(top / FLOOR_HEIGHT) };
  }, [exterior]);

  const height = floors * FLOOR_HEIGHT;

  return (
    <group position={[cx, 0, cz]}>
      <hemisphereLight args={['#ffffff', '#cdd6e3', 1.4]} />
      <directionalLight position={[30, 60, 40]} intensity={1.6} />

      {/* Ground */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.01}>
        <circleGeometry args={[160, 48]} />
        <meshStandardMaterial color="#e3e8ef" roughness={1} />
      </mesh>
      <gridHelper args={[160, 40, '#cfd8e4', '#dde4ee']} />

      {/* Podium */}
      <mesh position-y={1}>
        <boxGeometry args={[halfW * 2 + 6, 2, halfD * 2 + 6]} />
        <meshStandardMaterial color="#d5dce6" roughness={0.9} />
      </mesh>

      {/* Core */}
      <mesh position-y={height / 2}>
        <boxGeometry args={[halfW * 2 - 0.4, height, halfD * 2 - 0.4]} />
        <meshStandardMaterial color="#c9d3e0" roughness={0.8} />
      </mesh>

      {Array.from({ length: floors }, (_, i) => {
        const y = i * FLOOR_HEIGHT;
        return (
          <group key={i} position-y={y}>
            {/* glazing band */}
            <mesh position-y={FLOOR_HEIGHT / 2 + 0.1}>
              <boxGeometry args={[halfW * 2 - 0.2, FLOOR_HEIGHT - 0.7, halfD * 2 - 0.2]} />
              <meshStandardMaterial color="#8ea9cc" roughness={0.25} metalness={0.4} />
            </mesh>
            {/* slab */}
            <mesh position-y={0.15}>
              <boxGeometry args={[halfW * 2 + 0.4, 0.3, halfD * 2 + 0.4]} />
              <meshStandardMaterial color="#f5f7fa" roughness={0.9} />
            </mesh>
          </group>
        );
      })}

      {/* Roof */}
      <mesh position-y={height + 0.2}>
        <boxGeometry args={[halfW * 2 + 0.4, 0.4, halfD * 2 + 0.4]} />
        <meshStandardMaterial color="#f5f7fa" roughness={0.9} />
      </mesh>
    </group>
  );
}
