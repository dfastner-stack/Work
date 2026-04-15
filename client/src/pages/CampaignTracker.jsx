import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { fetchTasks, fetchAllTasks } from '../api/asana.js';
import { groupByCampaign, groupBySection, getPoints, getCampaign } from '../utils/aggregate.js';
import { SECTIONS_ORDER } from '../config.js';
import StatCard from '../components/StatCard.jsx';
import TaskTable from '../components/TaskTable.jsx';

const PALETTE = [
  '#2D6A4F','#52B788','#95D5B2','#1B4332','#40916C',
  '#74C69D','#B7E4C7','#D8F3DC','#F59E0B','#EF4444',
];

export default function CampaignTracker() {
  const [tasks, setTasks] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    Promise.all([fetchTasks(), fetchAllTasks()])
      .then(([incomplete, all]) => { setTasks(incomplete); setAllTasks(all); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Shell><p className="text-gray-400">Loading…</p></Shell>;
  if (error)   return <Shell><p className="text-red-600">Error: {error}</p></Shell>;

  const campaigns = groupByCampaign(tasks);
  const totalPoints = campaigns.reduce((s, c) => s + c.points, 0);

  // Build completion stats per campaign using all tasks
  const completionByCampaign = {};
  for (const task of allTasks) {
    const campaign = getCampaign(task) || 'Uncategorized';
    if (!completionByCampaign[campaign]) completionByCampaign[campaign] = { total: 0, completed: 0 };
    completionByCampaign[campaign].total += 1;
    if (task.completed) completionByCampaign[campaign].completed += 1;
  }

  const pieData = campaigns.filter(c => c.points > 0).slice(0, 10).map((c, i) => ({
    name: c.name,
    value: c.points,
    color: PALETTE[i % PALETTE.length],
  }));

  const activeCampaign = selected != null ? campaigns.find(c => c.name === selected) : null;

  return (
    <Shell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Campaign Tracker</h1>
        <p className="mt-1 text-sm text-gray-500">Grouped by "Campaign or Project Name" custom field</p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Campaigns" value={campaigns.length} color="green" />
        <StatCard label="Total Backlog Pts" value={totalPoints.toFixed(0)} color="gray" />
        <StatCard label="Uncategorized" value={campaigns.find(c => c.name === 'Uncategorized')?.tasks.length ?? 0} sub="no campaign set" color={campaigns.find(c => c.name === 'Uncategorized') ? 'yellow' : 'gray'} />
      </div>

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[#E5E0D8] bg-white p-4">
          <p className="mb-3 text-sm font-semibold text-gray-700">Bandwidth by Campaign (Points)</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" onClick={d => setSelected(d.name)}>
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} stroke="transparent" className="cursor-pointer" />
                ))}
              </Pie>
              <Tooltip formatter={(v) => `${v.toFixed(0)} pts`} contentStyle={{ background: '#fff', border: '1px solid #E5E0D8', borderRadius: 8, color: '#111827' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border border-[#E5E0D8] bg-white p-4 overflow-y-auto max-h-72">
          <p className="mb-3 text-sm font-semibold text-gray-700">All Campaigns</p>
          <div className="space-y-1">
            {campaigns.map((c, i) => {
              const pct = totalPoints > 0 ? (c.points / totalPoints) * 100 : 0;
              return (
                <button
                  key={c.name}
                  onClick={() => setSelected(selected === c.name ? null : c.name)}
                  className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-[#F5F0E8] transition-colors ${selected === c.name ? 'bg-[#2D6A4F]/10' : ''}`}
                >
                  <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
                  <span className="flex-1 truncate text-gray-700">{c.name}</span>
                  <span className="font-mono text-xs text-gray-400">{c.points.toFixed(0)} pts</span>
                  <span className="w-10 text-right font-mono text-xs text-gray-300">{pct.toFixed(0)}%</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Campaign cards with progress bars */}
      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {campaigns.map((c, i) => {
          const bySection = groupBySection(c.tasks);
          const pct = totalPoints > 0 ? (c.points / totalPoints * 100).toFixed(0) : 0;
          const completion = completionByCampaign[c.name] ?? { total: c.tasks.length, completed: 0 };
          const completePct = completion.total > 0 ? Math.round((completion.completed / completion.total) * 100) : 0;
          return (
            <button
              key={c.name}
              onClick={() => setSelected(selected === c.name ? null : c.name)}
              className={`rounded-xl border p-4 text-left transition-all hover:shadow-sm ${
                selected === c.name
                  ? 'border-[#2D6A4F] bg-[#2D6A4F]/5'
                  : 'border-[#E5E0D8] bg-white hover:border-[#2D6A4F]/40'
              }`}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <p className="font-semibold text-gray-900 line-clamp-1">{c.name}</p>
                <span className="shrink-0 rounded bg-[#2D6A4F]/10 px-1.5 py-0.5 text-xs text-[#2D6A4F]">{pct}% of BW</span>
              </div>

              {/* Progress bar */}
              <div className="mb-2">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Progress</span>
                  <span className="font-semibold text-[#2D6A4F]">{completePct}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[#E8E0D4]">
                  <div
                    className="h-full rounded-full bg-[#2D6A4F] transition-all"
                    style={{ width: `${completePct}%` }}
                  />
                </div>
                <div className="mt-1 flex justify-between text-xs text-gray-400">
                  <span>{completion.completed} of {completion.total} tasks done</span>
                  <span>{c.points.toFixed(0)} pts remaining</span>
                </div>
              </div>

              {c.missingPoints > 0 && <p className="text-xs text-amber-600 mb-1">+{c.missingPoints} unestimated</p>}
              <div className="flex flex-wrap gap-1 mt-1">
                {SECTIONS_ORDER.filter(s => bySection[s]).map(s => (
                  <span key={s} className="rounded bg-[#F5F0E8] px-1.5 py-0.5 text-xs text-gray-500">
                    {s.replace('Awaiting Approval', 'Approval')}: {bySection[s].tasks.length}
                  </span>
                ))}
              </div>
            </button>
          );
        })}
      </div>

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
  return <div className="min-h-screen p-6 bg-[#FAF7F2]">{children}</div>;
}
