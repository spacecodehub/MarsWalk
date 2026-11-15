import React, { useEffect, useState } from 'react';
import MarsMap from '../components/MarsMap';
import LayerPanel from '../components/LayerPanel';
import HazardPanel from '../components/HazardPanel';
import TargetDetails from '../components/TargetDetails';
import { MarsWalkAPI } from '../services/api';
import { Layers, ShieldAlert, Info } from 'lucide-react';

const P2_LAYER_DEFINITIONS = [
  { id: 'dem', name: 'HiRISE Digital Elevation Model (DEM)', unit: 'm', default_visible: true },
  { id: 'slope', name: 'Terrain Slope', unit: 'degrees', default_visible: true },
  { id: 'aspect', name: 'Terrain Aspect (Orientation)', unit: 'degrees', default_visible: false },
  { id: 'roughness', name: 'Surface Roughness (3x3)', unit: 'm', default_visible: false },
];

export default function Explore() {
  const [layers, setLayers] = useState([]);
  const [visibleLayers, setVisibleLayers] = useState({ dem: true, slope: true, aspect: false, roughness: false });
  const [targetsGeoJson, setTargetsGeoJson] = useState(null);
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [initialExtent, setInitialExtent] = useState([-3955, 1072242, 3629, 1088362]);
  const [layerMeta, setLayerMeta] = useState(null);

  useEffect(() => {
    MarsWalkAPI.getNavigationLayers().then(({ data }) => {
      if (data) {
        setLayerMeta(data);
        const configured = P2_LAYER_DEFINITIONS.map((def) => {
          const remote = data.layers?.[def.id] || {};
          return {
            id: def.id,
            name: def.name,
            unit: remote.unit || def.unit,
            resolution: '5 m / pixel',
            bounds: remote.bounds || [-3955, 1072242, 3629, 1088362],
            tile_url: MarsWalkAPI.getTerrainRasterUrl(def.id),
          };
        });
        setLayers(configured);
        if (data.layers?.dem?.bounds) {
          setInitialExtent(data.layers.dem.bounds);
        }
      }
    });

    MarsWalkAPI.getScienceTargets().then(({ data }) => {
      if (data) {
        if (data.located && data.located.length > 0) {
          setTargetsGeoJson({
            type: 'FeatureCollection',
            features: data.located.map((t) => ({
              type: 'Feature',
              properties: { name: t.name, id: t.target_id, ...t },
              geometry: { type: 'Point', coordinates: [t.location?.coordinates?.x, t.location?.coordinates?.y] },
            })),
          });
        }
        if (data.unlocated && data.unlocated.length > 0) {
          setSelectedTarget({
            name: data.unlocated[0].name,
            target_id: data.unlocated[0].target_id,
            reason: data.unlocated[0].reason,
            provenance: data.unlocated[0].provenance,
          });
        }
      }
    });
  }, []);

  const handleToggleLayer = (id) => {
    setVisibleLayers((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="relative z-10 h-[calc(100vh-4rem)] p-4 grid grid-cols-1 lg:grid-cols-4 gap-4">
      <div className="lg:col-span-3 h-full min-h-[420px] flex flex-col gap-2">
        <div className="flex-1 rounded-xl overflow-hidden border border-space-700 bg-space-950 relative">
          <MarsMap
            layersConfig={layers}
            visibleLayers={visibleLayers}
            onLayerChange={(id) => setVisibleLayers({ dem: id === 'dem', slope: id === 'slope', aspect: id === 'aspect', roughness: id === 'roughness' })}
            targetsGeoJson={targetsGeoJson}
            initialExtent={initialExtent}
            onSelectFeature={setSelectedTarget}
          />
        </div>

        {/* Coverage Note Footer */}
        {layerMeta?.coverage && (
          <div className="p-2.5 rounded-lg bg-space-900/90 border border-space-700 text-xs font-mono text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-amber-400">
              <Info className="w-3.5 h-3.5" />
              <span>{layerMeta.coverage}</span>
            </span>
            <span className="text-slate-500">P2 LOCAL EQUIRECTANGULAR GRID</span>
          </div>
        )}
      </div>

      <div className="space-y-4 overflow-y-auto pr-1">
        <LayerPanel
          layers={layers}
          visibleLayers={visibleLayers}
          onToggleLayer={handleToggleLayer}
        />
        <TargetDetails target={selectedTarget} />
        
        {/* Alignment & Provenance Card */}
        {layerMeta?.alignment && (
          <div className="bg-space-900/90 backdrop-blur-md border border-space-700 rounded-xl p-4 space-y-2 text-xs font-mono">
            <div className="flex items-center gap-1.5 text-mars-500 uppercase font-bold">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Dataset Alignment Provenance</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              {layerMeta.alignment.relative_estimate}
            </p>
            <p className="text-slate-500 text-[10px]">
              Accuracy: {layerMeta.alignment.absolute_accuracy}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
