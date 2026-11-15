import React, { useState } from 'react';
import MarsMap from '../components/MarsMap';
import RoutePlanner from '../components/RoutePlanner';
import { Compass, AlertTriangle, CornerUpLeft, Navigation as NavIcon } from 'lucide-react';

export default function Navigation() {
  const [startPoint, setStartPoint] = useState([-100, 1080000]);
  const [destPoint, setDestPoint] = useState([-50, 1080100]);
  const [pickMode, setPickMode] = useState(null); // 'start' | 'dest' | null
  const [mode, setMode] = useState('safest'); // 'safest' | 'shortest' | 'science-aware'
  const [routeGeoJson, setRouteGeoJson] = useState(null);
  const [routeMetrics, setRouteMetrics] = useState(null);
  const [comparisonRoutes, setComparisonRoutes] = useState(null);
  const [astronautMode, setAstronautMode] = useState(false);
  const [activeLayer, setActiveLayer] = useState('dem');

  // Handle picking points on the interactive Mars map
  const handlePickPoint = (point) => {
    if (pickMode === 'start') {
      setStartPoint(point);
      setPickMode('dest'); // Auto-advance to pick destination
      setRouteGeoJson(null);
      setRouteMetrics(null);
      setComparisonRoutes(null);
    } else if (pickMode === 'dest') {
      setDestPoint(point);
      setPickMode(null); // Finished selecting both waypoints
      setRouteGeoJson(null);
      setRouteMetrics(null);
      setComparisonRoutes(null);
    }
  };

  // Single mode route calculated
  const handleRouteCalculated = (geojson, metrics) => {
    setRouteGeoJson(geojson);
    setRouteMetrics(metrics);
    setComparisonRoutes(null);
  };

  // Compare modes (both shortest and safest calculated)
  const handleCompareCalculated = (bothRoutes) => {
    setComparisonRoutes(bothRoutes);
    if (bothRoutes.safest) {
      setRouteGeoJson(bothRoutes.safest.geojson);
      setRouteMetrics(bothRoutes.safest);
    }
  };

  return (
    <div className="relative z-10 h-[calc(100vh-4rem)] p-4 flex flex-col gap-4">
      {/* Mode Switcher */}
      <div className="flex items-center justify-between bg-space-900/90 border border-space-700 rounded-xl px-4 py-2.5">
        <span className="text-xs font-mono text-slate-300">
          P4 TERRAIN TRAVERSE & ASTRONAUT EVA GUIDANCE
        </span>
        <button
          onClick={() => setAstronautMode((v) => !v)}
          className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
            astronautMode
              ? 'bg-mars-500 text-white'
              : 'bg-space-800 text-slate-300 border border-space-700 hover:border-mars-500/50'
          }`}
        >
          {astronautMode ? 'EXIT ASTRONAUT EVA VIEW' : 'SWITCH TO ASTRONAUT MODE'}
        </button>
      </div>

      {astronautMode ? (
        /* Mobile-Friendly Astronaut EVA Navigation HUD */
        <div className="max-w-xl mx-auto w-full bg-space-900/95 border border-mars-500/40 rounded-2xl p-6 space-y-5 animate-fade-in">
          <div className="flex items-center justify-between border-b border-space-700 pb-3">
            <div className="flex items-center gap-2 text-mars-500 font-mono text-xs uppercase">
              <Compass className="w-4 h-4" />
              <span>Astronaut Surface EVA HUD</span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-space-800 text-slate-400">
              P4 TRAVERSE ENGINE
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div className="p-3 rounded-lg bg-space-950 border border-space-800">
              <span className="text-slate-400 block mb-1">PLANNED DISTANCE</span>
              <span className="text-white font-bold">
                {routeMetrics?.distance_m
                  ? `${(routeMetrics.distance_m / 1000).toFixed(2)} km`
                  : 'Calculate in planner'}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-space-950 border border-space-800">
              <span className="text-slate-400 block mb-1">TOTAL GRID CELLS</span>
              <span className="text-white font-bold">
                {routeMetrics?.cells ? `${routeMetrics.cells} cells` : 'Standby'}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-space-950 border border-space-800">
              <span className="text-slate-400 block mb-1">PEAK SLOPE EXPOSURE</span>
              <span className="text-mars-500 font-bold">
                {routeMetrics?.slope_deg?.maximum !== undefined
                  ? `${routeMetrics.slope_deg.maximum.toFixed(1)}°`
                  : '—'}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-space-950 border border-space-800">
              <span className="text-slate-400 block mb-1">TERRAIN RISK INDEX</span>
              <span className="text-white font-bold">
                {routeMetrics?.average_risk !== undefined ? routeMetrics.average_risk.toFixed(2) : '—'}
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-space-950 border border-space-800 text-xs font-mono space-y-1.5">
            <div className="flex items-center gap-1.5 text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>HARD TERRAIN CONSTRAINTS EXCLUDED</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              {routeMetrics?.excluded_cells ? (
                `Masked NoData: ${routeMetrics.excluded_cells.nodata_or_uncovered?.toLocaleString()} cells • Exceeded Slope: ${routeMetrics.excluded_cells.slope_exceeds_limit?.toLocaleString()} cells`
              ) : (
                'No traverse calculated yet. Select waypoints on the map to compute an A* trajectory.'
              )}
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-space-950 border border-space-800 text-xs font-mono flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-slate-400">
              <CornerUpLeft className="w-3.5 h-3.5 text-mars-500" />
              <span>RETURN TRAVERSE PATH</span>
            </span>
            <span className="text-emerald-400">
              {routeGeoJson ? 'REVERSIBLE A* COORDINATES' : 'STANDBY'}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-0">
          <div className="lg:col-span-1 overflow-y-auto pr-1">
            <RoutePlanner
              startPoint={startPoint}
              destPoint={destPoint}
              onSelectStartPoint={setStartPoint}
              onSelectDestPoint={setDestPoint}
              pickMode={pickMode}
              setPickMode={setPickMode}
              mode={mode}
              setMode={setMode}
              onRouteCalculated={handleRouteCalculated}
              onCompareCalculated={handleCompareCalculated}
              routeResult={routeMetrics}
              comparisonResult={comparisonRoutes}
            />
          </div>
          <div className="lg:col-span-3 h-full min-h-[400px]">
            <MarsMap
              routeGeoJson={routeGeoJson}
              route={routeMetrics}
              comparisonRoutes={comparisonRoutes}
              startPoint={startPoint}
              destPoint={destPoint}
              pickMode={pickMode}
              onPickPoint={handlePickPoint}
              activeLayerId={activeLayer}
              onLayerChange={setActiveLayer}
            />
          </div>
        </div>
      )}
    </div>
  );
}
