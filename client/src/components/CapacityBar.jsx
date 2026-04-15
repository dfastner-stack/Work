export default function CapacityBar({ segments = [], capacity = 40, showLabel = true }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const over = total > capacity;
  const pct = (v) => Math.min(100, (v / Math.max(capacity, total)) * 100);

  return (
    <div className="w-full">
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-[#E8E0D4]">
        {segments.map((seg, i) => {
          const left = segments.slice(0, i).reduce((s, x) => s + x.value, 0);
          return (
            <div
              key={seg.label}
              title={`${seg.label}: ${seg.value.toFixed(1)} pts`}
              className={`absolute top-0 h-full ${seg.color}`}
              style={{ left: `${pct(left)}%`, width: `${pct(seg.value)}%` }}
            />
          );
        })}
      </div>
      {showLabel && (
        <div className="mt-1 flex justify-between text-xs text-gray-400">
          <span className={over ? 'text-red-600 font-semibold' : ''}>
            {total.toFixed(0)} / {capacity} pts{over ? ' ⚠ OVER' : ''}
          </span>
          <span>{((total / capacity) * 100).toFixed(0)}%</span>
        </div>
      )}
    </div>
  );
}
