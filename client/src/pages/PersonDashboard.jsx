import { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { fetchTasks, fetchConfig } from '../api/asana.js';
import { groupByPerson, groupBySection, getPoints, isOverdue, isDueSoon } from '../utils/aggregate.js';
import { PERSON_BY_SLUG, SECTIONS_ORDER, weeksRemaining } from '../config.js';
import CapacityBar from '../components/CapacityBar.jsx';
import StatCard from '../components/StatCard.jsx';
import TaskTable from '../components/TaskTable.jsx';
import SectionBadge from '../components/SectionBadge.jsx';

export default function PersonDashboard() {
  const { slug } = useParams();
  const person = PERSON_BY_SLUG[slug];
  const [tasks, setTasks] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sectionFilter, setSectionFilter] = useState('All');

  useEffect(() => {
    Promise.all([fetchTasks(), fetchConfig()])
      .then(([t, c]) => { setTasks(t); setConfig(c); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (!person) return <Navigate to="/" replace />;
  if (loading) return <Shell person={person}><p className="text-gray-500">Loading…</p></Shell>;
  if (error)   return <Shell person={person}><p className="text-red-400">Error: {error}</p></Shell>;

  const today = new Date();
  const wksLeft = weeksRemaining(today);
  const weeklyCapacity = config?.weeklyCapacity?.[person.gid] ?? 40;

  const byPerson = groupByPerson(tasks);
  const myTasks = byPerson[person.gid]?.tasks ?? [];
  const totalPoints = byPerson[person.gid]?.totalPoints ?? 0;
  const missingPoints = byPerson[person.gid]?.missingPoints ?? 0;

  const thiswkPts = myTasks.filter(t => isDueSoon(t, 7, today)).reduce((s, t) => s + (getPoints(t) ?? 0), 0);
  const overdueTasks = myTasks.filter(t => isOverdue(t, today));
  const wksToClear = weeklyCapacity > 0 ? totalPoints / (weeklyCapacity * (1 - (config?.reservePercent ?? 20) / 100)) : 0;

  const bySection = groupBySection(myTasks);
  const sections = SECTIONS_ORDER.filter(s => bySection[s]);

  const filtered = sectionFilter === 'All' ? myTasks : myTasks.filter(t => t.memberships?.[0]?.section?.name === sectionFilter);

  return (
    <Shell person={person}>
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Backlog" value={`${totalPoints.toFixed(0)} pts`} color="indigo" />
        <StatCard label="This Week Due" value={`${thiswkPts.toFixed(0)} pts`} sub="next 7 days" color={thiswkPts > weeklyCapacity ? 'red' : 'green'} />
        <StatCard label="Wks to Clear" value={wksToClear.toFixed(1)} sub={`of ${wksLeft.toFixed(1)} remaining`} color={wksToClear > wksLeft ? 'red' : 'green'} />
        <StatCard label="Missing Pts" value={missingPoints} sub="no estimate" color={missingPoints > 0 ? 'yellow' : 'gray'} />
      </div>

      <div className="mb-6 rounded-xl border border-gray-800 bg-gray-900 p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-300">Weekly Capacity</p>
          <p className="text-xs text-gray-500">{weeklyCapacity} pts/wk · 20% reserved</p>
        </div>
        <CapacityBar
          capacity={weeklyCapacity}
          segments={[
            { label: 'Due this week', value: thiswkPts, color: thiswkPts > weeklyCapacity * 0.8 ? 'bg-red-500' : 'bg-indigo-500' },
          ]}
        />
      </div>

      {overdueTasks.length > 0 && (
        <div className="mb-4 rounded-lg border border-red-600/40 bg-red-950/30 px-4 py-2 text-sm text-red-300">
          ⚠ {overdueTasks.length} overdue task{overdueTasks.length !== 1 ? 's' : ''} —{' '}
          {overdueTasks.reduce((s, t) => s + (getPoints(t) ?? 0), 0).toFixed(0)} pts locked
        </div>
      )}

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-400">By Stage</h2>
      <div className="mb-6 flex flex-wrap gap-2">
        {['All', ...sections].map(sec => (
          <button
            key={sec}
            onClick={() => setSectionFilter(sec)}
            className={`rounded-lg border px-3 py-1 text-xs font-medium transition-colors ${
              sectionFilter === sec
                ? 'border-indigo-500 bg-indigo-600/20 text-indigo-300'
                : 'border-gray-700 text-gray-400 hover:border-gray-500'
            }`}
          >
            {sec} {sec !== 'All' && bySection[sec] ? `(${bySection[sec].tasks.length})` : ''}
          </button>
        ))}
      </div>

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-400">
        Tasks ({filtered.length})
      </h2>
      <TaskTable tasks={filtered} showCampaign />
    </Shell>
  );
}

function Shell({ person, children }) {
  return (
    <div className="min-h-screen p-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-700 text-xl font-bold text-white">
          {person.name[0]}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">{person.name}</h1>
          <p className="text-sm text-gray-500">{person.email}</p>
        </div>
      </div>
      {children}
    </div>
  );
}
