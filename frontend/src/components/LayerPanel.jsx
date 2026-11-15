import React from 'react';
import { Layers } from 'lucide-react';

export default function LayerPanel({ layers = [], visibleLayers = {}, onToggleLayer }) {
  return (
    <div className="bg-space-900/90 backdrop-blur-md border border-space-700 rounded-xl p-4">
      <div className="flex items-center gap-2 text-xs font-mono uppercase text-slate-300 mb-3">
        <Layers className="w-3.5 h-3.5 text-mars-500" />
        <span>Jezero Map Layers</span>
      </div>

      {layers.length === 0 ? (
        <p className="text-xs font-mono text-slate-500">
          No raster or vector layers loaded from backend.
        </p>
      ) : (
        <div className="space-y-2">
          {layers.map((layer) => (
            <label
              key={layer.id}
              className="flex items-center justify-between gap-3 text-xs text-slate-300 cursor-pointer hover:text-white"
            >
              <span className="truncate">{layer.name}</span>
              <input
                type="checkbox"
                checked={!!visibleLayers[layer.id]}
                onChange={() => onToggleLayer(layer.id)}
                className="accent-mars-500 rounded"
              />
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
