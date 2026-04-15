export default function StatCard({ label, value, sub, color = 'green', className = '' }) {
  const colors = {
    green:  'bg-[#2D6A4F]/8 border-[#2D6A4F]/25 text-[#2D6A4F]',
    red:    'bg-red-50 border-red-200 text-red-700',
    yellow: 'bg-amber-50 border-amber-200 text-amber-700',
    teal:   'bg-teal-50 border-teal-200 text-teal-700',
    gray:   'bg-white border-[#E5E0D8] text-gray-500',
    indigo: 'bg-[#2D6A4F]/8 border-[#2D6A4F]/25 text-[#2D6A4F]',
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color] ?? colors.gray} ${className}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-60">{label}</p>
      <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
      {sub && <p className="mt-1 text-xs opacity-60">{sub}</p>}
    </div>
  );
}
