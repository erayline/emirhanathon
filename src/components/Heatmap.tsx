import type { DayHourCell } from '../lib/insights';
import { formatDurationMs } from '../lib/insights';
import { DAY_LABELS } from '../constants';

type Props = {
  cells: DayHourCell[];
  /** Optional max ms for normalization. Defaults to max of cells. */
  maxMs?: number;
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS = [0, 1, 2, 3, 4, 5, 6];

export function Heatmap({ cells, maxMs }: Props) {
  const map = new Map<string, number>();
  let computedMax = 0;
  for (const c of cells) {
    map.set(`${c.day}:${c.hour}`, c.durationMs);
    if (c.durationMs > computedMax) computedMax = c.durationMs;
  }
  const norm = Math.max(1, maxMs ?? computedMax);

  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-[2px]">
        <thead>
          <tr>
            <th className="w-10" />
            {HOURS.map((h) => (
              <th
                key={h}
                className="text-[9px] text-muted font-normal w-5 align-bottom"
              >
                {h % 3 === 0 ? String(h).padStart(2, '0') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DAYS.map((d) => (
            <tr key={d}>
              <td className="text-[10px] text-muted pr-1 text-right w-10 font-medium">
                {DAY_LABELS[d]}
              </td>
              {HOURS.map((h) => {
                const ms = map.get(`${d}:${h}`) ?? 0;
                const intensity = ms / norm;
                const alpha = ms === 0 ? 0 : 0.18 + 0.82 * Math.min(1, intensity);
                return (
                  <td
                    key={h}
                    title={
                      ms === 0
                        ? `${DAY_LABELS[d]} ${String(h).padStart(2, '0')}:00 — none`
                        : `${DAY_LABELS[d]} ${String(h).padStart(2, '0')}:00 — ${formatDurationMs(ms)}`
                    }
                    className="w-5 h-5 rounded-[3px] border border-border/60"
                    style={{
                      backgroundColor:
                        ms === 0 ? 'transparent' : `rgba(255, 77, 109, ${alpha})`,
                    }}
                  />
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
