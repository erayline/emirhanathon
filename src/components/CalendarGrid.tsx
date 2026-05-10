import type { CalendarEvent, Day } from '../types';
import {
  getDatesForWeek,
  minutesToHHMM,
  nowMinutes,
  todayDayIndex,
  visibleHours,
} from '../lib/calendar';
import {
  CALENDAR_END_HOUR,
  CALENDAR_START_HOUR,
  DAY_LABELS,
} from '../constants';
import { EventBlock } from './EventBlock';

const HOUR_HEIGHT = 48;
const TOTAL_HEIGHT = (CALENDAR_END_HOUR - CALENDAR_START_HOUR) * HOUR_HEIGHT;
const SLOT_MIN = 30; // snap quick-add to 30-minute slots

type Props = {
  events: CalendarEvent[];
  onEventClick?: (e: CalendarEvent) => void;
  /** Click on an empty slot in a day column. Receives day + start minutes. */
  onSlotClick?: (day: Day, startMinutes: number) => void;
  onToggleComplete?: (e: CalendarEvent, next: boolean) => void;
};

export function CalendarGrid({
  events,
  onEventClick,
  onSlotClick,
  onToggleComplete,
}: Props) {
  const today = todayDayIndex();
  const weekDates = getDatesForWeek();
  const hours = visibleHours();
  const now = nowMinutes();
  const nowTop =
    now >= CALENDAR_START_HOUR * 60 && now < CALENDAR_END_HOUR * 60
      ? (now - CALENDAR_START_HOUR * 60) * (HOUR_HEIGHT / 60)
      : null;

  const handleSlotClick = (
    e: React.MouseEvent<HTMLDivElement>,
    dayIdx: Day,
  ) => {
    if (!onSlotClick) return;
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const minutesFromStart = (y / HOUR_HEIGHT) * 60;
    const absoluteMinutes =
      Math.round((CALENDAR_START_HOUR * 60 + minutesFromStart) / SLOT_MIN) *
      SLOT_MIN;
    const clamped = Math.max(
      CALENDAR_START_HOUR * 60,
      Math.min(CALENDAR_END_HOUR * 60 - 60, absoluteMinutes),
    );
    onSlotClick(dayIdx, clamped);
  };

  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      <div className="grid grid-cols-[60px_repeat(7,_1fr)] border-b border-border">
        <div />
        {weekDates.map((d, i) => (
          <div
            key={i}
            className={`px-2 py-2 text-xs border-l border-border ${
              i === today
                ? 'bg-bg text-accent font-semibold'
                : 'text-muted'
            }`}
          >
            <div>{DAY_LABELS[i]}</div>
            <div className="text-[11px] opacity-80">
              {d.getDate()}/{d.getMonth() + 1}
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[60px_repeat(7,_1fr)] relative">
        <div
          style={{ height: TOTAL_HEIGHT }}
          className="border-r border-border relative"
        >
          {hours.map((h) => (
            <div
              key={h}
              style={{ top: (h - CALENDAR_START_HOUR) * HOUR_HEIGHT }}
              className="absolute right-1 text-[10px] text-muted -translate-y-1/2"
            >
              {minutesToHHMM(h * 60)}
            </div>
          ))}
        </div>
        {Array.from({ length: 7 }, (_, i) => i as Day).map((dayIdx) => {
          const dayEvents = events.filter((e) => e.day === dayIdx);
          return (
            <div
              key={dayIdx}
              onClick={(e) => handleSlotClick(e, dayIdx)}
              className={`relative border-l border-border ${
                dayIdx === today ? 'bg-bg/40' : ''
              } ${onSlotClick ? 'cursor-cell hover:bg-bg/60' : ''}`}
              style={{ height: TOTAL_HEIGHT }}
              title={onSlotClick ? 'Click to add an event here' : undefined}
            >
              {hours.map((h) => (
                <div
                  key={h}
                  style={{
                    top: (h - CALENDAR_START_HOUR) * HOUR_HEIGHT,
                    height: HOUR_HEIGHT,
                  }}
                  className="absolute left-0 right-0 border-b border-border/50 pointer-events-none"
                />
              ))}
              {dayIdx === today && nowTop !== null && (
                <div
                  style={{ top: nowTop }}
                  className="absolute left-0 right-0 h-px bg-accent z-10 pointer-events-none"
                >
                  <div className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-accent" />
                </div>
              )}
              {dayEvents.map((ev) => (
                <EventBlock
                  key={ev.id}
                  event={ev}
                  hourHeight={HOUR_HEIGHT}
                  startHour={CALENDAR_START_HOUR}
                  onClick={onEventClick ? () => onEventClick(ev) : undefined}
                  onToggleComplete={
                    onToggleComplete
                      ? (next) => onToggleComplete(ev, next)
                      : undefined
                  }
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CalendarLegend() {
  return (
    <div className="flex items-center gap-4 text-[11px] text-muted px-1">
      <span className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-sm bg-fixed" /> fixed (class /
        meeting)
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-sm bg-accent" /> task (triggers
        nudges)
      </span>
      <span className="flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-sm bg-accent opacity-40" />{' '}
        completed
      </span>
      <span className="ml-auto text-muted/80">
        click an empty slot to add · ✓ on hover to complete
      </span>
    </div>
  );
}
