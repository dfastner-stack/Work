import { NavLink } from 'react-router-dom';
import { PEOPLE } from '../config.js';

const NAV = [
  { to: '/', label: 'Team Overview', icon: '🏠' },
  { to: '/bandwidth', label: 'Bandwidth Calculator', icon: '⚡' },
  { to: '/quarter', label: 'Quarter Planning', icon: '📅' },
  { to: '/campaigns', label: 'Campaign Tracker', icon: '🎯' },
  { to: '/pipeline', label: 'Content Pipeline', icon: '🔄' },
  { to: '/sprint', label: 'Sprint Planner', icon: '🏃' },
  { to: '/content-types', label: 'Content Types', icon: '🎨' },
  { to: '/overdue', label: 'Overdue & Stalled', icon: '🚨' },
];

export default function Sidebar({ onRefresh, refreshing }) {
  return (
    <aside className="flex h-screen w-56 flex-col border-r border-gray-800 bg-gray-950 text-sm">
      <div className="border-b border-gray-800 px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400">Content Dashboard</p>
        <p className="mt-0.5 text-xs text-gray-600">Content Calendar</p>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {NAV.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-lg px-3 py-2 transition-colors ${
                isActive ? 'bg-indigo-600/20 text-indigo-300' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
              }`
            }
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}

        <div className="mt-3 border-t border-gray-800 pt-3">
          <p className="px-3 text-xs font-semibold uppercase tracking-wide text-gray-600">Individuals</p>
          {PEOPLE.map(p => (
            <NavLink
              key={p.slug}
              to={`/person/${p.slug}`}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-lg px-3 py-2 transition-colors ${
                  isActive ? 'bg-indigo-600/20 text-indigo-300' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
                }`
              }
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-800 text-xs font-bold text-white">
                {p.name[0]}
              </span>
              <span>{p.name.split(' ')[0]}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      <div className="border-t border-gray-800 p-3">
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="w-full rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-400 hover:bg-gray-800 hover:text-gray-100 disabled:opacity-50"
        >
          {refreshing ? 'Refreshing…' : '↺ Refresh Data'}
        </button>
      </div>
    </aside>
  );
}
