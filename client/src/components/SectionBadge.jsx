const COLORS = {
  'Requests':          'bg-blue-900/40 text-blue-300',
  'On Hold':           'bg-gray-700 text-gray-300',
  'To Do Queue':       'bg-purple-900/40 text-purple-300',
  'In Progress':       'bg-yellow-900/40 text-yellow-300',
  'Awaiting Approval': 'bg-orange-900/40 text-orange-300',
  'Approved':          'bg-teal-900/40 text-teal-300',
  'Scheduled':         'bg-cyan-900/40 text-cyan-300',
  'Reoccurring':       'bg-indigo-900/40 text-indigo-300',
  'Finito':            'bg-green-900/40 text-green-300',
};

export default function SectionBadge({ name }) {
  const cls = COLORS[name] ?? 'bg-gray-700 text-gray-300';
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${cls}`}>
      {name}
    </span>
  );
}
