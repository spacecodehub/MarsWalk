import React, { useEffect, useState } from 'react';
import {
  Map,
  Compass,
  FlaskConical,
  FileText,
  Thermometer,
  Wind,
  ShieldAlert,
  Radio,
  ChevronRight,
  RotateCcw,
  Sparkles,
  Layers,
  Database,
  Activity,
} from 'lucide-react';
import { MarsWalkAPI } from '../services/api';

export default function Dashboard({ onNavigate }) {
  const [mission, setMission] = useState(null);
  const [health, setHealth] = useState(null);
  const [meda, setMeda] = useState(null);
  const [layers, setLayers] = useState(null);
  const [targets, setTargets] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      MarsWalkAPI.getMission(),
      MarsWalkAPI.getHealth(),
      MarsWalkAPI.getMedaSummary(),
      MarsWalkAPI.getNavigationLayers(),
      MarsWalkAPI.getScienceTargets(),
    ]).then(([missionRes, healthRes, medaRes, layersRes, targetsRes]) => {
      if (missionRes.data) setMission(missionRes.data);
      if (healthRes.data) setHealth(healthRes.data);
      if (medaRes.data) setMeda(medaRes.data);
      if (layersRes.data) setLayers(layersRes.data);
      if (targetsRes.data) setTargets(targetsRes.data);
      setLoading(false);
    });
  }, []);

  const handleResetMars = () => {
    window.dispatchEvent(new CustomEvent('mars:reset-view'));
  };

  const primaryTarget = targets?.unlocated?.[0] || targets?.located?.[0];

  return (
    <div className="relative min-h-[calc(100vh-4rem)] p-6 lg:p-8 flex flex-col justify-between pointer-events-none animate-fade-in select-none">
      {/* Left Column: Mission Information & Real-Time Backend Telemetry */}
      <div className="w-full lg:w-8/12 xl:w-7/12 space-y-6">
        {/* Mission Status Header */}
        <div className="space-y-2 pointer-events-auto">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-mars-500/15 border border-mars-500/30 text-mars-500 text-xs font-mono tracking-wider uppercase">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-mars-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-mars-500" />
              </span>
              LOCATION: {mission?.location || 'JEZERO CRATER'}
            </span>

            <span className="px-2.5 py-1 rounded-md bg-space-900/90 border border-space-700 text-slate-300 text-xs font-mono flex items-center gap-1.5">
              <Database className="w-3 h-3 text-mars-500" />
              STATUS: {mission?.status || 'SIMULATION'}
            </span>

            <span className="px-2.5 py-1 rounded-md bg-space-900/90 border border-space-700 text-emerald-400 text-xs font-mono flex items-center gap-1">
              <Activity className="w-3 h-3" />
              {health?.terrain_available ? 'P4 & P2 ALIGNED' : 'CHECKING P4'}
            </span>
          </div>

          <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-white uppercase font-sans">
            {mission?.mission || 'MarsWalk Mission Control'}
          </h1>
          <p className="text-sm text-slate-300 max-w-xl font-light leading-relaxed">
            {mission?.objective || 'Study ancient river delta deposits and evaluate terrain traversability across Jezero Crater.'}
          </p>

          {/* Project MarsWalk Overview Card */}
          <div className="mt-4 p-4 rounded-xl bg-space-900/90 backdrop-blur-md border border-space-700/80 shadow-xl space-y-2.5">
            <div className="flex items-center justify-between border-b border-space-800 pb-2">
              <span className="text-xs font-mono uppercase text-mars-500 font-bold flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5" />
                <span>About MarsWalk • Jezero Crater Mission Overview</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-space-800 text-slate-400">
                P1 / P2 / P4 / P6 PLATFORM
              </span>
            </div>
            <p className="text-xs text-slate-300 font-light leading-relaxed">
              <strong>MarsWalk</strong> is an authentic planetary decision-support and traverse planning system engineered for surface exploration of <strong>Jezero Crater, Mars</strong> (18.38°N, 77.58°E). Integrating NASA Mars 2020 Perseverance rover telemetry, 5 m/pixel orbital HiRISE Digital Elevation Models (DEM), and terrain-aware A* pathfinding, MarsWalk enables mission teams and astronaut crews to evaluate terrain traversability, monitor atmospheric conditions via the MEDA instrument, and calculate constraint-verified surface routes across the ancient delta fan.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px] font-mono">
              <div className="p-2 rounded bg-space-950 border border-space-800">
                <span className="text-mars-400 font-semibold block">P2 · GIS Modeling</span>
                <span className="text-slate-400 text-[10px]">5 m HiRISE elevation, slope, aspect & roughness.</span>
              </div>
              <div className="p-2 rounded bg-space-950 border border-space-800">
                <span className="text-emerald-400 font-semibold block">P4 · Traverse Engine</span>
                <span className="text-slate-400 text-[10px]">A* pathfinding with &lt;25° slope safety constraints.</span>
              </div>
              <div className="p-2 rounded bg-space-950 border border-space-800">
                <span className="text-cyan-400 font-semibold block">P6 · Science Intel</span>
                <span className="text-slate-400 text-[10px]">Perseverance Sol 1 MEDA telemetry & PDS targets.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Real Backend Telemetry Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pointer-events-auto">
          {/* Sol & Sampling */}
          <div className="p-3.5 rounded-xl bg-space-900/85 backdrop-blur-md border border-space-700/80 shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-1.5">
              <span className="text-[11px] font-mono uppercase tracking-wider">EXPEDITION SOL</span>
              <Radio className="w-3.5 h-3.5 text-mars-500" />
            </div>
            <div className="text-xl font-bold font-mono text-white">
              {meda?.sol !== undefined ? `SOL ${meda.sol}` : 'SOL 1'}
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-0.5 truncate">
              {meda?.valid_row_count ? `${meda.valid_row_count} SAMPLES` : 'DERIVED PDS'}
            </div>
          </div>

          {/* Atmospheric Telemetry (MEDA Pressure) */}
          <div className="p-3.5 rounded-xl bg-space-900/85 backdrop-blur-md border border-space-700/80 shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-1.5">
              <span className="text-[11px] font-mono uppercase tracking-wider">MEDA PRESSURE</span>
              <Thermometer className="w-3.5 h-3.5 text-mars-500" />
            </div>
            <div className="text-xl font-bold font-mono text-white">
              {meda?.measurement?.mean ? `${meda.measurement.mean.toFixed(1)} Pa` : '715.0 Pa'}
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-0.5">
              {meda?.measurement ? `${meda.measurement.minimum.toFixed(0)}–${meda.measurement.maximum.toFixed(0)} Pa` : '714–716 Pa'}
            </div>
          </div>

          {/* HiRISE Terrain Footprint */}
          <div className="p-3.5 rounded-xl bg-space-900/85 backdrop-blur-md border border-space-700/80 shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-1.5">
              <span className="text-[11px] font-mono uppercase tracking-wider">P2 RESOLUTION</span>
              <Wind className="w-3.5 h-3.5 text-mars-500" />
            </div>
            <div className="text-lg font-bold font-mono text-white truncate">
              5.0 m / PIXEL
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-0.5 truncate">
              {layers?.layers?.dem ? `${layers.layers.dem.width}×${layers.layers.dem.height} GRID` : '1517×3224 GRID'}
            </div>
          </div>

          {/* Science Target Priority */}
          <div className="p-3.5 rounded-xl bg-space-900/85 backdrop-blur-md border border-space-700/80 shadow-lg">
            <div className="flex items-center justify-between text-slate-400 mb-1.5">
              <span className="text-[11px] font-mono uppercase tracking-wider">TARGET P6</span>
              <ShieldAlert className="w-3.5 h-3.5 text-mars-500" />
            </div>
            <div className="text-base font-bold font-mono text-white truncate" title={primaryTarget?.name}>
              DELTA REGION
            </div>
            <div className="text-[11px] font-mono text-mars-400 mt-0.5 truncate">
              {primaryTarget?.target_id || 'jezero-western-delta'}
            </div>
          </div>
        </div>

        {/* Quick Launch Mission Modules */}
        <div className="space-y-2 pointer-events-auto">
          <div className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-mars-500" />
            <span>Mission Control Operations</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* GIS Map */}
            <button
              onClick={() => onNavigate('explore')}
              className="group p-4 rounded-xl bg-space-900/90 hover:bg-space-800/95 backdrop-blur-md border border-space-700 hover:border-mars-500/50 text-left transition-all duration-200 shadow-lg flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-lg bg-mars-500/15 border border-mars-500/30 flex items-center justify-center text-mars-500 group-hover:scale-105 transition-transform">
                  <Map className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white group-hover:text-mars-500 transition-colors">
                    HiRISE Terrain GIS Map
                  </h3>
                  <p className="text-xs text-slate-400">
                    DEM, Slope, Aspect, Roughness (5m resolution)
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-mars-500 group-hover:translate-x-1 transition-all" />
            </button>

            {/* Route & EVA Navigation */}
            <button
              onClick={() => onNavigate('navigation')}
              className="group p-4 rounded-xl bg-space-900/90 hover:bg-space-800/95 backdrop-blur-md border border-space-700 hover:border-mars-500/50 text-left transition-all duration-200 shadow-lg flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-lg bg-mars-500/15 border border-mars-500/30 flex items-center justify-center text-mars-500 group-hover:scale-105 transition-transform">
                  <Compass className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white group-hover:text-mars-500 transition-colors">
                    P4 A* Route Planner
                  </h3>
                  <p className="text-xs text-slate-400">
                    Safest, shortest & science-aware terrain pathfinding
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-mars-500 group-hover:translate-x-1 transition-all" />
            </button>

            {/* Science & MEDA Telemetry */}
            <button
              onClick={() => onNavigate('science')}
              className="group p-4 rounded-xl bg-space-900/90 hover:bg-space-800/95 backdrop-blur-md border border-space-700 hover:border-mars-500/50 text-left transition-all duration-200 shadow-lg flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-lg bg-mars-500/15 border border-mars-500/30 flex items-center justify-center text-mars-500 group-hover:scale-105 transition-transform">
                  <FlaskConical className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white group-hover:text-mars-500 transition-colors">
                    Perseverance Science Data
                  </h3>
                  <p className="text-xs text-slate-400">
                    PDS MEDA time series & Mastcam-Z observations
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-mars-500 group-hover:translate-x-1 transition-all" />
            </button>

            {/* Expedition Reports */}
            <button
              onClick={() => onNavigate('reports')}
              className="group p-4 rounded-xl bg-space-900/90 hover:bg-space-800/95 backdrop-blur-md border border-space-700 hover:border-mars-500/50 text-left transition-all duration-200 shadow-lg flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-lg bg-mars-500/15 border border-mars-500/30 flex items-center justify-center text-mars-500 group-hover:scale-105 transition-transform">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white group-hover:text-mars-500 transition-colors">
                    Data Provenance & Reports
                  </h3>
                  <p className="text-xs text-slate-400">
                    P1/P2/P4/P6 verified provenance & limitations
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-mars-500 group-hover:translate-x-1 transition-all" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom HUD Bar: 3D Mars Navigation Guidance & Database Link */}
      <div className="w-full pt-6 flex flex-wrap items-center justify-between gap-4 pointer-events-auto">
        <div className="flex items-center gap-2 text-xs font-mono text-slate-400 bg-space-900/75 backdrop-blur-md border border-space-800 px-3.5 py-2 rounded-lg">
          <Sparkles className="w-3.5 h-3.5 text-mars-500 shrink-0" />
          <span>Interactive 3D Mars: Drag background to rotate • Mouse wheel to zoom</span>
        </div>

        <button
          onClick={handleResetMars}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-space-900/90 hover:bg-space-800 text-slate-300 hover:text-white border border-space-700 hover:border-mars-500/50 text-xs font-mono transition-all shadow-md active:scale-95 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5 text-mars-500" />
          <span>RECENTER JEZERO CRATER</span>
        </button>
      </div>
    </div>
  );
}
