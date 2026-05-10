import { useEffect, useState, useCallback } from 'react';
import { insightsStore } from '../lib/storage';
import {
  aggregateWeek,
  formatWeeklyAggregate,
  tasksCompletedThisWeek,
  tasksScheduledThisWeek,
} from '../lib/insights';
import { generateInsight, AIError } from '../lib/ai';
import { useTasks } from '../state/tasks';
import { weekStartISO } from '../lib/calendar';
import { INSIGHT_REFRESH_COOLDOWN_MS } from '../constants';
import type { Insight } from '../types';

export function InsightCard() {
  const events = useTasks((s) => s.events);
  const [insight, setInsight] = useState<Insight | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const week = weekStartISO();

  // Load cached insight on mount. Never auto-call the AI.
  useEffect(() => {
    let cancelled = false;
    insightsStore.forWeek(week).then((cached) => {
      if (cancelled) return;
      if (cached) setInsight(cached);
    });
    return () => {
      cancelled = true;
    };
  }, [week]);

  const generate = useCallback(async () => {
    if (loading) return;
    const cached = await insightsStore.forWeek(week);
    if (
      cached &&
      Date.now() - cached.generatedAt < INSIGHT_REFRESH_COOLDOWN_MS
    ) {
      const minsLeft = Math.ceil(
        (INSIGHT_REFRESH_COOLDOWN_MS -
          (Date.now() - cached.generatedAt)) /
          60_000,
      );
      setError(`Wait ~${minsLeft} min before refreshing.`);
      setInsight(cached);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const agg = await aggregateWeek();
      const text = await generateInsight({
        weeklyAggregate: formatWeeklyAggregate(agg),
        tasksCompleted: tasksCompletedThisWeek(events),
        tasksScheduled: tasksScheduledThisWeek(events),
      });
      const next: Insight = {
        id: `i_${Date.now()}`,
        generatedAt: Date.now(),
        text,
        weekStart: week,
      };
      await insightsStore.upsert(next);
      setInsight(next);
    } catch (e) {
      const msg = e instanceof AIError ? e.message : 'Could not generate insight.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [events, loading, week]);

  const hasInsight = !!insight?.text;

  return (
    <div className="rounded-lg border border-border bg-surface p-4 flex flex-col">
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-sm font-semibold">AI weekly insight</h3>
        <span className="text-[10px] text-muted">optional · uses Gemini</span>
      </div>

      {hasInsight ? (
        <p className="text-sm leading-relaxed text-text">{insight!.text}</p>
      ) : (
        <p className="text-sm text-muted leading-relaxed">
          {loading
            ? 'reading your week…'
            : 'No commentary generated yet. The data above tells the whole story without AI — but if you want a 2–3 sentence pattern read, hit the button.'}
        </p>
      )}

      {error && (
        <p className="text-[11px] text-red-400 mt-2 bg-red-500/10 border border-red-500/30 rounded px-2 py-1">
          {error}
        </p>
      )}

      <div className="mt-auto pt-3 flex items-center justify-between">
        <p className="text-[10px] text-muted">
          {insight?.generatedAt
            ? `last: ${new Date(insight.generatedAt).toLocaleString()}`
            : ' '}
        </p>
        <button
          onClick={generate}
          disabled={loading}
          className="btn btn-ghost text-xs h-7 px-2 disabled:opacity-50"
        >
          {loading ? 'thinking…' : hasInsight ? 'refresh' : 'generate'}
        </button>
      </div>
    </div>
  );
}
