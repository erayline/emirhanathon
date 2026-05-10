type Stat = {
  label: string;
  value: string;
  sub?: string;
  tone?: 'default' | 'accent';
};

type Props = { stats: Stat[] };

export function StatCards({ stats }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((s, i) => (
        <div
          key={i}
          className={`rounded-lg border p-3 ${
            s.tone === 'accent'
              ? 'border-accent/40 bg-accent/5'
              : 'border-border bg-surface'
          }`}
        >
          <p className="text-[10px] uppercase tracking-wider text-muted font-semibold">
            {s.label}
          </p>
          <p
            className={`text-xl font-bold mt-1 leading-none ${
              s.tone === 'accent' ? 'text-accent' : 'text-text'
            }`}
          >
            {s.value}
          </p>
          {s.sub && <p className="text-[11px] text-muted mt-1">{s.sub}</p>}
        </div>
      ))}
    </div>
  );
}
