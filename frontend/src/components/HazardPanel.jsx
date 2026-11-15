import React from 'react';
import { ShieldAlert } from 'lucide-react';

export default function HazardPanel({ hazards = [] }) {
  return (
    <div className="bg-space-900/90 backdrop-blur-md border border-space-700 rounded-xl p-4">
      <div className="flex items-center gap-2 text-xs font-mono uppercase text-slate-300 mb-3">
        <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
        <span>Terrain Hazards</span>
      </div>

      {hazards.length === 0 ? (
        <p className="text-xs font-mono text-slate-500">
          No mapped terrain hazards returned.
        </p>
      ) : (
        <ul className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {hazards.map((h, idx) => (
            <li
              key={h.id || idx}
              className="p-2.5 rounded-lg bg-space-950/80 border border-space-700 text-xs"
            >
              <div className="flex justify-between font-mono">
                <span className="text-slate-200">{h.type || 'Hazard Zone'}</span>
                <span className="text-amber-400">{h.severity ?? '—'}</span>
              </div>
              {h.description && (
                <p className="text-slate-400 mt-1">{h.description}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
