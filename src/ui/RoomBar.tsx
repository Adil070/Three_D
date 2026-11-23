import type { Room } from '../config/schema';
import { useAppStore } from '../state/store';

/** Horizontally scrollable room shortcuts; fits a 380px phone by scrolling, not wrapping. */
export function RoomBar({ rooms, current }: { rooms: Room[]; current: string | null }) {
  const requestRoom = useAppStore((s) => s.requestRoom);
  if (rooms.length === 0) return null;
  return (
    <nav className="roombar" aria-label="Rooms">
      {rooms.map((r) => (
        <button
          key={r.name}
          type="button"
          className={`chip${r.name === current ? ' chip--active' : ''}`}
          aria-current={r.name === current ? 'location' : undefined}
          onClick={() => requestRoom(r.name)}
        >
          {r.name}
        </button>
      ))}
    </nav>
  );
}
