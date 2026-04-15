export default function StatCard({ label, value, sub, color = 'indigo', className = '' }) {
  const colors = {
    indigo: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400',
    red:    'bg-red-500/10 border-red-500/30 text-red-400',
    yellow: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
    green:  'bg-green-500/10 border-green-500/30 text-green-400',
    gray:   'bg-gray-800 border-gray-700 text-gray-400',
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color] ?? colors.gray} ${className}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-3xl font-bold text-white">{value}</p>
      {sub && <p className="mt-1 text-xs opacity-60">{sub}</p>}
    </div>
  );
}
