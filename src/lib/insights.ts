import type { BehaviorLog, CalendarEvent } from '../types';
import { behaviorStore } from './storage';
import {
  isoDate,
  todayDayIndex,
  nowMinutes,
  minutesToHHMM,
} from './calendar';
import { DAY_LABELS, DISTRACTION_DOMAINS } from '../constants';

export type DomainTotal = {
  domain: string;
  durationMs: number;
};

export function topDomainsFromLogs(
  logs: BehaviorLog[],
  limit = 5,
): DomainTotal[] {
  const totals = new Map<string, number>();
  for (const l of logs) {
    totals.set(l.domain, (totals.get(l.domain) ?? 0) + l.durationMs);
  }
  return Array.from(totals.entries())
    .map(([domain, durationMs]) => ({ domain, durationMs }))
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, limit);
}

export function formatDurationMs(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${m}m`;
}

/** Returns a one-line summary like "youtube.com 28m, github.com 14m, …" */
export async function summarizeBehaviorToday(): Promise<string> {
  const today = isoDate(new Date());
  const logs = await behaviorStore.forDate(today);
  if (logs.length === 0) return '';
  const top = topDomainsFromLogs(logs, 5);
  return top.map((t) => `${t.domain} ${formatDurationMs(t.durationMs)}`).join(', ');
}

export function summarizeTasksToday(events: CalendarEvent[]): string {
  const day = todayDayIndex();
  const now = nowMinutes();
  const todays = events
    .filter((e) => e.day === day)
    .sort((a, b) => a.startMinutes - b.startMinutes);
  if (todays.length === 0) return '';
  return todays
    .map((e) => {
      const status = e.completed
        ? 'done'
        : e.startMinutes <= now && now < e.endMinutes
          ? 'active now'
          : now < e.startMinutes
            ? 'upcoming'
            : 'past';
      return `${minutesToHHMM(e.startMinutes)}-${minutesToHHMM(e.endMinutes)} ${e.title} (${e.type}, ${status})`;
    })
    .join('; ');
}

// ---- Weekly aggregation for insight card ----

export type DayHourCell = {
  day: number; // 0=Mon..6=Sun
  hour: number; // 0..23
  durationMs: number;
};

export type WeeklyAggregate = {
  weekStartISO: string;
  cells: DayHourCell[]; // all browsing (sparse)
  distractionCells: DayHourCell[]; // distraction-domain browsing only (sparse)
  byDay: Map<number, number>; // total ms per day (all browsing)
  byHour: Map<number, number>; // total ms per hour-of-day (all browsing)
  distractionByDay: Map<number, number>; // distraction-only ms per day
  distractionByHour: Map<number, number>; // distraction-only ms per hour
  topDistractions: DomainTotal[];
  topAllDomains: DomainTotal[]; // top domains regardless of category
  totalDistractionMs: number;
  totalBrowsingMs: number;
};

const DAYS_IN_WEEK = 7;

function weekDates(now: Date = new Date()): { iso: string[]; weekStartISO: string } {
  const dayIdx = todayDayIndex(now);
  const monday = new Date(now);
  monday.setDate(monday.getDate() - dayIdx);
  monday.setHours(0, 0, 0, 0);
  const iso: string[] = [];
  for (let i = 0; i < DAYS_IN_WEEK; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    iso.push(isoDate(d));
  }
  return { iso, weekStartISO: iso[0] };
}

export async function aggregateWeek(now: Date = new Date()): Promise<WeeklyAggregate> {
  const { iso, weekStartISO } = weekDates(now);
  const allLogs = await behaviorStore.forRange(iso);
  // Map date -> day index
  const dateToDayIdx = new Map<string, number>();
  iso.forEach((d, i) => dateToDayIdx.set(d, i));

  const cellMap = new Map<string, DayHourCell>();
  const distractionCellMap = new Map<string, DayHourCell>();
  const byDay = new Map<number, number>();
  const byHour = new Map<number, number>();
  const distractionByDay = new Map<number, number>();
  const distractionByHour = new Map<number, number>();
  const distractionTotals = new Map<string, number>();
  const allDomainTotals = new Map<string, number>();
  let totalDistractionMs = 0;
  let totalBrowsingMs = 0;
  const distractionSet = new Set<string>(DISTRACTION_DOMAINS);

  for (const log of allLogs) {
    const day = dateToDayIdx.get(log.date);
    if (day === undefined) continue;
    const key = `${day}:${log.hourBucket}`;
    const cell = cellMap.get(key) ?? {
      day,
      hour: log.hourBucket,
      durationMs: 0,
    };
    cell.durationMs += log.durationMs;
    cellMap.set(key, cell);
    byDay.set(day, (byDay.get(day) ?? 0) + log.durationMs);
    byHour.set(log.hourBucket, (byHour.get(log.hourBucket) ?? 0) + log.durationMs);
    allDomainTotals.set(
      log.domain,
      (allDomainTotals.get(log.domain) ?? 0) + log.durationMs,
    );
    totalBrowsingMs += log.durationMs;
    if (distractionSet.has(log.domain)) {
      const dCell = distractionCellMap.get(key) ?? {
        day,
        hour: log.hourBucket,
        durationMs: 0,
      };
      dCell.durationMs += log.durationMs;
      distractionCellMap.set(key, dCell);
      distractionByDay.set(
        day,
        (distractionByDay.get(day) ?? 0) + log.durationMs,
      );
      distractionByHour.set(
        log.hourBucket,
        (distractionByHour.get(log.hourBucket) ?? 0) + log.durationMs,
      );
      distractionTotals.set(
        log.domain,
        (distractionTotals.get(log.domain) ?? 0) + log.durationMs,
      );
      totalDistractionMs += log.durationMs;
    }
  }

  const topDistractions = Array.from(distractionTotals.entries())
    .map(([domain, durationMs]) => ({ domain, durationMs }))
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 5);

  const topAllDomains = Array.from(allDomainTotals.entries())
    .map(([domain, durationMs]) => ({ domain, durationMs }))
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 8);

  return {
    weekStartISO,
    cells: Array.from(cellMap.values()),
    distractionCells: Array.from(distractionCellMap.values()),
    byDay,
    byHour,
    distractionByDay,
    distractionByHour,
    topDistractions,
    topAllDomains,
    totalDistractionMs,
    totalBrowsingMs,
  };
}

// ---- Pure summary helpers (no AI) ----

export function dailyDistractionTotals(agg: WeeklyAggregate): number[] {
  return [0, 1, 2, 3, 4, 5, 6].map((d) => agg.distractionByDay.get(d) ?? 0);
}

export function dailyAllTotals(agg: WeeklyAggregate): number[] {
  return [0, 1, 2, 3, 4, 5, 6].map((d) => agg.byDay.get(d) ?? 0);
}

export function peakDay(
  agg: WeeklyAggregate,
): { day: number; ms: number } | null {
  let best: { day: number; ms: number } | null = null;
  for (const [day, ms] of agg.distractionByDay.entries()) {
    if (!best || ms > best.ms) best = { day, ms };
  }
  return best;
}

export function peakHour(
  agg: WeeklyAggregate,
): { hour: number; ms: number } | null {
  let best: { hour: number; ms: number } | null = null;
  for (const [hour, ms] of agg.distractionByHour.entries()) {
    if (!best || ms > best.ms) best = { hour, ms };
  }
  return best;
}

export function formatWeeklyAggregate(agg: WeeklyAggregate): string {
  const lines: string[] = [];
  lines.push(`Week starting ${agg.weekStartISO}`);
  lines.push(
    `Top distractions: ${
      agg.topDistractions.length === 0
        ? 'none'
        : agg.topDistractions
            .map((d) => `${d.domain} ${formatDurationMs(d.durationMs)}`)
            .join(', ')
    }`,
  );
  // Per-day distraction time
  const perDay: string[] = [];
  for (let d = 0; d < 7; d++) {
    const ms = agg.byDay.get(d) ?? 0;
    if (ms > 0) perDay.push(`${DAY_LABELS[d]} ${formatDurationMs(ms)}`);
  }
  lines.push(`Daily browsing: ${perDay.length > 0 ? perDay.join(', ') : 'none'}`);
  // Heaviest hours
  const heaviestHours = Array.from(agg.byHour.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([h, ms]) => `${String(h).padStart(2, '0')}:00 ${formatDurationMs(ms)}`);
  lines.push(`Heaviest hours: ${heaviestHours.join(', ') || 'none'}`);
  return lines.join('\n');
}

export function tasksScheduledThisWeek(events: CalendarEvent[]): number {
  return events.filter((e) => e.type === 'task').length;
}

export function tasksCompletedThisWeek(events: CalendarEvent[]): number {
  return events.filter((e) => e.type === 'task' && e.completed).length;
}
