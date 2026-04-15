import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchTasks, fetchConfig } from '../api/asana.js';
import { groupByPerson, calcBandwidth } from '../utils/aggregate.js';
import { PEOPLE, getCurrentQuarter, weeksRemaining } from '../config.js';
import CapacityBar from '../components/CapacityBar.jsx';
import StatCard from '../components/StatCard.jsx';

export default function TeamOverview() {
  const [tasks, setTasks] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([fetchTasks(), fetchConfig()])
      .then(([t, c]) => { setTasks(t); setConfig(c); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageShell><p className="text-gray-500">Loading…</p></PageShell>;
  if (error)   return <PageShell><p className="text-red-400">Error: {error}</p></PageShell>;

  const today = new Date();
  const bw = calcBandwidth(tasks, config, today);
  const byPerson = groupByPerson(tasks);
  const q = getCurrentQuarter(today);
  const wksLeft = weeksRemaining(today);

  const totalBacklog = bw.team.teamBacklog;
  const teamWkly = bw.team.teamWeeklyCap;
  const wksToClear = bw.team.teamWksToClear;
  const isOverloaded = wksToClear > wksLeft;

  return (
    <PageShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Team Overview</h1>
        <p className="mt-1 text-sm text-gray-500">
          {q.label} · ends {q.end.toLocaleDateString()} · {wksLeft.toFixed(1)} weeks remaining
        </p>
      </div>

      {isOverloaded && (
        <div className="mb-6 rounded-lg border border-red-600/40 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          ⚠ Team backlog ({totalBacklog.toFixed(0)} pts) requires <strong>{wksToClear.toFixed(1)} weeks</strong> to clear at current capacity — but only <strong>{wksLeft.toFixed(1)} weeks</strong> remain in {q.label}.
        </div>
      )}

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Backlog" value={`${totalBacklog.toFixed(0)} pts`} sub="across team" color="indigo" />
        <StatCard label="Team Weekly Cap" value={`${teamWkly} pts`} sub="20% reserved" color="gray" />
        <StatCard label="Wks to Clear" value={wksToClear.toFixed(1)} sub={`of ${wksLeft.toFixed(1)} remaining`} color={isOverloaded ? 'red' : 'green'} />
        <StatCard label="Missing Points" value={bw.team.teamMissing} sub="tasks with no estimate" color={bw.team.teamMissing > 0 ? 'yellow' : 'gray'} />
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Individual Capacity</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
        {PEOPLE.map(p => {
          const pw = bw.people.find(x => x.gid === p.gid);
          const data = byPerson[p.gid];
          const wksToClearPerson = pw?.wksToClear ?? 0;
          const over = wksToClearPerson > wksLeft;
          return (
            <Link
              key={p.gid}
              to={`/person/${p.slug}`}
              className="block rounded-xl border border-gray-800 bg-gray-900 p-4 hover:border-indigo-600/50 transition-colors"
            >
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-700 font-bold text-white">
                  {p.name[0]}
                </div>
                <div>
                  <p className="font-semibold text-white">{p.name}</p>
                  <p className="text-xs text-gray-500">{data?.tasks.length ?? 0} tasks</p>
                </div>
              </div>
              <CapacityBar
                capacity={pw?.cap ?? 40}
                segments={[
                  { label: 'Backlog', value: pw?.backlog ?? 0, color: over ? 'bg-red-500' : 'bg-indigo-500' },
                ]}
              />
              <div className="mt-2 flex justify-between text-xs">
                <span className="text-gray-500">{(pw?.backlog ?? 0).toFixed(0)} pts backlog</span>
                <span className={over ? 'text-red-400 font-semibold' : 'text-gray-500'}>
                  {wksToClearPerson.toFixed(1)} wks to clear
                </span>
              </div>
              {(data?.missingPoints ?? 0) > 0 && (
                <p className="mt-1 text-xs text-yellow-500">⚠ {data.missingPoints} tasks missing Points</p>
              )}
            </Link>
          );
        })}
      </div>
    </PageShell>
  );
}

function PageShell({ children }) {
  return <div className="min-h-screen p-6">{children}</div>;
}
