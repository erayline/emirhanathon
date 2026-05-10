import type { CalendarEvent, Day } from '../types';
import { CALENDAR_END_HOUR, CALENDAR_START_HOUR } from '../constants';

/** 0=Mon..6=Sun (spec convention; JS Date: 0=Sun..6=Sat) */
export function jsDayToWeekIndex(jsDay: number): Day {
  return (((jsDay + 6) % 7) as Day);
}

export function todayDayIndex(now: Date = new Date()): Day {
  return jsDayToWeekIndex(now.getDay());
}

export function nowMinutes(now: Date = new Date()): number {
  return now.getHours() * 60 + now.getMinutes();
}

export function minutesToHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function hhmmToMinutes(s: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function getCurrentTask(
  events: CalendarEvent[],
  now: Date = new Date(),
): CalendarEvent | null {
  const day = todayDayIndex(now);
  const minutes = nowMinutes(now);
  return (
    events.find(
      (e) =>
        !e.completed &&
        e.type === 'task' &&
        e.day === day &&
        e.startMinutes <= minutes &&
        minutes < e.endMinutes,
    ) ?? null
  );
}

export function getDatesForWeek(now: Date = new Date()): Date[] {
  const monday = new Date(now);
  const dayIdx = jsDayToWeekIndex(now.getDay());
  monday.setDate(monday.getDate() - dayIdx);
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function weekStartISO(now: Date = new Date()): string {
  return isoDate(getDatesForWeek(now)[0]);
}

export function visibleHours(): number[] {
  const hours: number[] = [];
  for (let h = CALENDAR_START_HOUR; h < CALENDAR_END_HOUR; h++) hours.push(h);
  return hours;
}

export function newEventId(): string {
  return `e_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function validateEvent(e: Pick<CalendarEvent, 'startMinutes' | 'endMinutes' | 'day' | 'title'>): string | null {
  if (!e.title.trim()) return 'Title is required';
  if (e.startMinutes < 0 || e.startMinutes >= 24 * 60) return 'Invalid start time';
  if (e.endMinutes <= e.startMinutes) return 'End must be after start';
  if (e.endMinutes > 24 * 60) return 'Event must end same day';
  if (e.day < 0 || e.day > 6) return 'Invalid day';
  return null;
}
