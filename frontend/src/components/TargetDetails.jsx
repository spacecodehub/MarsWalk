import React from 'react';
import { Crosshair } from 'lucide-react';

export default function TargetDetails({ target }) {
  return (
    <div className="bg-space-900/90 backdrop-blur-md border border-space-700 rounded-xl p-4">
      <div className="flex items-center gap-2 text-xs font-mono uppercase text-slate-300 mb-3">
        <Crosshair className="w-3.5 h-3.5 text-mars-500" />
        <span>Selected Target Telemetry</span>
      </div>

      {!target ? (
        <p className="text-xs font-mono text-slate-500">
          Select a scientific target on the Jezero Crater map to inspect metadata.
        </p>
      ) : (
        <div className="space-y-2 text-xs font-mono">
          {Object.entries(target).map(([key, val]) => {
            const isUrl = typeof val === 'string' && (val.startsWith('http://') || val.startsWith('https://'));
            const isArrayOfUrls =
              Array.isArray(val) &&
              val.length > 0 &&
              typeof val[0] === 'string' &&
              (val[0].startsWith('http://') || val[0].startsWith('https://'));

            return (
              <div key={key} className="flex flex-col gap-0.5 border-b border-space-800 pb-1.5">
                <span className="text-slate-400 text-[10px] uppercase font-semibold">
                  {key.replace(/_/g, ' ')}
                </span>
                {isUrl ? (
                  <a
                    href={val}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-mars-400 hover:text-mars-300 truncate text-[11px] underline"
                    title={val}
                  >
                    {val}
                  </a>
                ) : isArrayOfUrls ? (
                  <div className="flex flex-col gap-0.5">
                    {val.map((u, i) => (
                      <a
                        key={i}
                        href={u}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-mars-400 hover:text-mars-300 truncate text-[11px] underline"
                        title={u}
                      >
                        {u}
                      </a>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-100 text-[11px] break-words leading-relaxed">
                    {Array.isArray(val)
                      ? val.join(', ')
                      : typeof val === 'object' && val !== null
                      ? JSON.stringify(val)
                      : String(val ?? '—')}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
