import { useEffect, useState } from 'react';
import { fetchTasks } from '../api/asana.js';
import { getPoints, getSection, isOverdue } from '../utils/aggregate.js';
import StatCard from '../components/StatCard.jsx';
import TaskTable from '../components/TaskTable.jsx';

const CD_STALLED_DAYS = 5;

function daysSinceModified(task) {
  if (!task.modified_at) return null;
  const ms = Date.now() - new Date(task.modified_at).getTime();
  return ms / (1000 * 60 * 60 * 24);
}

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

  if (loading) return <Shell><p className="text-gray-400">Loading…</p></Shell>;
  if (error)   return <Shell><p className="text-red-600">Error: {error}</p></Shell>;

  const today = new Date();
  const overdue = tasks.filter(t => isOverdue(t, today));
  const stalled = tasks.filter(t => {
    const section = getSection(t);
    return (section === 'Requests' || section === 'On Hold') && !t.due_on;
  });
  // CD Review tasks with no modification in the last 5 days
  const cdStalled = tasks.filter(t => {
    if (getSection(t) !== 'CD Review') return false;
    const days = daysSinceModified(t);
    return days === null || days >= CD_STALLED_DAYS;
  });

  const overduePts  = overdue.reduce((s, t) => s + (getPoints(t) ?? 0), 0);
  const stalledPts  = stalled.reduce((s, t) => s + (getPoints(t) ?? 0), 0);
  const cdPts       = cdStalled.reduce((s, t) => s + (getPoints(t) ?? 0), 0);
  const lockedPts   = overduePts + stalledPts;

  return (
    <Shell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Overdue & Stalled</h1>
        <p className="mt-1 text-sm text-gray-500">Tasks that are past due, blocked, or waiting on CD review</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Locked" value={`${lockedPts.toFixed(0)} pts`} sub="overdue + stalled" color={lockedPts > 0 ? 'red' : 'gray'} />
        <StatCard label="Overdue Tasks" value={overdue.length} sub={`${overduePts.toFixed(0)} pts`} color={overdue.length > 0 ? 'red' : 'gray'} />
        <StatCard label="Stalled Tasks" value={stalled.length} sub={`${stalledPts.toFixed(0)} pts, no due date`} color={stalled.length > 0 ? 'yellow' : 'gray'} />
        <StatCard label="CD Review Stalled" value={cdStalled.length} sub={`${CD_STALLED_DAYS}+ days no activity`} color={cdStalled.length > 0 ? 'yellow' : 'gray'} />
      </div>

      <div className="space-y-8">
        {cdStalled.length > 0 && (
          <section>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-yellow-700">🔍 CD Review Stalled</h2>
              <span className="text-sm text-gray-400">— {cdStalled.length} tasks · no activity for {CD_STALLED_DAYS}+ days · {cdPts.toFixed(0)} pts waiting</span>
            </div>
            <TaskTable tasks={cdStalled} showAssignee showCampaign />
          </section>
        )}

        {overdue.length > 0 && (
          <section>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-red-600">⚠ Overdue</h2>
              <span className="text-sm text-gray-400">— {overdue.length} tasks · {overduePts.toFixed(0)} pts of capacity locked</span>
            </div>
            <TaskTable tasks={overdue} showAssignee />
          </section>
        )}

        {stalled.length > 0 && (
          <section>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-600">⏸ Stalled (Requests / On Hold, no due date)</h2>
              <span className="text-sm text-gray-400">— {stalled.length} tasks · {stalledPts.toFixed(0)} pts unknown commitment</span>
            </div>
            <TaskTable tasks={stalled} showAssignee showCampaign />
          </section>
        )}

        {overdue.length === 0 && stalled.length === 0 && cdStalled.length === 0 && (
          <div className="rounded-xl border border-[#2D6A4F]/20 bg-[#2D6A4F]/5 p-6 text-center text-[#2D6A4F]">
            ✓ No overdue, stalled, or CD-blocked tasks right now.
          </div>
        )}
      </div>
    </Shell>
  );
}

export function overdueCount(tasks) {
  const today = new Date();
  const overdue = tasks.filter(t => isOverdue(t, today));
  const stalled = tasks.filter(t => {
    const section = getSection(t);
    return (section === 'Requests' || section === 'On Hold') && !t.due_on;
  });
  return overdue.length + stalled.length;
}

function Shell({ children }) {
  return <div className="min-h-screen p-6 bg-[#FAF7F2]">{children}</div>;
}
