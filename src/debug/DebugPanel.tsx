import { button, Leva, useControls } from 'leva';
import { useEffect, useRef, useState } from 'react';
import { findUnit, type LoadedProject } from '../config/loadProject';
import type { Transform } from '../config/schema';
import { round, roundVec, scaleVec3, serializeTransform } from '../config/transform';
import { EXTERIOR_KEY, unitKey, useAppStore } from '../state/store';
import { cameraProbe, useDebugStore } from './debugStore';

type XYZ = { x: number; y: number; z: number };
const toXYZ = ([x, y, z]: readonly number[]): XYZ => ({ x: x ?? 0, y: y ?? 0, z: z ?? 0 });
const fromXYZ = (v: XYZ): [number, number, number] => [v.x, v.y, v.z];
const isUniform = (s: Transform['scale']) =>
  typeof s === 'number' || (s[0] === s[1] && s[1] === s[2]);

const transformToLeva = (t: Transform) => ({
  position: toXYZ(t.position),
  'rotation °': toXYZ(t.rotation),
  scale: toXYZ(scaleVec3(t.scale)),
});

/**
 * Live position / rotation / scale sliders for the splat currently on screen (exterior,
 * or the active unit's interior), written to the store as a transform override.
 *
 * One folder that retargets, rather than a folder per splat: leva keeps a folder's inputs
 * after the component that declared them unmounts, which left stale, misleading sliders.
 */
function SplatTransformControls({
  targetKey,
  targetLabel,
  initial,
}: {
  targetKey: string;
  targetLabel: string;
  initial: Transform;
}) {
  const setOverride = useAppStore((s) => s.setTransformOverride);
  const target = useRef({ key: targetKey, initial });
  /** Key whose values the sliders currently show. */
  const syncedKey = useRef(targetKey);

  const [values, set] = useControls('Splat transform', () => {
    const start = useAppStore.getState().transformOverrides[targetKey] ?? initial;
    return {
      editing: { value: targetLabel, editable: false },
      position: { value: toXYZ(start.position), step: 0.05 },
      'rotation °': { value: toXYZ(start.rotation), step: 0.5 },
      scale: {
        value: toXYZ(scaleVec3(start.scale)),
        step: 0.01,
        min: 0.0001,
        lock: true,
        locked: isUniform(start.scale),
      },
      'reset to file': button(() => set(transformToLeva(target.current.initial))),
    };
  });

  const p = values.position;
  const r = values['rotation °'];
  const sc = values.scale;

  // Write slider values to the target. Declared before the retarget effect so that, in the
  // commit where the target changes, the old target's values are NOT written to the new one.
  useEffect(() => {
    if (syncedKey.current !== targetKey) return;
    setOverride(targetKey, { position: fromXYZ(p), rotation: fromXYZ(r), scale: fromXYZ(sc) });
    // Depend on the numbers, not the (re-created) objects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey, setOverride, p.x, p.y, p.z, r.x, r.y, r.z, sc.x, sc.y, sc.z]);

  // Retarget: load the new splat's current values into the sliders.
  useEffect(() => {
    target.current = { key: targetKey, initial };
    if (syncedKey.current === targetKey) return;
    const t = useAppStore.getState().transformOverrides[targetKey] ?? initial;
    set({ editing: targetLabel, ...transformToLeva(t) });
    syncedKey.current = targetKey;
  }, [targetKey, targetLabel, initial, set]);

  return null;
}

/** JSON in the exact shape of project.json, ready to paste. */
function buildSnippet(project: LoadedProject): unknown {
  const st = useAppStore.getState();
  const cam = cameraProbe;
  const unit = findUnit(project, st.activeUnitId);
  if (st.mode === 'interior' && unit) {
    const t = st.transformOverrides[unitKey(unit.id)] ?? unit.interior.transform;
    return {
      unitId: unit.id,
      interior: { transform: serializeTransform(t) },
      // Use as `spawn`, or as a room's position/yaw.
      cameraHere: {
        position: [round(cam.position[0], 2), round(cam.position[2], 2)],
        yaw: round(cam.yaw, 1),
      },
    };
  }
  const ext = project.config.exterior;
  const t = st.transformOverrides[EXTERIOR_KEY] ?? ext.transform;
  return {
    exterior: {
      transform: serializeTransform(t),
      camera: {
        position: roundVec([...cam.position], 2),
        target: roundVec([...(cam.target ?? ext.camera.target)], 2),
      },
    },
  };
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // navigator.clipboard needs a secure context — e.g. not http://192.168.x.x on a phone.
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

/** Small always-on readout of the camera, polled from the probe a few times a second. */
function CameraHud({ flash }: { flash: string | null }) {
  const mode = useAppStore((s) => s.mode);
  const [, tick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 150);
    return () => window.clearInterval(id);
  }, []);
  const f = (n: number) => n.toFixed(2);
  const [x, y, z] = cameraProbe.position;
  return (
    <div className="debug-hud" aria-hidden>
      <div>
        <b>{mode}</b>
        {flash && <span className="debug-hud__flash"> {flash}</span>}
      </div>
      <div>
        pos {f(x)}, {f(y)}, {f(z)}
      </div>
      <div>
        yaw {cameraProbe.yaw.toFixed(1)}° · pitch {cameraProbe.pitch.toFixed(1)}°
      </div>
      {cameraProbe.target && <div>target {cameraProbe.target.map(f).join(', ')}</div>}
    </div>
  );
}

export default function DebugPanel({ project }: { project: LoadedProject }) {
  const isMobile = useAppStore((s) => s.isMobile);
  const mode = useAppStore((s) => s.mode);
  const unit = useAppStore((s) => findUnit(project, s.activeUnitId));
  const [flash, setFlash] = useState<string | null>(null);
  const inside = mode === 'interior' && unit !== undefined;

  useControls('Helpers', {
    collision: {
      value: useDebugStore.getState().showCollision,
      onChange: (v: boolean) => useDebugStore.setState({ showCollision: v }),
    },
    rooms: {
      value: useDebugStore.getState().showRooms,
      onChange: (v: boolean) => useDebugStore.setState({ showRooms: v }),
    },
    'axes/grid': {
      value: useDebugStore.getState().showGrid,
      onChange: (v: boolean) => useDebugStore.setState({ showGrid: v }),
    },
    fps: {
      value: useDebugStore.getState().showStats,
      onChange: (v: boolean) => useDebugStore.setState({ showStats: v }),
    },
  });

  useControls(
    'Output',
    {
      'Copy config': button(() => {
        const json = JSON.stringify(buildSnippet(project), null, 2);
        console.info('[debug] config snippet\n' + json);
        void copyText(json).then((ok) => {
          setFlash(ok ? 'copied ✓' : 'copy failed — see console');
          window.setTimeout(() => setFlash(null), 1800);
        });
      }),
    },
    [project],
  );

  return (
    <>
      <Leva collapsed={isMobile} titleBar={{ title: 'Debug' }} />
      <SplatTransformControls
        targetKey={inside ? unitKey(unit.id) : EXTERIOR_KEY}
        targetLabel={inside ? `interior · ${unit.id}` : 'exterior'}
        initial={inside ? unit.interior.transform : project.config.exterior.transform}
      />
      <CameraHud flash={flash} />
    </>
  );
}
