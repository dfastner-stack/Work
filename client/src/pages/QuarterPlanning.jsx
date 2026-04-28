import { useEffect, useState } from 'react';
import { fetchTasks, fetchConfig } from '../api/asana.js';
import { calcQuarterPlan, getPoints, groupByCampaign, getPersonCapacity, getSection } from '../utils/aggregate.js';
import { getCurrentQuarter, weeksInQuarter, PEOPLE } from '../config.js';
import CapacityBar from '../components/CapacityBar.jsx';
import StatCard from '../components/StatCard.jsx';

const POINTS_GID = '1213794691220807';
const LS_PIPELINE_Q_KEY = 'qplan_pipeline_entries';

function loadPipelineEntries() {
  try { return JSON.parse(localStorage.getItem(LS_PIPELINE_Q_KEY) ?? '[]'); }
  catch { return []; }
}

export default function QuarterPlanning() {
  const [tasks, setTasks] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newCampaignPts, setNewCampaignPts] = useState('');
  const [newCampaignName, setNewCampaignName] = useState('');
  const [hypotheticals, setHypotheticals] = useState([]);
  const [pipelineEntries, setPipelineEntries] = useState(loadPipelineEntries);
  const [newPipelineName, setNewPipelineName] = useState('');
  const [newPipelinePts, setNewPipelinePts] = useState('');

  useEffect(() => {
    Promise.all([fetchTasks(), fetchConfig()])
      .then(([t, c]) => { setTasks(t); setConfig(c); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Shell><p className="text-gray-400">Loading…</p></Shell>;
  if (error)   return <Shell><p className="text-red-600">Error: {error}</p></Shell>;

  const today = new Date();
  const q = getCurrentQuarter(today);
  const totalWks = weeksInQuarter(today);
  const plan = calcQuarterPlan(tasks, config, today);
  const { team, recurring, campaigns, committedPoints, availableForNew, wksRemaining, reservePercent } = plan;

  const teamWeeklyCapacity = team.teamWeeklyCap;
  const grossQtrCapacity = teamWeeklyCapacity * totalWks;
  const reserve = grossQtrCapacity * (reservePercent / 100);
  const netPlannable = grossQtrCapacity - reserve;

  // Pipeline: Requests section tasks (auto) + manual entries
  const requestsTasks = tasks.filter(t => getSection(t) === 'Requests');
  const requestsPts = requestsTasks.reduce((s, t) => {
    const f = t.custom_fields?.find(f => f.gid === POINTS_GID);
    return s + (f?.number_value ?? 0);
  }, 0);
  const manualPipelinePts = pipelineEntries.reduce((s, e) => s + e.pts, 0);
  const totalPipelinePts = requestsPts + manualPipelinePts;
  const quarterTrueAvail = availableForNew - totalPipelinePts;

  const hypPts = hypotheticals.reduce((s, h) => s + h.pts, 0);
  const effectiveAvailable = Math.max(0, quarterTrueAvail - hypPts);

  function addPipelineEntry() {
    const pts = parseFloat(newPipelinePts);
    if (!pts || pts <= 0) return;
    const updated = [...pipelineEntries, { name: newPipelineName || `Pipeline ${pipelineEntries.length + 1}`, pts }];
    setPipelineEntries(updated);
    localStorage.setItem(LS_PIPELINE_Q_KEY, JSON.stringify(updated));
    setNewPipelineName(''); setNewPipelinePts('');
  }

  function removePipelineEntry(i) {
    const updated = pipelineEntries.filter((_, j) => j !== i);
    setPipelineEntries(updated);
    localStorage.setItem(LS_PIPELINE_Q_KEY, JSON.stringify(updated));
  }

  function addHypothetical() {
    const pts = parseFloat(newCampaignPts);
    if (!pts || pts <= 0) return;
    setHypotheticals(h => [...h, { name: newCampaignName || `New Campaign ${h.length + 1}`, pts }]);
    setNewCampaignPts('');
    setNewCampaignName('');
  }

  return (
    <Shell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Quarter Planning — {q.label}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {q.start.toLocaleDateString()} – {q.end.toLocaleDateString()} · {totalWks.toFixed(0)} weeks total · {wksRemaining.toFixed(1)} remaining
        </p>
      </div>

      <div className="mb-6 rounded-xl border border-[#E5E0D8] bg-white p-5">
        <p className="mb-3 text-sm font-semibold text-gray-700">Full Quarter Capacity Breakdown</p>
        <CapacityBar
          capacity={grossQtrCapacity}
          segments={[
            { label: '20% Reserve (net new / reactive)', value: reserve, color: 'bg-red-300' },
            { label: 'Recurring campaigns', value: recurring.points, color: 'bg-amber-300' },
            { label: 'Planned campaign backlog', value: Math.max(0, team.teamBacklog - recurring.points), color: 'bg-[#2D6A4F]' },
            { label: 'Hypothetical', value: hypPts, color: 'bg-purple-400' },
          ]}
          showLabel={false}
        />
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
          <span><span className="inline-block h-2 w-2 rounded-full bg-red-300 mr-1.5"></span>20% Reserve: {reserve.toFixed(0)} pts</span>
          <span><span className="inline-block h-2 w-2 rounded-full bg-amber-300 mr-1.5"></span>Recurring: {recurring.points.toFixed(0)} pts ({recurring.tasks.length} tasks)</span>
          <span><span className="inline-block h-2 w-2 rounded-full bg-[#2D6A4F] mr-1.5"></span>Planned: {Math.max(0, team.teamBacklog - recurring.points).toFixed(0)} pts</span>
          {hypPts > 0 && <span><span className="inline-block h-2 w-2 rounded-full bg-purple-400 mr-1.5"></span>Hypothetical: {hypPts.toFixed(0)} pts</span>}
          <span className="ml-auto text-gray-400">Gross: {grossQtrCapacity.toFixed(0)} pts</span>
        </div>
      </div>

      {/* Quarter formula */}
      <div className="mb-6 rounded-xl border border-[#E5E0D8] bg-white p-4">
        <p className="mb-3 text-sm font-semibold text-gray-700">Quarter Capacity Formula</p>
        <div className="space-y-1.5 font-mono text-sm">
          <div className="flex justify-between text-gray-600"><span>Quarter gross capacity</span><span>{grossQtrCapacity.toFixed(0)} pts</span></div>
          <div className="flex justify-between text-red-500"><span>− {reservePercent}% buffer reserve</span><span>−{reserve.toFixed(0)} pts</span></div>
          <div className="flex justify-between text-[#2D6A4F]"><span>= Net plannable</span><span>{netPlannable.toFixed(0)} pts</span></div>
          <div className="flex justify-between text-gray-600 pl-4"><span>− Committed (assigned backlog)</span><span>−{team.teamBacklog.toFixed(0)} pts</span></div>
          <div className="flex justify-between text-purple-600 pl-4"><span>− Pipeline (confirmed unassigned)</span><span>−{totalPipelinePts.toFixed(0)} pts</span></div>
          <div className={`flex justify-between font-bold border-t border-[#E5E0D8] pt-2 mt-2 ${quarterTrueAvail >= 0 ? 'text-[#2D6A4F]' : 'text-red-600'}`}>
            <span>= Quarter true available</span><span>{quarterTrueAvail.toFixed(0)} pts</span>
          </div>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Gross Capacity" value={`${grossQtrCapacity.toFixed(0)} pts`} sub={`${totalWks.toFixed(0)} wks × ${teamWeeklyCapacity} pts`} color="gray" />
        <StatCard label="Net Plannable (80%)" value={`${netPlannable.toFixed(0)} pts`} color="green" />
        <StatCard label="Pipeline" value={`${totalPipelinePts.toFixed(0)} pts`} sub={`${requestsTasks.length} in Requests + ${pipelineEntries.length} manual`} color="yellow" />
        <StatCard label="Quarter True Available" value={`${quarterTrueAvail.toFixed(0)} pts`} color={quarterTrueAvail < 0 ? 'red' : 'green'} />
      </div>

      <div className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Per-Person Quarter Capacity</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plan.people.map(pw => {
            const personCap = getPersonCapacity(pw.gid, config);
            const cap = personCap.productionHours * totalWks;
            const res = cap * (reservePercent / 100);
            const net = cap - res;
            const over = pw.backlog > net;
            return (
              <div key={pw.gid} className="rounded-xl border border-[#E5E0D8] bg-white p-4">
                <p className="font-semibold text-gray-900 mb-2">{pw.name}</p>
                <div className="space-y-1 text-xs text-gray-500">
                  <div className="flex justify-between"><span>Gross capacity</span><span className="text-gray-800 font-mono">{cap.toFixed(0)} pts</span></div>
                  <div className="flex justify-between"><span>20% reserve</span><span className="text-red-500 font-mono">−{res.toFixed(0)} pts</span></div>
                  <div className="flex justify-between border-t border-[#F0EBE3] pt-1"><span>Net plannable</span><span className="text-[#2D6A4F] font-mono">{net.toFixed(0)} pts</span></div>
                  <div className="flex justify-between"><span>Current backlog</span><span className={`font-mono ${over ? 'text-red-600' : 'text-gray-800'}`}>{pw.backlog.toFixed(0)} pts</span></div>
                  {over && <p className="text-red-600 font-semibold">⚠ Over by {(pw.backlog - net).toFixed(0)} pts</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">
          Campaigns in Backlog ({campaigns.length})
        </h2>
        <div className="overflow-x-auto rounded-xl border border-[#E5E0D8] bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-[#E5E0D8] bg-[#F5F0E8]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-400">Campaign</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-400">Tasks</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-400">Points</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-400">% of Capacity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0EBE3]">
              {campaigns.map(c => {
                const pct = netPlannable > 0 ? (c.points / netPlannable * 100) : 0;
                const isRecurring = recurring.tasks.some(t => {
                  const cf = t.custom_fields?.find(f => f.gid === '1212986597975832');
                  return cf?.display_value === c.name;
                });
                return (
                  <tr key={c.name} className="hover:bg-[#FAF7F2]">
                    <td className="px-4 py-2 text-gray-700">
                      {c.name}
                      {isRecurring && <span className="ml-2 rounded bg-amber-100 px-1 py-0.5 text-xs text-amber-700">recurring</span>}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-gray-500">{c.tasks.length}</td>
                    <td className="px-4 py-2 text-right font-mono text-gray-800">{c.points.toFixed(0)}</td>
                    <td className="px-4 py-2 text-right font-mono text-gray-500">{pct.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pipeline section */}
      <div className="mb-8 rounded-xl border border-purple-200 bg-purple-50 p-5">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-purple-700">Pipeline — Confirmed Upcoming Work</h2>
        <p className="mb-4 text-xs text-purple-500">Confirmed campaigns not yet assigned in Asana. Requests-section tasks are pulled automatically.</p>

        {requestsTasks.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium text-purple-700 mb-2">Auto-pulled from Requests section ({requestsPts.toFixed(0)} pts)</p>
            <div className="space-y-1">
              {requestsTasks.filter(t => (t.custom_fields?.find(f => f.gid === POINTS_GID)?.number_value ?? 0) > 0).map(t => {
                const pts = t.custom_fields?.find(f => f.gid === POINTS_GID)?.number_value ?? 0;
                return (
                  <div key={t.gid} className="flex items-center justify-between rounded-lg bg-white px-3 py-1.5 text-sm border border-purple-100">
                    <a href={t.permalink_url} target="_blank" rel="noreferrer" className="text-gray-700 hover:text-[#2D6A4F] truncate mr-4">{t.name}</a>
                    <span className="font-mono text-purple-600 shrink-0">{pts.toFixed(0)} pts</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {pipelineEntries.length > 0 && (
          <div className="mb-4 space-y-1">
            {pipelineEntries.map((e, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-white px-3 py-1.5 text-sm border border-purple-100">
                <span className="text-gray-700">{e.name}</span>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-purple-600">{e.pts} pts</span>
                  <button onClick={() => removePipelineEntry(i)} className="text-xs text-gray-300 hover:text-gray-600">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <input type="text" value={newPipelineName} onChange={e => setNewPipelineName(e.target.value)} placeholder="Campaign name"
            className="flex-1 min-w-40 rounded-lg border border-purple-200 bg-white px-3 py-1.5 text-sm text-gray-800 outline-none focus:border-purple-500" />
          <input type="number" min={0} step={1} value={newPipelinePts} onChange={e => setNewPipelinePts(e.target.value)} placeholder="Points"
            className="w-28 rounded-lg border border-purple-200 bg-white px-3 py-1.5 text-sm text-gray-800 outline-none focus:border-purple-500" />
          <button onClick={addPipelineEntry}
            className="rounded-lg border border-purple-300 bg-white px-4 py-1.5 text-sm text-purple-700 hover:bg-purple-100">
            Add
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-[#E5E0D8] bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-400">What-If: New Campaign Planner</h2>
        <p className="mb-3 text-xs text-gray-400">Add hypothetical campaigns to see if they fit in the quarter's remaining capacity.</p>

        <div className="mb-4 flex flex-wrap gap-3">
          <input
            type="text"
            value={newCampaignName}
            onChange={e => setNewCampaignName(e.target.value)}
            placeholder="Campaign name"
            className="flex-1 min-w-40 rounded-lg border border-[#E5E0D8] bg-[#FAF7F2] px-3 py-1.5 text-sm text-gray-800 outline-none focus:border-[#2D6A4F]"
          />
          <input
            type="number" min={0} step={1}
            value={newCampaignPts}
            onChange={e => setNewCampaignPts(e.target.value)}
            placeholder="Points"
            className="w-28 rounded-lg border border-[#E5E0D8] bg-[#FAF7F2] px-3 py-1.5 text-sm text-gray-800 outline-none focus:border-[#2D6A4F]"
          />
          <button
            onClick={addHypothetical}
            className="rounded-lg border border-[#2D6A4F]/40 bg-[#2D6A4F]/10 px-4 py-1.5 text-sm text-[#2D6A4F] hover:bg-[#2D6A4F]/20"
          >
            Add
          </button>
        </div>

        {hypotheticals.length > 0 && (
          <div className="mb-4 space-y-1">
            {hypotheticals.map((h, i) => {
              const fits = quarterTrueAvail - hypotheticals.slice(0, i + 1).reduce((s, x) => s + x.pts, 0) >= 0;
              return (
                <div key={i} className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm border ${fits ? 'bg-[#2D6A4F]/5 border-[#2D6A4F]/20' : 'bg-red-50 border-red-200'}`}>
                  <span className={fits ? 'text-[#2D6A4F]' : 'text-red-600'}>{fits ? '✓' : '✗'} {h.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-gray-600">{h.pts} pts</span>
                    <button onClick={() => setHypotheticals(hs => hs.filter((_, j) => j !== i))} className="text-xs text-gray-300 hover:text-gray-600">✕</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className={`rounded-lg px-4 py-3 text-sm border ${effectiveAvailable >= 0 ? 'bg-[#2D6A4F]/5 border-[#2D6A4F]/20 text-[#2D6A4F]' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {effectiveAvailable >= 0
            ? `✓ ${effectiveAvailable.toFixed(0)} pts available after reserve, committed work, and pipeline`
            : `✗ Over capacity by ${Math.abs(effectiveAvailable).toFixed(0)} pts — something must be cut or deferred`
          }
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }) {
  return <div className="min-h-screen p-6 bg-[#FAF7F2]">{children}</div>;
}
