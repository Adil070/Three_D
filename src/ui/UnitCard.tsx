import type { Unit } from '../config/schema';
import { useAppStore } from '../state/store';
import { formatArea, STATUS_COLORS, STATUS_LABELS } from './theme';

export function UnitCard({ unit }: { unit: Unit }) {
  const selectUnit = useAppStore((s) => s.selectUnit);
  const requestEnterUnit = useAppStore((s) => s.requestEnterUnit);

  return (
    <section className="card unit-card" aria-label={`${unit.name} details`}>
      <button
        type="button"
        className="unit-card__close"
        aria-label="Close"
        onClick={() => selectUnit(null)}
      >
        ×
      </button>
      <h2>{unit.name}</h2>
      <span className="status" style={{ ['--status' as string]: STATUS_COLORS[unit.status] }}>
        {STATUS_LABELS[unit.status]}
      </span>
      <dl className="unit-card__facts">
        <div>
          <dt>Type</dt>
          <dd>{unit.type}</dd>
        </div>
        <div>
          <dt>Area</dt>
          <dd>{formatArea(unit.areaSqFt)}</dd>
        </div>
        <div>
          <dt>Floor</dt>
          <dd>{unit.floor}</dd>
        </div>
      </dl>
      <button type="button" className="btn btn--primary" onClick={() => requestEnterUnit(unit.id)}>
        Enter apartment
      </button>
    </section>
  );
}
