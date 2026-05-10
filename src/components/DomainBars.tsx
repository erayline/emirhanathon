import type { DomainTotal } from '../lib/insights';
import { formatDurationMs } from '../lib/insights';
import { DISTRACTION_DOMAINS } from '../constants';

type Props = {
  domains: DomainTotal[];
  totalMs?: number;
  emptyMessage?: string;
};

const DISTRACTION_SET = new Set<string>(DISTRACTION_DOMAINS);

export function DomainBars({
  domains,
  totalMs,
  emptyMessage = 'no browsing tracked yet — give it a day',
}: Props) {
  if (domains.length === 0) {
    return <p className="text-xs text-muted py-3">{emptyMessage}</p>;
  }
  const max = Math.max(1, ...domains.map((d) => d.durationMs));
  const denom = totalMs && totalMs > 0 ? totalMs : domains.reduce((a, b) => a + b.durationMs, 0);
  return (
    <ul className="space-y-2">
      {domains.map((d) => {
        const pct = (d.durationMs / max) * 100;
        const sharePct =
          denom > 0 ? Math.round((d.durationMs / denom) * 100) : 0;
        const isDistraction = DISTRACTION_SET.has(d.domain);
        return (
          <li key={d.domain} className="text-sm">
            <div className="flex items-baseline justify-between mb-1">
              <span className="flex items-center gap-2 truncate">
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    isDistraction ? 'bg-accent' : 'bg-fixed'
                  }`}
                />
                <span className="truncate">{d.domain}</span>
              </span>
              <span className="text-xs text-muted shrink-0 ml-2">
                {formatDurationMs(d.durationMs)}{' '}
                <span className="opacity-70">· {sharePct}%</span>
              </span>
            </div>
            <div className="h-1.5 bg-bg rounded-full overflow-hidden">
              <div
                className={`h-full ${isDistraction ? 'bg-accent' : 'bg-fixed'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
