import { useEffect, useState } from 'react';
import type { Mode } from '../state/store';
import { useAppStore } from '../state/store';

const HINT_VISIBLE_MS = 6000;

function hintText(mode: Mode, touch: boolean): string[] {
  if (mode === 'exterior') {
    return touch
      ? ['Drag to orbit', 'Pinch to zoom', 'Tap a marker to see a unit']
      : ['Drag to orbit', 'Scroll to zoom', 'Click a marker to see a unit'];
  }
  return touch
    ? ['Drag to look around', 'Tap the floor to move', 'Use the room buttons to jump']
    : [
        'WASD / arrow keys to walk',
        'Hold Shift to walk faster',
        'Drag to look · click the floor to move',
      ];
}

/** "?" button with a controls hint that also pops up briefly whenever the mode changes. */
export function HelpHint({ mode }: { mode: Mode }) {
  const touch = useAppStore((s) => s.isMobile);
  const ready = useAppStore((s) => s.transition === 'none' && Object.keys(s.loading).length === 0);
  const [open, setOpen] = useState(false);
  const [shownFor, setShownFor] = useState<Mode | null>(null);

  // Auto-show once per mode change, after loading/transition is finished.
  if (ready && shownFor !== mode) {
    setShownFor(mode);
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => setOpen(false), HINT_VISIBLE_MS);
    return () => window.clearTimeout(t);
  }, [open, shownFor]);

  return (
    <div className="help">
      {open && (
        <ul className="help__hint" id="help-hint">
          {hintText(mode, touch).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className="help__btn"
        aria-label="Show controls"
        aria-expanded={open}
        aria-controls="help-hint"
        onClick={() => setOpen((o) => !o)}
      >
        ?
      </button>
    </div>
  );
}
