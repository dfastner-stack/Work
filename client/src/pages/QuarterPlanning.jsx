import { useEffect, useState } from 'react';
import { fetchTasks, fetchConfig } from '../api/asana.js';
import { calcQuarterPlan, getPoints, groupByCampaign, getPersonCapacity } from '../utils/aggregate.js';
import { getCurrentQuarter, weeksInQuarter, PEOPLE } from '../config.js';
import CapacityBar from '../components/CapacityBar.jsx';
import StatCard from '../components/StatCard.jsx';

export default function QuarterPlanning() {
  const [tasks, setTasks] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newCampaignPts, setNewCampaignPts] = useState('');
  const [newCampaignName, setNewCampaignName] = useState('');
  const [hypotheticals, setHypotheticals] = useState([]);

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

  const hypPts = hypotheticals.reduce((s, h) => s + h.pts, 0);
  const effectiveAvailable = Math.max(0, availableForNew - hypPts);

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

      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Gross Capacity" value={`${grossQtrCapacity.toFixed(0)} pts`} sub={`${totalWks.toFixed(0)} wks × ${teamWeeklyCapacity} pts`} color="gray" />
        <StatCard label="Net Plannable (80%)" value={`${netPlannable.toFixed(0)} pts`} color="green" />
        <StatCard label="Committed (Recurring)" value={`${committedPoints.toFixed(0)} pts`} color="yellow" />
        <StatCard label={hypPts > 0 ? 'Available After Hyp.' : 'Available for New'} value={`${effectiveAvailable.toFixed(0)} pts`} color={effectiveAvailable < 0 ? 'red' : 'green'} />
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
              const fits = availableForNew - hypotheticals.slice(0, i + 1).reduce((s, x) => s + x.pts, 0) >= 0;
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
            ? `✓ ${effectiveAvailable.toFixed(0)} pts of capacity available this quarter (after reserve + recurring)`
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
