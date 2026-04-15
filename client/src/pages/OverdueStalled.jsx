import { useEffect, useState } from 'react';
import { fetchTasks } from '../api/asana.js';
import { getPoints, getSection, isOverdue } from '../utils/aggregate.js';
import StatCard from '../components/StatCard.jsx';
import TaskTable from '../components/TaskTable.jsx';

export default function OverdueStalled() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTasks()
      .then(t => setTasks(t))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Shell><p className="text-gray-500">Loading…</p></Shell>;
  if (error)   return <Shell><p className="text-red-400">Error: {error}</p></Shell>;

  const today = new Date();
  const overdue = tasks.filter(t => isOverdue(t, today));
  const stalled = tasks.filter(t => {
    const section = getSection(t);
    return (section === 'Requests' || section === 'On Hold') && !t.due_on;
  });

  const overduePts = overdue.reduce((s, t) => s + (getPoints(t) ?? 0), 0);
  const stalledPts = stalled.reduce((s, t) => s + (getPoints(t) ?? 0), 0);
  const lockedPts = overduePts + stalledPts;

  return (
    <Shell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Overdue & Stalled</h1>
        <p className="mt-1 text-sm text-gray-500">Tasks that are past due or blocked without a due date</p>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-4">
        <StatCard label="Total Locked" value={`${lockedPts.toFixed(0)} pts`} sub="overdue + stalled" color={lockedPts > 0 ? 'red' : 'gray'} />
        <StatCard label="Overdue Tasks" value={overdue.length} sub={`${overduePts.toFixed(0)} pts`} color={overdue.length > 0 ? 'red' : 'gray'} />
        <StatCard label="Stalled Tasks" value={stalled.length} sub={`${stalledPts.toFixed(0)} pts, no due date`} color={stalled.length > 0 ? 'yellow' : 'gray'} />
      </div>

      <div className="space-y-8">
        {overdue.length > 0 && (
          <section>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-red-400">⚠ Overdue</h2>
              <span className="text-sm text-gray-500">— {overdue.length} tasks · {overduePts.toFixed(0)} pts of capacity locked</span>
            </div>
            <TaskTable tasks={overdue} showAssignee />
          </section>
        )}

        {stalled.length > 0 && (
          <section>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-yellow-400">⏸ Stalled (Requests / On Hold, no due date)</h2>
              <span className="text-sm text-gray-500">— {stalled.length} tasks · {stalledPts.toFixed(0)} pts unknown commitment</span>
            </div>
            <TaskTable tasks={stalled} showAssignee showCampaign />
          </section>
        )}

        {overdue.length === 0 && stalled.length === 0 && (
          <div className="rounded-xl border border-green-700/30 bg-green-950/20 p-6 text-center text-green-400">
            ✓ No overdue or stalled tasks right now.
          </div>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }) {
  return <div className="min-h-screen p-6">{children}</div>;
}
