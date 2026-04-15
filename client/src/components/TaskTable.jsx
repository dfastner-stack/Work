import { useState } from 'react';
import SectionBadge from './SectionBadge.jsx';
import { getPoints, getSection, isOverdue } from '../utils/aggregate.js';

export default function TaskTable({ tasks, showAssignee = false, showCampaign = false }) {
  const [sortKey, setSortKey] = useState('due_on');
  const [sortDir, setSortDir] = useState('asc');

  const today = new Date();

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  const sorted = [...tasks].sort((a, b) => {
    let av, bv;
    if (sortKey === 'due_on') {
      av = a.due_on ?? '9999';
      bv = b.due_on ?? '9999';
    } else if (sortKey === 'points') {
      av = getPoints(a) ?? -1;
      bv = getPoints(b) ?? -1;
    } else if (sortKey === 'section') {
      av = getSection(a);
      bv = getSection(b);
    } else if (sortKey === 'name') {
      av = a.name;
      bv = b.name;
    } else {
      av = a[sortKey] ?? '';
      bv = b[sortKey] ?? '';
    }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const Th = ({ col, label }) => (
    <th
      className="cursor-pointer select-none px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 hover:text-white"
      onClick={() => toggleSort(col)}
    >
      {label} {sortKey === col ? (sortDir === 'asc' ? '↑' : '↓') : ''}
    </th>
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-800">
      <table className="w-full text-sm">
        <thead className="bg-gray-900">
          <tr>
            <Th col="name" label="Task" />
            {showAssignee && <Th col="assignee" label="Assignee" />}
            <Th col="section" label="Stage" />
            <Th col="points" label="Pts" />
            <Th col="due_on" label="Due" />
            {showCampaign && <Th col="campaign" label="Campaign" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800/50">
          {sorted.map(task => {
            const pts = getPoints(task);
            const overdue = isOverdue(task, today);
            const rowCls = overdue ? 'bg-red-950/30' : 'bg-gray-900/40 hover:bg-gray-800/60';
            return (
              <tr key={task.gid} className={rowCls}>
                <td className="max-w-xs px-3 py-2">
                  <a
                    href={task.permalink_url}
                    target="_blank"
                    rel="noreferrer"
                    className="line-clamp-1 text-indigo-400 hover:text-indigo-300 hover:underline"
                  >
                    {task.name || '(untitled)'}
                  </a>
                </td>
                {showAssignee && (
                  <td className="px-3 py-2 text-gray-300 whitespace-nowrap">
                    {task.assignee?.name ?? <span className="text-gray-600">Unassigned</span>}
                  </td>
                )}
                <td className="px-3 py-2">
                  <SectionBadge name={getSection(task)} />
                </td>
                <td className="px-3 py-2 text-right font-mono">
                  {pts !== null ? (
                    <span className="text-white">{pts}</span>
                  ) : (
                    <span className="text-gray-600">—</span>
                  )}
                </td>
                <td className={`px-3 py-2 whitespace-nowrap font-mono text-xs ${overdue ? 'text-red-400 font-semibold' : 'text-gray-400'}`}>
                  {task.due_on ?? <span className="text-gray-700">No date</span>}
                  {overdue && ' ⚠'}
                </td>
                {showCampaign && (
                  <td className="px-3 py-2 text-gray-400 text-xs">
                    {task.custom_fields?.find(f => f.gid === '1212986597975832')?.display_value ?? '—'}
                  </td>
                )}
              </tr>
            );
          })}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={5 + (showAssignee ? 1 : 0) + (showCampaign ? 1 : 0)} className="py-8 text-center text-gray-600">
                No tasks found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
