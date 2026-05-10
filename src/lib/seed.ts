import type { BehaviorLog, CalendarEvent, Day } from '../types';
import { behaviorStore, eventsStore } from './storage';
import { hhmmToMinutes, isoDate, newEventId } from './calendar';
import { todayDayIndex } from './calendar';

type SeedSpec = {
  title: string;
  day: Day;
  start: string;
  end: string;
  type: 'fixed' | 'task';
  recurring?: boolean;
};

// 14-line "university timetable" + a couple of personal tasks
const DEFAULT_EVENTS: SeedSpec[] = [
  // Monday
  { title: 'CMP 250 Algorithms', day: 0, start: '09:00', end: '10:30', type: 'fixed', recurring: true },
  { title: 'CMP 270 Database Lab', day: 0, start: '13:00', end: '15:00', type: 'fixed', recurring: true },
  // Tuesday
  { title: 'MAT 234 Linear Algebra', day: 1, start: '10:00', end: '11:30', type: 'fixed', recurring: true },
  { title: 'PHY 110 Physics II', day: 1, start: '14:00', end: '16:00', type: 'fixed', recurring: true },
  // Wednesday
  { title: 'CMP 250 Algorithms', day: 2, start: '09:00', end: '10:30', type: 'fixed', recurring: true },
  { title: 'ENG 201 Technical English', day: 2, start: '11:00', end: '12:00', type: 'fixed', recurring: true },
  { title: 'CMP 312 Operating Systems', day: 2, start: '15:00', end: '17:00', type: 'fixed', recurring: true },
  // Thursday
  { title: 'MAT 234 Linear Algebra', day: 3, start: '10:00', end: '11:30', type: 'fixed', recurring: true },
  { title: 'CMP 312 Operating Systems Lab', day: 3, start: '13:00', end: '15:00', type: 'fixed', recurring: true },
  // Friday
  { title: 'CMP 270 Database', day: 4, start: '09:00', end: '10:30', type: 'fixed', recurring: true },
  { title: 'PHY 110 Physics II Lab', day: 4, start: '13:00', end: '15:00', type: 'fixed', recurring: true },
  // Sat (study)
  { title: 'Read literature paper', day: 5, start: '11:00', end: '13:00', type: 'task' },
  // Sun
  { title: 'Plan next week', day: 6, start: '20:00', end: '21:00', type: 'task', recurring: true },
];

function eventFromSpec(spec: SeedSpec): CalendarEvent {
  return {
    id: newEventId(),
    title: spec.title,
    day: spec.day,
    startMinutes: hhmmToMinutes(spec.start),
    endMinutes: hhmmToMinutes(spec.end),
    recurring: spec.recurring ?? false,
    type: spec.type,
    completed: false,
    createdAt: Date.now(),
  };
}

/** Pre-existing tasks at a near-future hour on today, useful for live demos. */
function todaysDemoTask(now: Date): SeedSpec {
  const startHour = Math.min(22, Math.max(8, now.getHours()));
  const start = `${String(startHour).padStart(2, '0')}:00`;
  const end = `${String(Math.min(23, startHour + 2)).padStart(2, '0')}:00`;
  return {
    title: 'Write the report',
    day: todayDayIndex(now),
    start,
    end,
    type: 'task',
  };
}

/** Plausible browsing logs spread across the last 3 days. */
function buildBehaviorLogs(now: Date): { date: string; logs: BehaviorLog[] }[] {
  const out: { date: string; logs: BehaviorLog[] }[] = [];
  for (let offset = 2; offset >= 0; offset--) {
    const d = new Date(now);
    d.setDate(d.getDate() - offset);
    const date = isoDate(d);
    const logs: BehaviorLog[] = [
      { date, domain: 'github.com', hourBucket: 9, durationMs: 22 * 60_000 },
      { date, domain: 'youtube.com', hourBucket: 11, durationMs: 14 * 60_000 },
      { date, domain: 'github.com', hourBucket: 13, durationMs: 35 * 60_000 },
      { date, domain: 'twitter.com', hourBucket: 15, durationMs: 18 * 60_000 },
      { date, domain: 'youtube.com', hourBucket: 20, durationMs: 32 * 60_000 },
      { date, domain: 'wikipedia.org', hourBucket: 21, durationMs: 12 * 60_000 },
    ];
    if (offset === 0) {
      logs.push({
        date,
        domain: 'youtube.com',
        hourBucket: now.getHours(),
        durationMs: 6 * 60_000,
      });
    }
    out.push({ date, logs });
  }
  return out;
}

export async function seedDemoData(): Promise<{
  events: number;
  behaviorDays: number;
}> {
  const now = new Date();
  const events = [...DEFAULT_EVENTS, todaysDemoTask(now)].map(eventFromSpec);
  await eventsStore.save(events);

  const days = buildBehaviorLogs(now);
  for (const { date, logs } of days) {
    await behaviorStore.saveForDate(date, logs);
  }

  return { events: events.length, behaviorDays: days.length };
}

export async function clearAllData(): Promise<void> {
  await chrome.storage.local.clear();
}
