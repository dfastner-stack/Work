const COLORS = {
  'Requests':          'bg-blue-100 text-blue-700',
  'On Hold':           'bg-gray-100 text-gray-600',
  'To Do Queue':       'bg-purple-100 text-purple-700',
  'In Progress':       'bg-amber-100 text-amber-700',
  'Awaiting Approval': 'bg-orange-100 text-orange-700',
  'Approved':          'bg-teal-100 text-teal-700',
  'Scheduled':         'bg-cyan-100 text-cyan-700',
  'Reoccurring':       'bg-[#2D6A4F]/10 text-[#2D6A4F]',
  'Finito':            'bg-green-100 text-green-700',
};

export default function SectionBadge({ name }) {
  const cls = COLORS[name] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${cls}`}>
      {name}
    </span>
  );
}
