import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Legend, ResponsiveContainer } from 'recharts';
import { fetchTasks, fetchConfig, fetchUtilizationHistory, recordUtilizationHistory } from '../api/asana.js';
import { groupByPerson, calcBandwidth, getPersonCapacity, calcUtilizationRate, utilizationStyle, getSection } from '../utils/aggregate.js';
import { PEOPLE, getCurrentQuarter, weeksRemaining } from '../config.js';
import CapacityBar from '../components/CapacityBar.jsx';
import StatCard from '../components/StatCard.jsx';

// Dan Fastner acts as Creative Director
const CD_GID = '1210546465186795';

const PERSON_COLORS = {
  '1210546465186795': '#2D6A4F',
  '1210564384682197': '#F59E0B',
  '1206106258227118': '#3B82F6',
};

function getConsecutiveWeeksAbove(entries, personName, threshold = 85) {
  const sorted = [...entries].sort((a, b) => b.weekOf.localeCompare(a.weekOf)).slice(0, 12);
  let consecutive = 0;
  for (const entry of sorted) {
    if ((entry.team[personName] ?? 0) > threshold) consecutive++;
    else break;
  }
  return consecutive;
}

export default function TeamOverview() {
  const [tasks, setTasks] = useState([]);
  const [config, setConfig] = useState(null);
  const [history, setHistory] = useState({ entries: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([fetchTasks(), fetchConfig(), fetchUtilizationHistory()])
      .then(([t, c, h]) => { setTasks(t); setConfig(c); setHistory(h); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Monday snapshot — record current utilization rates once per week
  useEffect(() => {
    if (!tasks.length || !config || loading) return;
    const today = new Date();
    if (today.getDay() !== 1) return;
    const weekOf = today.toISOString().slice(0, 10);
    if (history.entries.some(e => e.weekOf === weekOf)) return;

    const bwSnap = calcBandwidth(tasks, config, today);
    const wksLeft = weeksRemaining(today);
    const team = {};
    bwSnap.people.forEach(pw => {
      const net = pw.cap * wksLeft * (1 - (config.reservePercent ?? 20) / 100);
      team[pw.name] = calcUtilizationRate(pw.backlog, net);
    });
    recordUtilizationHistory(weekOf, team)
      .then(updated => setHistory(updated))
      .catch(console.error);
  }, [tasks, config, loading]);

  if (loading) return <Shell><p className="text-gray-400">Loading…</p></Shell>;
  if (error)   return <Shell><p className="text-red-600">Error: {error}</p></Shell>;

  const today = new Date();
  const bw = calcBandwidth(tasks, config, today);
  const byPerson = groupByPerson(tasks);
  const q = getCurrentQuarter(today);
  const wksLeft = weeksRemaining(today);
  const reservePct = config?.reservePercent ?? 20;

  const totalBacklog = bw.team.teamBacklog;
  const teamWkly = bw.team.teamWeeklyCap;
  const wksToClear = bw.team.teamWksToClear;
  const isOverloaded = wksToClear > wksLeft;

  // CD Review count (tasks currently in CD Review, assigned to CD)
  const cdReviewTasks = tasks.filter(t => getSection(t) === 'CD Review');

  // Build chart data from history (last 12 weeks, sorted oldest→newest)
  const chartEntries = [...history.entries]
    .sort((a, b) => a.weekOf.localeCompare(b.weekOf))
    .slice(-12);
  const chartData = chartEntries.map(e => ({
    week: e.weekOf.slice(5), // MM-DD
    ...e.team,
  }));
  const hasChartData = chartData.length >= 2;

  return (
    <Shell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Team Overview</h1>
        <p className="mt-1 text-sm text-gray-500">
          {q.label} · ends {q.end.toLocaleDateString()} · {wksLeft.toFixed(1)} weeks remaining
        </p>
      </div>

      {isOverloaded && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          ⚠ Team backlog ({totalBacklog.toFixed(0)} pts) requires <strong>{wksToClear.toFixed(1)} weeks</strong> to clear —
          only <strong>{wksLeft.toFixed(1)} weeks</strong> remain in {q.label}.
        </div>
      )}

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Backlog" value={`${totalBacklog.toFixed(0)} pts`} sub="across team" color="green" />
        <StatCard label="Team Weekly Cap" value={`${teamWkly} pts`} sub="production hrs" color="gray" />
        <StatCard label="Wks to Clear" value={wksToClear.toFixed(1)} sub={`of ${wksLeft.toFixed(1)} remaining`} color={isOverloaded ? 'red' : 'green'} />
        <StatCard label="In CD Review" value={cdReviewTasks.length} sub="tasks at quality gate" color={cdReviewTasks.length > 0 ? 'yellow' : 'gray'} />
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Individual Capacity</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {PEOPLE.map(p => {
          const pw = bw.people.find(x => x.gid === p.gid);
          const data = byPerson[p.gid];
          const net = (pw?.cap ?? 0) * wksLeft * (1 - reservePct / 100);
          const util = calcUtilizationRate(pw?.backlog ?? 0, net);
          const style = utilizationStyle(util);
          const consecutive = getConsecutiveWeeksAbove(history.entries, p.name);
          const cdCount = cdReviewTasks.filter(t => t.assignee?.gid === p.gid).length;

          return (
            <div key={p.gid} className="flex flex-col gap-2">
              {/* Sustained overallocation alert */}
              {consecutive >= 3 && (
                <div className={`rounded-lg border px-3 py-2 text-xs font-medium ${consecutive >= 6 ? 'bg-red-50 border-red-300 text-red-700' : 'bg-amber-50 border-amber-300 text-amber-700'}`}>
                  ⚠ {p.name.split(' ')[0]} — {consecutive} consecutive weeks above 85%. Consider headcount review.
                </div>
              )}
              <Link
                to={`/person/${p.slug}`}
                className={`block rounded-xl border p-4 hover:shadow-sm transition-all ${style.border} ${style.bg}`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2D6A4F] font-bold text-white">
                      {p.name[0]}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{p.name}</p>
                      <p className="text-xs text-gray-400">{data?.tasks.length ?? 0} tasks</p>
                    </div>
                  </div>
                  {/* Utilization rate — headline number */}
                  <div className="text-right">
                    <p className={`text-2xl font-bold ${style.text}`}>{util > 999 ? '∞' : `${util}%`}</p>
                    <p className={`text-xs font-medium ${style.text}`}>{style.label}</p>
                  </div>
                </div>

                <CapacityBar
                  capacity={pw?.cap ?? 40}
                  segments={[
                    { label: 'Backlog', value: pw?.backlog ?? 0, color: util > 85 ? 'bg-red-400' : 'bg-[#2D6A4F]' },
                  ]}
                />
                <div className="mt-2 flex justify-between text-xs">
                  <span className="text-gray-400">{(pw?.backlog ?? 0).toFixed(0)} pts backlog</span>
                  <span className={util > 85 ? 'text-red-600 font-semibold' : 'text-gray-400'}>
                    {(pw?.wksToClear ?? 0).toFixed(1)} wks to clear
                  </span>
                </div>
                {cdCount > 0 && (
                  <p className="mt-1.5 rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-800 inline-block">
                    {cdCount} in CD Review
                  </p>
                )}
                {(data?.missingPoints ?? 0) > 0 && (
                  <p className="mt-1 text-xs text-amber-600">⚠ {data.missingPoints} tasks missing Points</p>
                )}
              </Link>
            </div>
          );
        })}
      </div>

      {/* Utilization Trends */}
      <div className="mt-8 rounded-xl border border-[#E5E0D8] bg-white p-5">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-gray-400">Utilization Trends</h2>
        <p className="mb-4 text-xs text-gray-400">Last 12 weeks · recorded each Monday</p>
        {hasChartData ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0EBE3" />
              <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#9CA3AF' }} />
              <YAxis domain={[0, 120]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11, fill: '#9CA3AF' }} width={38} />
              <Tooltip formatter={(v) => `${v}%`} contentStyle={{ background: '#fff', border: '1px solid #E5E0D8', borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine y={85} stroke="#F59E0B" strokeDasharray="4 2" label={{ value: 'Watch 85%', position: 'right', fontSize: 10, fill: '#F59E0B' }} />
              <ReferenceLine y={65} stroke="#3B82F6" strokeDasharray="4 2" label={{ value: 'Floor 65%', position: 'right', fontSize: 10, fill: '#3B82F6' }} />
              {PEOPLE.map(p => (
                <Line
                  key={p.gid}
                  type="monotone"
                  dataKey={p.name}
                  stroke={PERSON_COLORS[p.gid]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-32 items-center justify-center rounded-lg bg-[#FAF7F2] text-sm text-gray-400">
            Trend data builds over time. Check back next week.
          </div>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }) {
  return <div className="min-h-screen p-6 bg-[#FAF7F2]">{children}</div>;
}
