import { useEffect, useState } from 'react';
import { fetchTasks, fetchConfig, updateConfig } from '../api/asana.js';
import { calcBandwidth, getPersonCapacity } from '../utils/aggregate.js';
import { PEOPLE, getCurrentQuarter, weeksRemaining } from '../config.js';
import CapacityBar from '../components/CapacityBar.jsx';
import StatCard from '../components/StatCard.jsx';

const DEFAULT_CAP = { weeklyHours: 40, meetingHours: 0, adminHours: 0 };

export default function BandwidthCalculator() {
  const [tasks, setTasks] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [localPeople, setLocalPeople] = useState({});
  const [hypothetical, setHypothetical] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([fetchTasks(), fetchConfig()])
      .then(([t, c]) => {
        setTasks(t);
        setConfig(c);
        // Seed local state from config
        const init = {};
        PEOPLE.forEach(p => {
          init[p.gid] = { ...DEFAULT_CAP, ...(c.people?.[p.gid] ?? {}) };
        });
        setLocalPeople(init);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Shell><p className="text-gray-400">Loading…</p></Shell>;
  if (error)   return <Shell><p className="text-red-600">Error: {error}</p></Shell>;

  const today = new Date();
  const q = getCurrentQuarter(today);
  const wksLeft = weeksRemaining(today);

  // Build a config object from local state for live preview
  const liveConfig = { ...config, people: localPeople };
  const bw = calcBandwidth(tasks, liveConfig, today);
  const { team, people, recurring, reservePercent } = bw;

  const hypPts = parseFloat(hypothetical) || 0;
  const hypWeeksAdded = team.teamWeeklyCap > 0
    ? hypPts / (team.teamWeeklyCap * (1 - reservePercent / 100))
    : 0;
  const newClearDate = new Date(today.getTime() + team.teamWksToClear * 7 * 24 * 60 * 60 * 1000);
  const hypClearDate = new Date(today.getTime() + (team.teamWksToClear + hypWeeksAdded) * 7 * 24 * 60 * 60 * 1000);
  const isOverloaded = team.teamWksToClear > wksLeft;

  function setPerson(gid, field, value) {
    setLocalPeople(prev => ({ ...prev, [gid]: { ...prev[gid], [field]: Number(value) } }));
  }

  async function saveCaps() {
    setSaving(true);
    try {
      const updated = await updateConfig({ people: localPeople });
      setConfig(updated);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Shell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Bandwidth Calculator</h1>
        <p className="mt-1 text-sm text-gray-500">
          {q.label} · {q.start.toLocaleDateString()} – {q.end.toLocaleDateString()} · {wksLeft.toFixed(1)} weeks remaining
        </p>
      </div>

      {isOverloaded && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          ⚠ At current capacity, the team needs <strong>{team.teamWksToClear.toFixed(1)} weeks</strong> to clear the backlog —
          that's <strong>{(team.teamWksToClear - wksLeft).toFixed(1)} weeks beyond</strong> the end of {q.label}.
        </div>
      )}

      {/* Team bar */}
      <div className="mb-6 rounded-xl border border-[#E5E0D8] bg-white p-4">
        <p className="mb-3 text-sm font-semibold text-gray-700">Team Quarter Capacity ({q.label})</p>
        <CapacityBar
          capacity={team.teamGrossQtr}
          segments={[
            { label: '20% Reserve', value: team.teamReserve, color: 'bg-red-300' },
            { label: 'Recurring', value: recurring.points, color: 'bg-amber-300' },
            { label: 'Backlog', value: Math.max(0, team.teamBacklog - recurring.points), color: 'bg-[#2D6A4F]' },
          ]}
          showLabel={false}
        />
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
          <span><span className="inline-block h-2 w-2 rounded-full bg-red-300 mr-1"></span>20% Reserve: {team.teamReserve.toFixed(0)} pts</span>
          <span><span className="inline-block h-2 w-2 rounded-full bg-amber-300 mr-1"></span>Recurring: {recurring.points.toFixed(0)} pts</span>
          <span><span className="inline-block h-2 w-2 rounded-full bg-[#2D6A4F] mr-1"></span>Backlog: {team.teamBacklog.toFixed(0)} pts</span>
          <span className="ml-auto text-gray-400">Gross: {team.teamGrossQtr.toFixed(0)} pts</span>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Team Production Cap" value={`${team.teamWeeklyCap} pts/wk`} color="green" />
        <StatCard label="Net Plannable (80%)" value={`${team.teamNetPlannable.toFixed(0)} pts`} color="gray" />
        <StatCard label="Total Backlog" value={`${team.teamBacklog.toFixed(0)} pts`} color={isOverloaded ? 'red' : 'green'} />
        <StatCard label="Missing Points" value={team.teamMissing} sub="no estimate" color={team.teamMissing > 0 ? 'yellow' : 'gray'} />
      </div>

      {/* Per-person capacity editor */}
      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">Weekly Capacity per Person</h2>
          <button
            onClick={saveCaps}
            disabled={saving}
            className="rounded-lg border border-[#2D6A4F]/40 bg-[#2D6A4F]/10 px-3 py-1 text-xs text-[#2D6A4F] hover:bg-[#2D6A4F]/20 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {people.map(pw => {
            const local = localPeople[pw.gid] ?? DEFAULT_CAP;
            const production = Math.max(0, local.weeklyHours - local.meetingHours - local.adminHours);
            const over = pw.wksToClear > wksLeft;
            const onVacation = local.weeklyHours === 0;
            return (
              <div key={pw.gid} className={`rounded-xl border p-4 ${onVacation ? 'border-gray-200 bg-gray-50 opacity-60' : 'border-[#E5E0D8] bg-white'}`}>
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2D6A4F] text-xs font-bold text-white">
                      {pw.name[0]}
                    </div>
                    <p className="font-semibold text-gray-900">{pw.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-mono ${over && !onVacation ? 'text-red-600' : 'text-gray-400'}`}>
                      {onVacation ? 'Out' : `${pw.wksToClear.toFixed(1)} wks to clear`}
                    </span>
                    {/* Vacation toggle */}
                    <button
                      onClick={() => setPerson(pw.gid, 'weeklyHours', local.weeklyHours === 0 ? 40 : 0)}
                      title="Toggle vacation (0 hours)"
                      className={`rounded px-1.5 py-0.5 text-xs border transition-colors ${
                        onVacation
                          ? 'bg-amber-100 border-amber-300 text-amber-700'
                          : 'bg-gray-100 border-gray-200 text-gray-400 hover:bg-amber-50 hover:text-amber-600'
                      }`}
                    >
                      {onVacation ? '🏖 Out' : 'Vacation'}
                    </button>
                  </div>
                </div>

                {/* Hours breakdown */}
                <div className="mb-3 space-y-2">
                  <SliderRow
                    label="Total weekly hours"
                    value={local.weeklyHours}
                    max={60}
                    color="text-gray-700"
                    bgColor="bg-gray-300"
                    onChange={v => setPerson(pw.gid, 'weeklyHours', v)}
                  />
                  <SliderRow
                    label="Meetings"
                    value={local.meetingHours}
                    max={local.weeklyHours}
                    color="text-red-500"
                    bgColor="bg-red-300"
                    onChange={v => setPerson(pw.gid, 'meetingHours', v)}
                    sub="hrs/wk in recurring meetings"
                  />
                  <SliderRow
                    label="Admin / Slack / Email"
                    value={local.adminHours}
                    max={local.weeklyHours}
                    color="text-amber-500"
                    bgColor="bg-amber-300"
                    onChange={v => setPerson(pw.gid, 'adminHours', v)}
                    sub="hrs/wk on non-production"
                  />
                </div>

                {/* Production capacity result */}
                <div className="rounded-lg bg-[#2D6A4F]/8 border border-[#2D6A4F]/20 px-3 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#2D6A4F]">Production Capacity</span>
                    <span className="font-mono text-sm font-bold text-[#2D6A4F]">{production} pts/wk</span>
                  </div>
                  <p className="text-xs text-[#2D6A4F]/60 mt-0.5">
                    {local.weeklyHours}h total − {local.meetingHours}h meetings − {local.adminHours}h admin = {production}h
                  </p>
                </div>

                {!onVacation && (
                  <div className="mt-2">
                    <CapacityBar
                      capacity={production}
                      segments={[{ label: 'Backlog', value: pw.backlog, color: over ? 'bg-red-400' : 'bg-[#2D6A4F]' }]}
                    />
                    {pw.missingPoints > 0 && (
                      <p className="mt-1 text-xs text-amber-600">+{pw.missingPoints} tasks with no Points estimate</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* What-if */}
      <div className="rounded-xl border border-[#E5E0D8] bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">What-If: New Request Impact</h2>
        <div className="flex items-center gap-3 mb-4">
          <label className="text-sm text-gray-600 whitespace-nowrap">New request size:</label>
          <input
            type="number" min={0} step={1}
            value={hypothetical}
            onChange={e => setHypothetical(e.target.value)}
            placeholder="e.g. 20"
            className="w-28 rounded-lg border border-[#E5E0D8] bg-[#FAF7F2] px-3 py-1.5 text-sm text-gray-800 outline-none focus:border-[#2D6A4F]"
          />
          <span className="text-sm text-gray-400">points</span>
        </div>
        {hypPts > 0 ? (
          <div className="space-y-2 text-sm">
            <p className="text-gray-600">
              Current projected clear: <strong className="text-gray-900">{newClearDate.toLocaleDateString()}</strong>
              {' '}({team.teamWksToClear.toFixed(1)} wks)
            </p>
            <p className="text-gray-600">
              With {hypPts} pts added: <strong className={hypClearDate > q.end ? 'text-red-600' : 'text-[#2D6A4F]'}>
                {hypClearDate.toLocaleDateString()}
              </strong>
              {' '}({(team.teamWksToClear + hypWeeksAdded).toFixed(1)} wks)
            </p>
            <p className="text-gray-400 text-xs">
              Pushes completion by <strong className="text-amber-600">{(hypWeeksAdded * 7).toFixed(0)} days</strong>.
            </p>
          </div>
        ) : (
          <p className="text-xs text-gray-400">Enter a point value above to see the impact.</p>
        )}
      </div>
    </Shell>
  );
}

function SliderRow({ label, value, max, color, bgColor, onChange, sub }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-0.5">
        <span className={`text-xs font-medium ${color} w-40`}>{label}</span>
        <input
          type="range" min={0} max={max || 60} step={1}
          value={value}
          onChange={e => onChange(e.target.value)}
          className={`flex-1 accent-[#2D6A4F]`}
        />
        <span className={`w-10 text-right text-xs font-mono font-semibold ${color}`}>{value}h</span>
      </div>
      {sub && <p className="text-xs text-gray-400 ml-40 pl-2">{sub}</p>}
    </div>
  );
}

function Shell({ children }) {
  return <div className="min-h-screen p-6 bg-[#FAF7F2]">{children}</div>;
}
