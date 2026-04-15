import { useEffect, useState } from 'react';
import { fetchTasks } from '../api/asana.js';
import { groupBySection, getPoints } from '../utils/aggregate.js';
import { SECTIONS_ORDER } from '../config.js';
import SectionBadge from '../components/SectionBadge.jsx';
import TaskTable from '../components/TaskTable.jsx';

export default function PipelineKanban() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    fetchTasks()
      .then(t => setTasks(t))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Shell><p className="text-gray-500">Loading…</p></Shell>;
  if (error)   return <Shell><p className="text-red-400">Error: {error}</p></Shell>;

  const bySection = groupBySection(tasks);
  const totalPts = tasks.reduce((s, t) => s + (getPoints(t) ?? 0), 0);
  const maxPts = Math.max(...Object.values(bySection).map(s => s.points), 1);

  return (
    <Shell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Content Pipeline</h1>
        <p className="mt-1 text-sm text-gray-500">All {tasks.length} incomplete tasks across {SECTIONS_ORDER.length} workflow stages</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS_ORDER.map(sectionName => {
          const sec = bySection[sectionName];
          if (!sec) return (
            <div key={sectionName} className="rounded-xl border border-gray-800/50 bg-gray-900/30 p-4 opacity-40">
              <SectionBadge name={sectionName} />
              <p className="mt-2 text-sm text-gray-700">Empty</p>
            </div>
          );

          const isBottleneck = sec.points > 0 && sec.points === maxPts;
          const pctOfTotal = totalPts > 0 ? (sec.points / totalPts * 100) : 0;
          const isExpanded = expanded === sectionName;

          return (
            <div key={sectionName} className={`rounded-xl border p-4 ${isBottleneck ? 'border-orange-500/50 bg-orange-950/20' : 'border-gray-800 bg-gray-900'}`}>
              <div className="mb-2 flex items-start justify-between gap-2">
                <SectionBadge name={sectionName} />
                {isBottleneck && <span className="rounded bg-orange-900/40 px-1.5 py-0.5 text-xs text-orange-400">🔥 Bottleneck</span>}
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-white">{sec.tasks.length}</span>
                <span className="text-sm text-gray-500">tasks</span>
                <span className="ml-auto font-mono text-sm text-gray-300">{sec.points.toFixed(0)} pts</span>
                <span className="text-xs text-gray-600">({pctOfTotal.toFixed(0)}%)</span>
              </div>

              {/* Mini bar */}
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-800">
                <div
                  className="h-full rounded-full bg-indigo-500"
                  style={{ width: `${(sec.points / maxPts) * 100}%` }}
                />
              </div>

              <button
                onClick={() => setExpanded(isExpanded ? null : sectionName)}
                className="mt-3 text-xs text-indigo-400 hover:text-indigo-300"
              >
                {isExpanded ? 'Hide tasks ↑' : 'Show tasks ↓'}
              </button>

              {isExpanded && (
                <div className="mt-3">
                  <TaskTable tasks={sec.tasks} showAssignee />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

function Shell({ children }) {
  return <div className="min-h-screen p-6">{children}</div>;
}
