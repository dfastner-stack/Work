import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { fetchTasks } from '../api/asana.js';
import { groupByContentType, groupByPerson, getContentType, getPoints } from '../utils/aggregate.js';
import { PEOPLE } from '../config.js';
import TaskTable from '../components/TaskTable.jsx';

const PALETTE = ['#2D6A4F','#40916C','#52B788','#74C69D','#95D5B2','#B7E4C7','#F59E0B','#EF4444'];

export default function ContentTypes() {
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

  if (loading) return <Shell><p className="text-gray-400">Loading…</p></Shell>;
  if (error)   return <Shell><p className="text-red-600">Error: {error}</p></Shell>;

  const byType = groupByContentType(tasks);
  const barData = byType.map((t, i) => ({ name: t.name, pts: t.points, color: PALETTE[i % PALETTE.length] }));

  const byPerson = groupByPerson(tasks);
  const personTypeMatrix = PEOPLE.map(p => {
    const myTasks = byPerson[p.gid]?.tasks ?? [];
    const typeMap = {};
    for (const t of myTasks) {
      const types = getContentType(t).length ? getContentType(t) : ['Unspecified'];
      for (const tp of types) {
        if (!typeMap[tp]) typeMap[tp] = 0;
        typeMap[tp] += getPoints(t) ?? 0;
      }
    }
    return { person: p, typeMap };
  });

  const selectedType = selected != null ? byType.find(t => t.name === selected) : null;

  return (
    <Shell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Content Type Workload</h1>
        <p className="mt-1 text-sm text-gray-500">Bandwidth broken down by content type</p>
      </div>

      <div className="mb-8 rounded-xl border border-[#E5E0D8] bg-white p-4">
        <p className="mb-4 text-sm font-semibold text-gray-700">Points by Content Type</p>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={barData} onClick={d => d?.activePayload && setSelected(d.activePayload[0]?.payload?.name)}>
            <XAxis dataKey="name" tick={{ fill: '#9CA3AF', fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: '#9CA3AF', fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip formatter={v => `${v.toFixed(0)} pts`} contentStyle={{ background: '#fff', border: '1px solid #E5E0D8', borderRadius: 8, color: '#111827' }} />
            <Bar dataKey="pts" radius={[4, 4, 0, 0]} className="cursor-pointer">
              {barData.map((entry, i) => (
                <Cell key={i} fill={selected === entry.name ? entry.color : `${entry.color}99`} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mb-8 overflow-x-auto rounded-xl border border-[#E5E0D8] bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-[#E5E0D8] bg-[#F5F0E8]">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-400">Person</th>
              {byType.slice(0, 8).map(t => (
                <th key={t.name} className="px-3 py-3 text-right text-xs font-semibold uppercase text-gray-400 whitespace-nowrap">{t.name}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F0EBE3]">
            {personTypeMatrix.map(({ person, typeMap }) => (
              <tr key={person.gid} className="hover:bg-[#FAF7F2]">
                <td className="px-4 py-2 font-medium text-gray-700 whitespace-nowrap">{person.name}</td>
                {byType.slice(0, 8).map(t => (
                  <td key={t.name} className="px-3 py-2 text-right font-mono text-xs">
                    {typeMap[t.name] ? (
                      <span className="text-gray-800">{typeMap[t.name].toFixed(0)}</span>
                    ) : (
                      <span className="text-gray-200">—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedType && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-400">
              {selectedType.name} — {selectedType.tasks.length} tasks · {selectedType.points.toFixed(0)} pts
            </h2>
            <button onClick={() => setSelected(null)} className="text-xs text-gray-400 hover:text-gray-700">✕ Clear</button>
          </div>
          <TaskTable tasks={selectedType.tasks} showAssignee />
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }) {
  return <div className="min-h-screen p-6 bg-[#FAF7F2]">{children}</div>;
}
