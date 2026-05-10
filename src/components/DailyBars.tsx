import { DAY_LABELS } from '../constants';
import { formatDurationMs } from '../lib/insights';
import { todayDayIndex } from '../lib/calendar';

type Props = {
  /** Length-7 array, Mon..Sun, in ms */
  values: number[];
  label?: string;
};

export function DailyBars({ values, label }: Props) {
  const max = Math.max(1, ...values);
  const today = todayDayIndex();
  return (
    <div>
      {label && (
        <p className="text-[10px] uppercase tracking-wider text-muted font-semibold mb-2">
          {label}
        </p>
      )}
      <div className="flex items-end gap-2 h-32">
        {values.map((ms, i) => {
          const h = Math.max(2, (ms / max) * 100);
          const isToday = i === today;
          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center gap-1"
              title={`${DAY_LABELS[i]} — ${formatDurationMs(ms)}`}
            >
              <div className="flex-1 w-full flex items-end">
                <div
                  className={`w-full rounded-t ${
                    isToday ? 'bg-accent' : 'bg-accent/40'
                  } ${ms === 0 ? 'opacity-30' : ''}`}
                  style={{ height: `${h}%` }}
                />
              </div>
              <span
                className={`text-[10px] ${
                  isToday ? 'text-accent font-semibold' : 'text-muted'
                }`}
              >
                {DAY_LABELS[i]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
