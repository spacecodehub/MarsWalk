import React from 'react';
import {
  LayoutDashboard,
  Map,
  Compass,
  FlaskConical,
  FileText,
  Radio,
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Mission Control', icon: LayoutDashboard },
  { id: 'explore', label: 'Jezero GIS Map', icon: Map },
  { id: 'navigation', label: 'Route & EVA Nav', icon: Compass },
  { id: 'science', label: 'Science & MEDA', icon: FlaskConical },
  { id: 'reports', label: 'Expedition Reports', icon: FileText },
];

export default function Sidebar({ activePage, onNavigate, backendStatus }) {
  return (
    <aside className="relative z-20 w-64 bg-space-900/90 backdrop-blur-md border-r border-space-700 flex flex-col justify-between">
      <div>
        {/* Brand Header */}
        <div className="p-5 border-b border-space-700">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-mars-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-mars-500" />
            </span>
            <h1 className="text-base font-semibold tracking-wider text-white uppercase">
              MarsWalk
            </h1>
          </div>
          <p className="mt-1 text-xs font-mono text-slate-400">
            SECTOR: JEZERO CRATER
          </p>
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-1">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const active = activePage === id;
            return (
              <button
                key={id}
                onClick={() => onNavigate(id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  active
                    ? 'bg-mars-500/15 text-mars-500 border border-mars-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-space-800/60 border border-transparent'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Backend Telemetry Status Footer */}
      <div className="p-4 border-t border-space-700 bg-space-950/60">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="flex items-center gap-1.5 text-slate-400">
            <Radio className="w-3.5 h-3.5 text-mars-500" />
            API LINK
          </span>
          <span
            className={
              backendStatus === 'online'
                ? 'text-emerald-400'
                : backendStatus === 'offline'
                ? 'text-amber-400'
                : 'text-slate-500'
            }
          >
            {backendStatus === 'online'
              ? 'CONNECTED'
              : backendStatus === 'offline'
              ? 'AWAITING BACKEND'
              : 'CHECKING...'}
          </span>
        </div>
      </div>
    </aside>
  );
}
