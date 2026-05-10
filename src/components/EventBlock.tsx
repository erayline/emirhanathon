import type { CalendarEvent } from '../types';
import { minutesToHHMM } from '../lib/calendar';

type Props = {
  event: CalendarEvent;
  hourHeight: number;
  startHour: number;
  onClick?: () => void;
  onToggleComplete?: (next: boolean) => void;
};

export function EventBlock({
  event,
  hourHeight,
  startHour,
  onClick,
  onToggleComplete,
}: Props) {
  const top = (event.startMinutes - startHour * 60) * (hourHeight / 60);
  const height = Math.max(
    24,
    (event.endMinutes - event.startMinutes) * (hourHeight / 60),
  );
  const palette =
    event.type === 'fixed'
      ? 'bg-fixed/90 hover:bg-fixed border-fixed'
      : 'bg-accent/90 hover:bg-accent border-accent';
  const opacity = event.completed ? 'opacity-50' : '';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.();
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleComplete?.(!event.completed);
  };

  return (
    <div
      onClick={handleClick}
      style={{ top, height }}
      className={`group absolute left-1 right-1 rounded border ${palette} ${opacity} text-left px-1.5 py-1 text-[11px] text-white shadow-sm hover:shadow transition cursor-pointer`}
    >
      {onToggleComplete && (
        <button
          onClick={handleToggle}
          aria-label={event.completed ? 'Mark incomplete' : 'Mark complete'}
          title={event.completed ? 'Mark incomplete' : 'Mark complete'}
          className={`absolute top-0.5 right-0.5 w-4 h-4 rounded-sm border bg-black/20 hover:bg-black/40 text-[10px] leading-none flex items-center justify-center transition ${
            event.completed
              ? 'opacity-100 border-white/60'
              : 'opacity-0 group-hover:opacity-100 border-white/30'
          }`}
        >
          {event.completed ? '✓' : ''}
        </button>
      )}
      <div
        className={`font-semibold truncate leading-tight pr-4 ${
          event.completed ? 'line-through' : ''
        }`}
      >
        {event.title}
      </div>
      <div className="text-[10px] opacity-90">
        {minutesToHHMM(event.startMinutes)} – {minutesToHHMM(event.endMinutes)}
      </div>
    </div>
  );
}
