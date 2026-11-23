import { findUnit, type LoadedProject } from '../config/loadProject';
import { useAppStore } from '../state/store';
import { HelpHint } from './HelpHint';
import { RoomBar } from './RoomBar';
import { UnitCard } from './UnitCard';

/** HTML overlay above the canvas. Everything here is plain React — no three.js. */
export function Overlay({ project }: { project: LoadedProject }) {
  const mode = useAppStore((s) => s.mode);
  const busy = useAppStore((s) => s.transition !== 'none');
  const currentRoom = useAppStore((s) => s.currentRoom);
  const activeUnit = useAppStore((s) => findUnit(project, s.activeUnitId));
  const selectedUnit = useAppStore((s) => findUnit(project, s.selectedUnitId));
  const requestExit = useAppStore((s) => s.requestExit);
  const { name, location } = project.config.project;
  const inside = mode === 'interior' && activeUnit;

  return (
    <div className={`overlay${busy ? ' overlay--busy' : ''}`}>
      <header className="topbar">
        {inside && (
          <button type="button" className="btn btn--back" onClick={requestExit}>
            <span aria-hidden>←</span> Building
          </button>
        )}
        <div className="topbar__title">
          <h1>{name}</h1>
          <p>{inside ? `${activeUnit.name} · ${activeUnit.type}` : location}</p>
        </div>
        <HelpHint mode={mode} />
      </header>

      <footer className="bottombar">
        {inside ? (
          <>
            {currentRoom && (
              <div className="room-pill" aria-live="polite">
                {currentRoom}
              </div>
            )}
            <RoomBar rooms={activeUnit.interior.rooms} current={currentRoom} />
          </>
        ) : (
          selectedUnit && <UnitCard unit={selectedUnit} />
        )}
      </footer>
    </div>
  );
}
