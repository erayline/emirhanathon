import { useEffect, useMemo, useState } from 'react';
import {
  CalendarGrid,
  CalendarLegend,
} from '../../src/components/CalendarGrid';
import { EventModal } from '../../src/components/EventModal';
import { Heatmap } from '../../src/components/Heatmap';
import { InsightCard } from '../../src/components/InsightCard';
import { StatCards } from '../../src/components/StatCards';
import { DomainBars } from '../../src/components/DomainBars';
import { DailyBars } from '../../src/components/DailyBars';
import { Toast, type ToastState } from '../../src/components/Toast';
import { useTasks } from '../../src/state/tasks';
import { useBehavior } from '../../src/state/behavior';
import {
  formatDurationMs,
  dailyDistractionTotals,
  peakDay,
  peakHour,
  tasksCompletedThisWeek,
  tasksScheduledThisWeek,
} from '../../src/lib/insights';
import { seedDemoData } from '../../src/lib/seed';
import { getCurrentTask, minutesToHHMM } from '../../src/lib/calendar';
import { DAY_NAMES_FULL } from '../../src/constants';
import type { CalendarEvent, Day } from '../../src/types';

type ModalState =
  | { open: false }
  | { open: true; mode: 'create'; defaults?: Partial<CalendarEvent> }
  | { open: true; mode: 'edit'; event: CalendarEvent };

export default function App() {
  const events = useTasks((s) => s.events);
  const load = useTasks((s) => s.load);
  const refresh = useTasks((s) => s.refresh);
  const add = useTasks((s) => s.add);
  const update = useTasks((s) => s.update);
  const remove = useTasks((s) => s.remove);

  const weekly = useBehavior((s) => s.weekly);
  const loadBehavior = useBehavior((s) => s.load);
  const refreshBehavior = useBehavior((s) => s.refresh);

  const [modal, setModal] = useState<ModalState>({ open: false });
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    load();
    loadBehavior();
  }, [load, loadBehavior]);

  useEffect(() => {
    const onChanged = (changes: Record<string, chrome.storage.StorageChange>) => {
      const refreshKeys = Object.keys(changes).filter((k) =>
        k.startsWith('behavior:'),
      );
      if (refreshKeys.length > 0) refreshBehavior();
    };
    chrome.storage?.onChanged.addListener(onChanged);
    return () => chrome.storage?.onChanged.removeListener(onChanged);
  }, [refreshBehavior]);

  const handleSave = async (e: CalendarEvent) => {
    if (modal.open && modal.mode === 'edit') {
      await update(e.id, e);
    } else {
      await add(e);
    }
  };

  const handleSlotClick = (day: Day, startMinutes: number) => {
    setModal({
      open: true,
      mode: 'create',
      defaults: {
        day,
        startMinutes,
        endMinutes: Math.min(24 * 60, startMinutes + 60),
      },
    });
  };

  const handleToggleComplete = async (e: CalendarEvent, next: boolean) => {
    await update(e.id, { completed: next });
  };

  const initialEvent = modal.open && modal.mode === 'edit' ? modal.event : null;
  const modalMode = modal.open ? modal.mode : 'create';
  const modalDefaults =
    modal.open && modal.mode === 'create' ? modal.defaults : undefined;

  // ---- Derived: behavior stats ----
  const stats = useMemo(() => {
    if (!weekly) return null;
    const pDay = peakDay(weekly);
    const pHour = peakHour(weekly);
    const completed = tasksCompletedThisWeek(events);
    const scheduled = tasksScheduledThisWeek(events);
    const distractionShare =
      weekly.totalBrowsingMs > 0
        ? Math.round((weekly.totalDistractionMs / weekly.totalBrowsingMs) * 100)
        : 0;
    return {
      totalDistractionMs: weekly.totalDistractionMs,
      totalBrowsingMs: weekly.totalBrowsingMs,
      distractionShare,
      pDay,
      pHour,
      completed,
      scheduled,
    };
  }, [weekly, events]);

  const activeTask = useMemo(() => getCurrentTask(events), [events]);
  const dailyDistraction = useMemo(
    () => (weekly ? dailyDistractionTotals(weekly) : new Array(7).fill(0)),
    [weekly],
  );

  return (
    <div className="min-h-full bg-bg text-text">
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">PlanFlow</h1>
          <p className="text-sm text-muted">your week at a glance</p>
        </div>
        <div className="flex items-center gap-2">
          {activeTask && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/30 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              <span className="text-muted">active now:</span>
              <span className="text-accent font-medium">
                {activeTask.title}
              </span>
              <span className="text-muted">
                until {minutesToHHMM(activeTask.endMinutes)}
              </span>
            </div>
          )}
          <button
            onClick={() => setModal({ open: true, mode: 'create' })}
            className="btn btn-primary"
          >
            + Add event
          </button>
        </div>
      </header>

      <main className="px-6 py-6 max-w-[1200px] mx-auto space-y-6">
        {/* ---- Calendar ---- */}
        <section className="space-y-2">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              This week
            </h2>
            <p className="text-xs text-muted">
              {events.length === 0
                ? 'no events yet'
                : `${events.length} event${events.length === 1 ? '' : 's'}`}
            </p>
          </div>
          <CalendarGrid
            events={events}
            onEventClick={(e) =>
              setModal({ open: true, mode: 'edit', event: e })
            }
            onSlotClick={handleSlotClick}
            onToggleComplete={handleToggleComplete}
          />
          <CalendarLegend />
          {events.length === 0 && (
            <div className="text-center text-xs text-muted mt-3 space-y-2">
              <p>
                Empty week — click an empty slot in the grid, click + Add event,
                or ask the buddy in the side panel.
              </p>
              <button
                onClick={async () => {
                  const r = await seedDemoData();
                  await refresh();
                  await refreshBehavior();
                  setToast({
                    kind: 'ok',
                    message: `Seeded ${r.events} events and ${r.behaviorDays} days of browsing.`,
                  });
                }}
                className="text-[11px] underline hover:text-accent"
              >
                or load a demo week
              </button>
            </div>
          )}
        </section>

        {/* ---- Activity monitor ---- */}
        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              This week's browsing
            </h2>
            <p className="text-[11px] text-muted">
              everything below is computed locally — AI optional
            </p>
          </div>

          {stats && (
            <StatCards
              stats={[
                {
                  label: 'Total browsing',
                  value: formatDurationMs(stats.totalBrowsingMs),
                  sub:
                    stats.totalBrowsingMs === 0
                      ? 'no data yet'
                      : `${Math.round(stats.totalBrowsingMs / 3_600_000)}h-ish total`,
                },
                {
                  label: 'On distractions',
                  value: formatDurationMs(stats.totalDistractionMs),
                  sub:
                    stats.totalBrowsingMs > 0
                      ? `${stats.distractionShare}% of all time online`
                      : '—',
                  tone: 'accent',
                },
                {
                  label: 'Peak day',
                  value: stats.pDay
                    ? DAY_NAMES_FULL[stats.pDay.day]
                    : '—',
                  sub: stats.pDay
                    ? formatDurationMs(stats.pDay.ms) + ' on distractions'
                    : 'no data',
                },
                {
                  label: 'Peak hour',
                  value: stats.pHour
                    ? `${String(stats.pHour.hour).padStart(2, '0')}:00`
                    : '—',
                  sub: stats.pHour
                    ? formatDurationMs(stats.pHour.ms) + ' on distractions'
                    : 'no data',
                },
              ]}
            />
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="flex items-baseline justify-between mb-3">
                <h3 className="text-sm font-semibold">Top domains</h3>
                <p className="text-[11px] text-muted">all browsing this week</p>
              </div>
              <DomainBars
                domains={weekly?.topAllDomains ?? []}
                totalMs={weekly?.totalBrowsingMs}
              />
            </div>

            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="flex items-baseline justify-between mb-3">
                <h3 className="text-sm font-semibold">Distraction by day</h3>
                <p className="text-[11px] text-muted">Mon → Sun</p>
              </div>
              <DailyBars values={dailyDistraction} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="flex items-baseline justify-between mb-3">
                <h3 className="text-sm font-semibold">Distraction heatmap</h3>
                <p className="text-[11px] text-muted">
                  brighter = more time on distraction domains
                </p>
              </div>
              {weekly && weekly.distractionCells.length > 0 ? (
                <Heatmap cells={weekly.distractionCells} />
              ) : (
                <p className="text-xs text-muted py-4">
                  no distraction-domain time logged yet — browse a bit and come
                  back.
                </p>
              )}
            </div>
            <InsightCard />
          </div>
        </section>
      </main>

      <EventModal
        open={modal.open}
        mode={modalMode}
        initial={initialEvent}
        defaults={modalDefaults}
        onClose={() => setModal({ open: false })}
        onSave={handleSave}
        onDelete={async (id) => {
          await remove(id);
        }}
      />

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
