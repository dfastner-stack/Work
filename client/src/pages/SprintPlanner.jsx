import { useEffect, useState } from 'react';
import { fetchTasks, fetchConfig } from '../api/asana.js';
import { groupByPerson, getSprintBuckets, getPoints } from '../utils/aggregate.js';
import { PEOPLE } from '../config.js';
import StatCard from '../components/StatCard.jsx';
import TaskTable from '../components/TaskTable.jsx';

const BUCKETS = [
  { key: 'overdue',   label: '⚠ Overdue',   color: 'border-red-200 bg-red-50' },
  { key: 'thisWeek',  label: 'This Week',    color: 'border-amber-200 bg-amber-50' },
  { key: 'nextWeek',  label: 'Next Week',    color: 'border-[#2D6A4F]/20 bg-[#2D6A4F]/5' },
  { key: 'later',     label: 'Later',        color: 'border-[#E5E0D8] bg-white' },
  { key: 'noDueDate', label: 'No Due Date',  color: 'border-[#E5E0D8] bg-[#FAF7F2]' },
];

export default function SprintPlanner() {
  const [tasks, setTasks] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [personFilter, setPersonFilter] = useState('all');
  const [expandedBucket, setExpandedBucket] = useState('thisWeek');

  useEffect(() => {
    Promise.all([fetchTasks(), fetchConfig()])
      .then(([t, c]) => { setTasks(t); setConfig(c); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Shell><p className="text-gray-400">Loading…</p></Shell>;
  if (error)   return <Shell><p className="text-red-600">Error: {error}</p></Shell>;

  const today = new Date();
  const filteredTasks = personFilter === 'all'
    ? tasks
    : tasks.filter(t => t.assignee?.gid === personFilter);

  const buckets = getSprintBuckets(filteredTasks, today);
  const byPerson = groupByPerson(filteredTasks);

  const overduePts  = buckets.overdue.reduce((s, t) => s + (getPoints(t) ?? 0), 0);
  const thisWeekPts = buckets.thisWeek.reduce((s, t) => s + (getPoints(t) ?? 0), 0);
  const nextWeekPts = buckets.nextWeek.reduce((s, t) => s + (getPoints(t) ?? 0), 0);

  return (
    <Shell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Sprint Planner</h1>
        <p className="mt-1 text-sm text-gray-500">Tasks by due date — helps plan weekly commitments</p>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={() => setPersonFilter('all')}
          className={`rounded-lg border px-3 py-1 text-xs font-medium transition-colors ${
            personFilter === 'all'
              ? 'border-[#2D6A4F] bg-[#2D6A4F]/10 text-[#2D6A4F]'
              : 'border-[#E5E0D8] text-gray-500 hover:border-[#2D6A4F]/40'
          }`}
        >
          All People
        </button>
        {PEOPLE.map(p => (
          <button
            key={p.gid}
            onClick={() => setPersonFilter(p.gid)}
            className={`rounded-lg border px-3 py-1 text-xs font-medium transition-colors ${
              personFilter === p.gid
                ? 'border-[#2D6A4F] bg-[#2D6A4F]/10 text-[#2D6A4F]'
                : 'border-[#E5E0D8] text-gray-500 hover:border-[#2D6A4F]/40'
            }`}
          >
            {p.name.split(' ')[0]}
          </button>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <StatCard label="Overdue" value={`${overduePts.toFixed(0)} pts`} sub={`${buckets.overdue.length} tasks`} color={buckets.overdue.length > 0 ? 'red' : 'gray'} />
        <StatCard label="This Week" value={`${thisWeekPts.toFixed(0)} pts`} sub={`${buckets.thisWeek.length} tasks`} color="yellow" />
        <StatCard label="Next Week" value={`${nextWeekPts.toFixed(0)} pts`} sub={`${buckets.nextWeek.length} tasks`} color="green" />
      </div>

      {personFilter === 'all' && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-400">This Week by Person</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {PEOPLE.map(p => {
              const cap = config?.weeklyCapacity?.[p.gid] ?? 40;
              const myBuckets = getSprintBuckets(byPerson[p.gid]?.tasks ?? [], today);
              const pts = myBuckets.thisWeek.reduce((s, t) => s + (getPoints(t) ?? 0), 0) +
                          myBuckets.overdue.reduce((s, t) => s + (getPoints(t) ?? 0), 0);
              const over = pts > cap;
              return (
                <div key={p.gid} className="rounded-lg border border-[#E5E0D8] bg-white px-3 py-2">
                  <p className="text-xs font-medium text-gray-600">{p.name.split(' ')[0]}</p>
                  <p className={`mt-0.5 text-lg font-bold ${over ? 'text-red-600' : 'text-gray-900'}`}>
                    {pts.toFixed(0)} <span className="text-xs font-normal text-gray-400">/ {cap} pts</span>
                  </p>
                  <p className="text-xs text-gray-400">{myBuckets.overdue.length} overdue · {myBuckets.thisWeek.length} due</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {BUCKETS.map(({ key, label, color }) => {
          const items = buckets[key];
          if (items.length === 0) return null;
          const pts = items.reduce((s, t) => s + (getPoints(t) ?? 0), 0);
          const isOpen = expandedBucket === key;
          return (
            <div key={key} className={`rounded-xl border p-4 ${color}`}>
              <button
                className="flex w-full items-center justify-between"
                onClick={() => setExpandedBucket(isOpen ? null : key)}
              >
                <span className="font-semibold text-gray-800">{label}</span>
                <span className="text-sm text-gray-400">{items.length} tasks · {pts.toFixed(0)} pts {isOpen ? '↑' : '↓'}</span>
              </button>
              {isOpen && <div className="mt-3"><TaskTable tasks={items} showAssignee /></div>}
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

function Shell({ children }) {
  return <div className="min-h-screen p-6 bg-[#FAF7F2]">{children}</div>;
}
