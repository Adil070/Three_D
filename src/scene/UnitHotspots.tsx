import { Html } from '@react-three/drei';
import type { LoadedProject } from '../config/loadProject';
import { useAppStore } from '../state/store';
import { STATUS_COLORS, STATUS_LABELS } from '../ui/theme';

/** Tappable unit markers anchored to the building, coloured by sales status. */
export function UnitHotspots({ project }: { project: LoadedProject }) {
  const selectedUnitId = useAppStore((s) => s.selectedUnitId);
  const selectUnit = useAppStore((s) => s.selectUnit);
  const hidden = useAppStore((s) => s.transition !== 'none' || !s.exteriorReady);
  const units = project.config.units;

  if (hidden) return null;

  return (
    <>
      {project.config.exterior.hotspots.map((h) => {
        const unit = units.find((u) => u.id === h.unitId);
        if (!unit) return null;
        const selected = selectedUnitId === unit.id;
        return (
          <Html key={h.unitId} position={h.position} center zIndexRange={[20, 0]}>
            <button
              type="button"
              className={`hotspot${selected ? ' hotspot--selected' : ''}`}
              style={{ ['--status' as string]: STATUS_COLORS[unit.status] }}
              aria-label={`${h.label}, ${STATUS_LABELS[unit.status]}`}
              aria-pressed={selected}
              onClick={(e) => {
                e.stopPropagation();
                selectUnit(selected ? null : unit.id);
              }}
            >
              <span className="hotspot__dot" aria-hidden />
              <span className="hotspot__label">{h.label}</span>
            </button>
          </Html>
        );
      })}
    </>
  );
}
