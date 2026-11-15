import React, { useState } from 'react';
import {
  Navigation,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Zap,
  Scale,
  AlertCircle,
  MapPin,
  Target,
  RotateCcw,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import { MarsWalkAPI } from '../services/api';

const PRESET_WAYPOINTS = [
  { id: 'delta_front', name: 'Jezero Delta Fan Front', coords: [-100, 1080000] },
  { id: 'delta_scarp', name: 'Delta Scarp Traverse', coords: [-50, 1080100] },
  { id: 'crater_floor', name: 'Crater Floor West', coords: [-500, 1079000] },
  { id: 'inlet_channel', name: 'Inlet Channel Base', coords: [200, 1081000] },
];

export default function RoutePlanner({
  startPoint = [-100, 1080000],
  destPoint = [-50, 1080100],
  onSelectStartPoint,
  onSelectDestPoint,
  pickMode,
  setPickMode,
  mode = 'safest',
  setMode,
  onRouteCalculated,
  onCompareCalculated,
  routeResult,
  comparisonResult,
}) {
  const [loading, setLoading] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState(null);
  const [showPresets, setShowPresets] = useState(false);

const formatRouteError = (err) => {
  if (!err) return null;
  const str = typeof err === 'string' ? err : JSON.stringify(err);
  if (str.includes('slope_exceeds_limit')) {
    return 'Selected waypoint is on a steep slope exceeding rover safety limit (>25°). Please pick a smoother waypoint on the delta plain or crater floor.';
  }
  if (str.includes('roughness_exceeds_limit')) {
    return 'Selected waypoint exceeds surface roughness limit (>10 m). Please choose a smoother area.';
  }
  if (str.includes('nodata_or_uncovered') || str.includes('outside covered terrain')) {
    return 'Selected point is in an unmapped or NoData area of the HiRISE swath. Please click inside the active terrain footprint.';
  }
  if (str.includes('No safe route') || str.includes('could not find a feasible path')) {
    return 'No safe path found between these waypoints under configured safety constraints (slopes ≤ 25°, roughness ≤ 10m). Try selecting points closer together or routing along the delta floor.';
  }
  return str;
};

  // Trigger single route calculation
  const handleCalculate = async (e) => {
    if (e) e.preventDefault();
    if (!startPoint || !destPoint) {
      setError('Please select both Source and Destination points on the map.');
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: apiErr } = await MarsWalkAPI.calculateRoute({
      start: startPoint,
      destination: destPoint,
      mode,
    });

    setLoading(false);
    if (apiErr) {
      setError(formatRouteError(apiErr));
      return;
    }

    if (onRouteCalculated && data?.geojson) {
      onRouteCalculated(data.geojson, data);
    }
  };

  // Trigger comparison: fetches both shortest and safest paths via /api/navigation/compare
  const handleCompare = async () => {
    if (!startPoint || !destPoint) {
      setError('Please select both Source and Destination points on the map.');
      return;
    }

    setComparing(true);
    setError(null);

    try {
      const { data, error: apiErr } = await MarsWalkAPI.compareRoutes({
        start: startPoint,
        destination: destPoint,
        mode,
      });

      if (apiErr || !data?.routes) {
        throw new Error(apiErr || 'Route comparison unavailable for these coordinates.');
      }

      const shortest = data.routes.shortest;
      const safest = data.routes.safest;

      if (!shortest?.feasible || !safest?.feasible) {
        throw new Error('One or both traverse modes could not find a feasible path at these coordinates.');
      }

      const distDelta = (safest.distance_m || 0) - (shortest.distance_m || 0);
      const riskDelta = (shortest.average_risk || 0) - (safest.average_risk || 0);

      const bothData = {
        safest,
        shortest,
        comparison: {
          distance_delta_m: distDelta,
          risk_delta: riskDelta,
        },
      };

      if (onCompareCalculated) {
        onCompareCalculated(bothData);
      }
    } catch (err) {
      setError(formatRouteError(err.message || 'Route comparison failed.'));
    } finally {
      setComparing(false);
    }
  };

  // Reset to default Jezero delta points
  const handleResetPoints = () => {
    if (onSelectStartPoint) onSelectStartPoint([-100, 1080000]);
    if (onSelectDestPoint) onSelectDestPoint([-50, 1080100]);
    if (setPickMode) setPickMode(null);
    setError(null);
  };

  return (
    <div className="bg-space-900/90 backdrop-blur-md border border-space-700 rounded-xl p-4 sm:p-5 space-y-4">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-mono uppercase text-mars-500">
          <Navigation className="w-4 h-4" />
          <span>P4 A* Terrain Pathfinding</span>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-space-800 text-slate-400">
          5m HiRISE Grid
        </span>
      </div>

      {/* Interactive Map Picking Instructions / Waypoint Cards */}
      <div className="space-y-2.5">
        {/* Source Waypoint Card */}
        <div
          className={`p-3 rounded-lg border transition-all ${
            pickMode === 'start'
              ? 'bg-emerald-500/15 border-emerald-500 shadow-md ring-1 ring-emerald-500/50'
              : 'bg-space-950/80 border-space-800'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-mono flex items-center gap-1.5 font-bold text-emerald-400">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500 flex items-center justify-center text-[10px]">
                S
              </span>
              <span>SOURCE (START)</span>
            </span>

            <button
              type="button"
              onClick={() => setPickMode && setPickMode(pickMode === 'start' ? null : 'start')}
              className={`px-2.5 py-1 rounded text-[11px] font-mono transition-all cursor-pointer ${
                pickMode === 'start'
                  ? 'bg-emerald-500 text-white font-bold animate-pulse'
                  : 'bg-space-800 hover:bg-space-700 text-emerald-300 border border-emerald-500/30'
              }`}
            >
              {pickMode === 'start' ? 'Click Map Now…' : 'Pick on Map'}
            </button>
          </div>

          <div className="text-xs font-mono text-slate-300 flex items-center justify-between">
            <span>
              {startPoint
                ? `E: ${startPoint[0].toFixed(1)} m · N: ${startPoint[1].toFixed(1)} m`
                : 'Click map to place source'}
            </span>
            {startPoint && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
          </div>
        </div>

        {/* Destination Waypoint Card */}
        <div
          className={`p-3 rounded-lg border transition-all ${
            pickMode === 'dest'
              ? 'bg-mars-500/15 border-mars-500 shadow-md ring-1 ring-mars-500/50'
              : 'bg-space-950/80 border-space-800'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-mono flex items-center gap-1.5 font-bold text-mars-400">
              <span className="w-5 h-5 rounded-full bg-mars-500/20 border border-mars-500 flex items-center justify-center text-[10px]">
                D
              </span>
              <span>DESTINATION (TARGET)</span>
            </span>

            <button
              type="button"
              onClick={() => setPickMode && setPickMode(pickMode === 'dest' ? null : 'dest')}
              className={`px-2.5 py-1 rounded text-[11px] font-mono transition-all cursor-pointer ${
                pickMode === 'dest'
                  ? 'bg-mars-500 text-white font-bold animate-pulse'
                  : 'bg-space-800 hover:bg-space-700 text-mars-300 border border-mars-500/30'
              }`}
            >
              {pickMode === 'dest' ? 'Click Map Now…' : 'Pick on Map'}
            </button>
          </div>

          <div className="text-xs font-mono text-slate-300 flex items-center justify-between">
            <span>
              {destPoint
                ? `E: ${destPoint[0].toFixed(1)} m · N: ${destPoint[1].toFixed(1)} m`
                : 'Click map to place destination'}
            </span>
            {destPoint && <CheckCircle2 className="w-3.5 h-3.5 text-mars-400" />}
          </div>
        </div>

        {/* Quick Map Flow Toolbar */}
        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={() => setPickMode && setPickMode('start')}
            className="flex items-center gap-1 text-[11px] font-mono text-mars-400 hover:text-mars-300 cursor-pointer"
          >
            <Target className="w-3 h-3" />
            <span>Select Both on Map</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPresets((v) => !v)}
              className="text-[11px] font-mono text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              {showPresets ? 'Hide Presets' : 'Presets'}
            </button>
            <button
              type="button"
              onClick={handleResetPoints}
              className="text-[11px] font-mono text-slate-500 hover:text-slate-300 cursor-pointer"
              title="Reset Waypoints"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Optional Presets Dropdown */}
        {showPresets && (
          <div className="p-2.5 rounded-lg bg-space-950 border border-space-800 space-y-2 text-xs font-mono animate-fade-in">
            <span className="text-[10px] text-slate-400 block uppercase">Jezero Crater Presets:</span>
            <div className="grid grid-cols-2 gap-1.5">
              {PRESET_WAYPOINTS.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => {
                    if (pickMode === 'dest' && onSelectDestPoint) onSelectDestPoint(w.coords);
                    else if (onSelectStartPoint) onSelectStartPoint(w.coords);
                  }}
                  className="p-1.5 text-left rounded bg-space-900 hover:bg-space-800 border border-space-800 text-[10px] text-slate-300 truncate cursor-pointer"
                  title={`${w.name} [${w.coords[0]}, ${w.coords[1]}]`}
                >
                  {w.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Route Optimization Preference */}
      <div className="space-y-1.5">
        <label className="block font-mono text-xs text-slate-400">TRAVERSE PREFERENCE</label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'safest', label: 'Safest', icon: ShieldCheck, color: 'text-amber-400' },
            { id: 'shortest', label: 'Shortest', icon: Zap, color: 'text-cyan-400' },
            { id: 'science-aware', label: 'Science', icon: Scale, color: 'text-emerald-400' },
          ].map(({ id, label, icon: Icon, color }) => (
            <button
              type="button"
              key={id}
              onClick={() => setMode && setMode(id)}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-mono transition-all cursor-pointer ${
                mode === id
                  ? 'bg-mars-500/20 border-mars-500 text-white font-bold shadow-md'
                  : 'bg-space-950 border-space-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${color}`} />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Action Buttons: Calculate Route & Compare Modes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
        <button
          type="button"
          onClick={handleCalculate}
          disabled={loading || comparing || !startPoint || !destPoint}
          className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-mars-500 hover:bg-mars-600 text-white font-semibold text-xs shadow-md transition-all disabled:opacity-50 cursor-pointer"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
          <span>{loading ? 'Calculating…' : `Calculate (${mode.toUpperCase()})`}</span>
        </button>

        <button
          type="button"
          onClick={handleCompare}
          disabled={loading || comparing || !startPoint || !destPoint}
          className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-space-800 hover:bg-space-700 border border-space-700 text-slate-200 font-semibold text-xs transition-all disabled:opacity-50 cursor-pointer"
          title="Calculate and display both Shortest and Safest routes on the map"
        >
          {comparing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Scale className="w-3.5 h-3.5 text-mars-500" />}
          <span>{comparing ? 'Comparing…' : 'Compare (Show Both)'}</span>
        </button>

        {(loading || comparing) && (
          <div className="col-span-1 sm:col-span-2 p-2 rounded bg-space-950/80 border border-amber-500/30 text-amber-300 text-[11px] font-mono flex items-center justify-center gap-2 animate-pulse">
            <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
            <span>Computing A* path across 5m HiRISE terrain grid. Please wait…</span>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-mono flex items-start gap-2 animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Comparison Result: Both Shortest & Safest Paths */}
      {comparisonResult && (
        <div className="p-3.5 rounded-xl bg-space-950 border border-space-700 space-y-3 font-mono text-xs animate-fade-in">
          <div className="flex items-center justify-between border-b border-space-800 pb-2">
            <span className="text-mars-500 font-bold uppercase flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5" />
              <span>Traverse Trade-Off Comparison</span>
            </span>
            <span className="text-[10px] text-emerald-400">BOTH DRAWN ON MAP</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            {/* Safest Column */}
            <div className="p-2 rounded bg-space-900 border border-amber-500/30 space-y-1">
              <span className="text-amber-400 font-bold block flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                SAFEST ROUTE
              </span>
              <div className="flex justify-between text-slate-300">
                <span>Dist:</span>
                <span className="text-white font-bold">
                  {comparisonResult.safest?.distance_m?.toFixed(1)} m
                </span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Risk:</span>
                <span className="text-emerald-400">
                  {comparisonResult.safest?.average_risk?.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Shortest Column */}
            <div className="p-2 rounded bg-space-900 border border-cyan-500/30 space-y-1">
              <span className="text-cyan-400 font-bold block flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                SHORTEST ROUTE
              </span>
              <div className="flex justify-between text-slate-300">
                <span>Dist:</span>
                <span className="text-white font-bold">
                  {comparisonResult.shortest?.distance_m?.toFixed(1)} m
                </span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Risk:</span>
                <span className="text-amber-400">
                  {comparisonResult.shortest?.average_risk?.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {comparisonResult.comparison && (
            <div className="border-t border-space-800 pt-2 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-400">DISTANCE DELTA:</span>
                <span className="text-white font-bold">
                  {comparisonResult.comparison.distance_delta_m ? `+${comparisonResult.comparison.distance_delta_m.toFixed(1)} m` : '0 m'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">RISK REDUCTION:</span>
                <span className="text-emerald-400 font-bold">
                  {comparisonResult.comparison.risk_delta ? `-${comparisonResult.comparison.risk_delta.toFixed(2)} pts` : '0'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Single Route Result Display */}
      {routeResult && !comparisonResult && (
        <div className="p-3.5 rounded-xl bg-space-950 border border-space-700 space-y-3 font-mono text-xs animate-fade-in">
          <div className="flex items-center justify-between border-b border-space-800 pb-2">
            <span className="text-mars-500 font-bold uppercase">
              P4 A* RESULT ({routeResult.mode})
            </span>
            <span className="text-emerald-400">{routeResult.cells} GRID CELLS</span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <span className="text-slate-400 block text-[10px]">TOTAL DISTANCE</span>
              <span className="text-white text-sm font-bold">
                {routeResult.distance_m ? `${(routeResult.distance_m / 1000).toFixed(2)} km` : '—'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">AVG TRAVERSE RISK</span>
              <span className="text-amber-400 text-sm font-bold">
                {routeResult.average_risk ? routeResult.average_risk.toFixed(2) : '—'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">PEAK SLOPE</span>
              <span className="text-slate-200">
                {routeResult.slope_deg?.maximum !== undefined
                  ? `${routeResult.slope_deg.maximum.toFixed(1)}°`
                  : '—'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">MAX ROUGHNESS</span>
              <span className="text-slate-200">
                {routeResult.roughness_m?.maximum !== undefined
                  ? `${routeResult.roughness_m.maximum.toFixed(2)} m`
                  : '—'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
