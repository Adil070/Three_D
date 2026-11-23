import { useAppStore } from '../state/store';

/** White veil that hides scene swaps during exterior ↔ interior transitions. */
export function FadeVeil() {
  const fade = useAppStore((s) => s.fade);
  return <div className={`fade-veil${fade ? ' fade-veil--on' : ''}`} aria-hidden />;
}
