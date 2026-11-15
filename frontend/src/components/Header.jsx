import React from 'react';
import { Sparkles, AlertTriangle } from 'lucide-react';

export default function Header({ title, subtitle, onToggleAssistant, assistantOpen, error }) {
  return (
    <header className="relative z-20 h-16 px-6 bg-space-900/75 backdrop-blur-md border-b border-space-700 flex items-center justify-between">
      <div>
        <h2 className="text-sm font-semibold tracking-wide text-white uppercase">
          {title}
        </h2>
        <p className="text-xs font-mono text-slate-400">{subtitle}</p>
      </div>

      <div className="flex items-center gap-4">
        {error && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          onClick={onToggleAssistant}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
            assistantOpen
              ? 'bg-mars-500 text-white border-mars-500'
              : 'bg-space-800 text-slate-200 border-space-700 hover:border-mars-500/50'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Mission AI</span>
        </button>
      </div>
    </header>
  );
}
