import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchTasks } from '../api/asana.js';
import { groupByCampaign, groupBySection, getPoints } from '../utils/aggregate.js';
import { SECTIONS_ORDER } from '../config.js';
import StatCard from '../components/StatCard.jsx';
import TaskTable from '../components/TaskTable.jsx';

const PALETTE = [
  '#6366f1','#f59e0b','#10b981','#ef4444','#8b5cf6',
  '#06b6d4','#f97316','#ec4899','#84cc16','#14b8a6',
];

export default function CampaignTracker() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    fetchTasks()
      .then(t => setTasks(t))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Shell><p className="text-gray-500">Loading…</p></Shell>;
  if (error)   return <Shell><p className="text-red-400">Error: {error}</p></Shell>;

  const campaigns = groupByCampaign(tasks);
  const totalPoints = campaigns.reduce((s, c) => s + c.points, 0);
  const pieData = campaigns.filter(c => c.points > 0).slice(0, 10).map((c, i) => ({
    name: c.name,
    value: c.points,
    color: PALETTE[i % PALETTE.length],
  }));

  const activeCampaign = selected != null ? campaigns.find(c => c.name === selected) : null;

  return (
    <Shell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Campaign Tracker</h1>
        <p className="mt-1 text-sm text-gray-500">Grouped by "Campaign or Project Name" custom field</p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Campaigns" value={campaigns.length} color="indigo" />
        <StatCard label="Total Backlog Pts" value={totalPoints.toFixed(0)} color="gray" />
        <StatCard label="Uncategorized" value={campaigns.find(c => c.name === 'Uncategorized')?.tasks.length ?? 0} sub="no campaign set" color={campaigns.find(c => c.name === 'Uncategorized') ? 'yellow' : 'gray'} />
      </div>

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        {/* Pie chart */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <p className="mb-3 text-sm font-semibold text-gray-300">Bandwidth by Campaign (Points)</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" onClick={d => setSelected(d.name)}>
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} stroke="transparent" className="cursor-pointer" />
                ))}
              </Pie>
              <Tooltip formatter={(v) => `${v.toFixed(0)} pts`} contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend / list */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 overflow-y-auto max-h-72">
          <p className="mb-3 text-sm font-semibold text-gray-300">All Campaigns</p>
          <div className="space-y-1">
            {campaigns.map((c, i) => {
              const pct = totalPoints > 0 ? (c.points / totalPoints) * 100 : 0;
              return (
                <button
                  key={c.name}
                  onClick={() => setSelected(selected === c.name ? null : c.name)}
                  className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-800 transition-colors ${selected === c.name ? 'bg-indigo-600/20' : ''}`}
                >
                  <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
                  <span className="flex-1 truncate text-gray-300">{c.name}</span>
                  <span className="font-mono text-xs text-gray-500">{c.points.toFixed(0)} pts</span>
                  <span className="w-10 text-right font-mono text-xs text-gray-600">{pct.toFixed(0)}%</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Campaign cards */}
      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {campaigns.map((c, i) => {
          const bySection = groupBySection(c.tasks);
          const pct = totalPoints > 0 ? (c.points / totalPoints * 100).toFixed(0) : 0;
          return (
            <button
              key={c.name}
              onClick={() => setSelected(selected === c.name ? null : c.name)}
              className={`rounded-xl border p-4 text-left transition-colors hover:border-indigo-600/50 ${
                selected === c.name ? 'border-indigo-500 bg-indigo-600/10' : 'border-gray-800 bg-gray-900'
              }`}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <p className="font-semibold text-white line-clamp-1">{c.name}</p>
                <span className="shrink-0 rounded bg-indigo-900/50 px-1.5 py-0.5 text-xs text-indigo-300">{pct}%</span>
              </div>
              <p className="text-sm text-gray-400">{c.tasks.length} tasks · {c.points.toFixed(0)} pts</p>
              {c.missingPoints > 0 && <p className="text-xs text-yellow-500 mt-0.5">+{c.missingPoints} unestimated</p>}
              <div className="mt-2 flex flex-wrap gap-1">
                {SECTIONS_ORDER.filter(s => bySection[s]).map(s => (
                  <span key={s} className="rounded bg-gray-800 px-1.5 py-0.5 text-xs text-gray-500">
                    {s.replace('Awaiting Approval','Approval')}: {bySection[s].tasks.length}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      {/* Drill-down task table */}
      {activeCampaign && (
        <div className="mt-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
            {activeCampaign.name} — Tasks ({activeCampaign.tasks.length})
          </h2>
          <TaskTable tasks={activeCampaign.tasks} showAssignee />
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }) {
  return <div className="min-h-screen p-6">{children}</div>;
}
