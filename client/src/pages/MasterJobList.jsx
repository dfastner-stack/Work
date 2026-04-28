import { useEffect, useState, useMemo } from 'react';
import { fetchTasks } from '../api/asana.js';
import { getPoints, getSection, getCampaign, getContentType, getCustomField } from '../utils/aggregate.js';
import { PEOPLE, CUSTOM_FIELDS } from '../config.js';
import SectionBadge from '../components/SectionBadge.jsx';

const EXCLUDED_SECTIONS = new Set(['Finito', 'Reoccurring', 'On Hold']);

function getBlocker(task) {
  // Look for a custom field named "Blocker" (text type) — fails gracefully if not present
  const f = task.custom_fields?.find(f => f.name === 'Blocker');
  return f?.text_value ?? f?.display_value ?? null;
}

function daysDiff(dueDateStr) {
  if (!dueDateStr) return null;
  const due = new Date(dueDateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((due - today) / (1000 * 60 * 60 * 24));
}

const SORT_KEYS = ['due', 'name', 'assignee', 'points', 'section'];

export default function MasterJobList() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState([]);
  const [sectionFilter, setSectionFilter] = useState([]);
  const [contentTypeFilter, setContentTypeFilter] = useState('');
  const [sortKey, setSortKey] = useState('due');
  const [sortAsc, setSortAsc] = useState(true);

  useEffect(() => {
    fetchTasks()
      .then(t => setTasks(t))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const activeTasks = useMemo(
    () => tasks.filter(t => !EXCLUDED_SECTIONS.has(getSection(t))),
    [tasks]
  );

  // Available filter options
  const availableSections = useMemo(() => {
    const s = new Set(activeTasks.map(getSection));
    return [...s].sort();
  }, [activeTasks]);

  const filtered = useMemo(() => {
    let list = activeTasks;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(t => t.name?.toLowerCase().includes(q) || (getCampaign(t) ?? '').toLowerCase().includes(q));
    }
    if (assigneeFilter.length) {
      list = list.filter(t => assigneeFilter.includes(t.assignee?.gid ?? 'unassigned'));
    }
    if (sectionFilter.length) {
      list = list.filter(t => sectionFilter.includes(getSection(t)));
    }
    if (contentTypeFilter) {
      list = list.filter(t => getContentType(t).some(ct => ct.toLowerCase().includes(contentTypeFilter.toLowerCase())));
    }
    return [...list].sort((a, b) => {
      let av, bv;
      if (sortKey === 'due') {
        av = a.due_on ?? '9999-99-99';
        bv = b.due_on ?? '9999-99-99';
      } else if (sortKey === 'points') {
        av = getPoints(a) ?? -1;
        bv = getPoints(b) ?? -1;
      } else if (sortKey === 'assignee') {
        av = a.assignee?.name ?? 'zzz';
        bv = b.assignee?.name ?? 'zzz';
      } else if (sortKey === 'section') {
        av = getSection(a);
        bv = getSection(b);
      } else {
        av = a.name ?? '';
        bv = b.name ?? '';
      }
      if (av < bv) return sortAsc ? -1 : 1;
      if (av > bv) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [activeTasks, search, assigneeFilter, sectionFilter, contentTypeFilter, sortKey, sortAsc]);

  // Summary: total pts + by assignee
  const totalPts = filtered.reduce((s, t) => s + (getPoints(t) ?? 0), 0);
  const ptsByAssignee = useMemo(() => {
    const map = {};
    for (const t of filtered) {
      const name = t.assignee?.name ?? 'Unassigned';
      map[name] = (map[name] ?? 0) + (getPoints(t) ?? 0);
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  function toggleSort(key) {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(true); }
  }

  function toggleFilter(arr, setArr, val) {
    setArr(arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]);
  }

  if (loading) return <Shell><p className="text-gray-400">Loading…</p></Shell>;
  if (error)   return <Shell><p className="text-red-600">Error: {error}</p></Shell>;

  return (
    <Shell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Master Job List</h1>
        <p className="mt-1 text-sm text-gray-500">Every active job — {activeTasks.length} tasks · excludes Finito, Reoccurring, On Hold</p>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by task or campaign…"
          className="flex-1 min-w-48 rounded-lg border border-[#E5E0D8] bg-white px-3 py-1.5 text-sm text-gray-800 outline-none focus:border-[#2D6A4F]"
        />
        <input
          type="text"
          value={contentTypeFilter}
          onChange={e => setContentTypeFilter(e.target.value)}
          placeholder="Filter content type…"
          className="w-44 rounded-lg border border-[#E5E0D8] bg-white px-3 py-1.5 text-sm text-gray-800 outline-none focus:border-[#2D6A4F]"
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {PEOPLE.map(p => (
          <button key={p.gid} onClick={() => toggleFilter(assigneeFilter, setAssigneeFilter, p.gid)}
            className={`rounded-lg border px-3 py-1 text-xs font-medium transition-colors ${assigneeFilter.includes(p.gid) ? 'border-[#2D6A4F] bg-[#2D6A4F]/10 text-[#2D6A4F]' : 'border-[#E5E0D8] text-gray-500 hover:border-[#2D6A4F]/40'}`}>
            {p.name.split(' ')[0]}
          </button>
        ))}
        <button onClick={() => toggleFilter(assigneeFilter, setAssigneeFilter, 'unassigned')}
          className={`rounded-lg border px-3 py-1 text-xs font-medium transition-colors ${assigneeFilter.includes('unassigned') ? 'border-[#2D6A4F] bg-[#2D6A4F]/10 text-[#2D6A4F]' : 'border-[#E5E0D8] text-gray-500 hover:border-[#2D6A4F]/40'}`}>
          Unassigned
        </button>
        <span className="ml-2 border-l border-[#E5E0D8]" />
        {availableSections.map(sec => (
          <button key={sec} onClick={() => toggleFilter(sectionFilter, setSectionFilter, sec)}
            className={`rounded-lg border px-3 py-1 text-xs font-medium transition-colors ${sectionFilter.includes(sec) ? 'border-[#2D6A4F] bg-[#2D6A4F]/10 text-[#2D6A4F]' : 'border-[#E5E0D8] text-gray-500 hover:border-[#2D6A4F]/40'}`}>
            {sec}
          </button>
        ))}
        {(assigneeFilter.length || sectionFilter.length || search || contentTypeFilter) ? (
          <button onClick={() => { setAssigneeFilter([]); setSectionFilter([]); setSearch(''); setContentTypeFilter(''); }}
            className="rounded-lg border border-red-200 px-3 py-1 text-xs text-red-500 hover:bg-red-50">
            Clear filters
          </button>
        ) : null}
      </div>

      {/* Table */}
      <div className="mb-6 overflow-x-auto rounded-xl border border-[#E5E0D8] bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-[#E5E0D8] bg-[#F5F0E8]">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400 w-8">#</th>
              <SortTh label="Task" sortKey="name" current={sortKey} asc={sortAsc} onSort={toggleSort} className="px-3 py-2 text-left" />
              <SortTh label="Assignee" sortKey="assignee" current={sortKey} asc={sortAsc} onSort={toggleSort} className="px-3 py-2 text-left" />
              <SortTh label="Status" sortKey="section" current={sortKey} asc={sortAsc} onSort={toggleSort} className="px-3 py-2 text-left" />
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400">Campaign</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400">Type</th>
              <SortTh label="Points" sortKey="points" current={sortKey} asc={sortAsc} onSort={toggleSort} className="px-3 py-2 text-right" />
              <SortTh label="Due" sortKey="due" current={sortKey} asc={sortAsc} onSort={toggleSort} className="px-3 py-2 text-right" />
              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-400">Days</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-400">⚠</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0EBE3]">
            {filtered.map((task, idx) => {
              const days = daysDiff(task.due_on);
              const isOverdue = days !== null && days < 0;
              const isDueSoon = days !== null && days >= 0 && days <= 3;
              const pts = getPoints(task);
              const blocker = getBlocker(task);
              const types = getContentType(task);
              const campaign = getCampaign(task);
              return (
                <tr key={task.gid} className={`hover:bg-[#FAF7F2] ${isOverdue ? 'bg-red-50' : ''}`}>
                  <td className="px-3 py-2 text-xs text-gray-300">{idx + 1}</td>
                  <td className="px-3 py-2 max-w-xs">
                    <a href={task.permalink_url} target="_blank" rel="noreferrer"
                      className="text-gray-800 hover:text-[#2D6A4F] hover:underline line-clamp-2">
                      {task.name}
                    </a>
                  </td>
                  <td className="px-3 py-2">
                    {task.assignee ? (
                      <div className="flex items-center gap-1.5">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#2D6A4F] text-xs font-bold text-white">
                          {task.assignee.name[0]}
                        </span>
                        <span className="text-gray-600 text-xs whitespace-nowrap">{task.assignee.name.split(' ')[0]}</span>
                      </div>
                    ) : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                  <td className="px-3 py-2"><SectionBadge name={getSection(task)} /></td>
                  <td className="px-3 py-2 text-xs text-gray-500 max-w-[140px] truncate">{campaign ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{types.length ? types.join(', ') : <span className="text-gray-300">—</span>}</td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-gray-700">{pts != null ? pts : <span className="text-amber-400">?</span>}</td>
                  <td className={`px-3 py-2 text-right text-xs font-mono ${isOverdue ? 'text-red-600 font-semibold' : isDueSoon ? 'text-amber-600' : 'text-gray-500'}`}>
                    {task.due_on ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className={`px-3 py-2 text-right text-xs font-mono ${isOverdue ? 'text-red-600 font-bold' : isDueSoon ? 'text-amber-600' : 'text-gray-400'}`}>
                    {days != null ? (days === 0 ? 'today' : `${days}d`) : '—'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {blocker ? (
                      <span title={blocker} className="cursor-help text-amber-500">⚠</span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="rounded-xl border border-[#E5E0D8] bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-700">Summary — {filtered.length} tasks · {totalPts.toFixed(0)} pts total</p>
        </div>
        <div className="flex flex-wrap gap-3">
          {ptsByAssignee.map(([name, pts]) => (
            <div key={name} className="flex items-center gap-2 rounded-lg border border-[#E5E0D8] px-3 py-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#2D6A4F] text-xs font-bold text-white">
                {name[0]}
              </span>
              <span className="text-xs text-gray-600">{name.split(' ')[0]}</span>
              <span className="font-mono text-xs font-semibold text-gray-800">{pts.toFixed(0)} pts</span>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}

function SortTh({ label, sortKey, current, asc, onSort, className }) {
  const active = current === sortKey;
  return (
    <th className={`${className} text-xs font-semibold text-gray-400 cursor-pointer hover:text-gray-600 select-none`} onClick={() => onSort(sortKey)}>
      {label} {active ? (asc ? '↑' : '↓') : ''}
    </th>
  );
}

function Shell({ children }) {
  return <div className="min-h-screen p-6 bg-[#FAF7F2]">{children}</div>;
}
