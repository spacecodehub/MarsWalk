import React, { useEffect, useState } from 'react';
import { FlaskConical, ExternalLink, ShieldCheck, Database, FileText, CheckCircle2, AlertTriangle } from 'lucide-react';
import { MarsWalkAPI } from '../services/api';

export default function Science() {
  const [observations, setObservations] = useState([]);
  const [medaSummary, setMedaSummary] = useState(null);
  const [targets, setTargets] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      MarsWalkAPI.getObservations(),
      MarsWalkAPI.getMedaSummary(),
      MarsWalkAPI.getScienceTargets(),
    ]).then(([obsRes, medaRes, targetsRes]) => {
      if (obsRes.data) setObservations(obsRes.data);
      if (medaRes.data) setMedaSummary(medaRes.data);
      if (targetsRes.data) setTargets(targetsRes.data);
      setLoading(false);
    });
  }, []);

  return (
    <div className="relative z-10 p-6 space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="bg-space-900/90 backdrop-blur-md border border-space-700 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase text-mars-500 mb-1">
            <FlaskConical className="w-4 h-4" />
            <span>P6 Science & Environmental Intelligence</span>
          </div>
          <h2 className="text-xl font-bold text-white font-sans">
            NASA Mars 2020 Perseverance Telemetry & Targets
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Verified Planetary Data System (PDS) atmospheric records and deltaic sedimentary targets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            PDS CHECKSUM VERIFIED
          </span>
        </div>
      </div>

      {/* MEDA Atmospheric Telemetry Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: MEDA Time Series Plot Image */}
        <div className="lg:col-span-2 bg-space-900/90 backdrop-blur-md border border-space-700 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono uppercase text-mars-500 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5" />
              <span>MEDA Pressure Sensor Time Series (Sol 1)</span>
            </h3>
            <span className="text-[11px] font-mono text-slate-400">
              Product: WE__0001___________DER_PS_P02
            </span>
          </div>

          <div className="relative rounded-lg overflow-hidden border border-space-800 bg-space-950 p-2">
            <img
              src="/data/science/meda/reports/WE__0001___________DER_PS__________________P02_pressure.png"
              alt="MEDA Sol 1 Atmospheric Pressure Plot"
              className="w-full h-auto object-contain rounded"
            />
          </div>

          <p className="text-xs text-slate-400 font-light leading-relaxed">
            Perseverance MEDA derived pressure sensor product recorded across Sol 1. Row-level time basis is recorded as SCLK, LMST, and LTST; bounds verified against PDS4 detached XML label.
          </p>
        </div>

        {/* Right: Statistical Summary Metrics */}
        <div className="bg-space-900/90 backdrop-blur-md border border-space-700 rounded-xl p-5 space-y-4">
          <h3 className="text-xs font-mono uppercase text-mars-500">
            PDS Derived Statistics
          </h3>

          {medaSummary ? (
            <dl className="space-y-3 font-mono text-xs">
              <div className="flex justify-between border-b border-space-800 pb-2">
                <dt className="text-slate-400">SOL RECORDED</dt>
                <dd className="text-white font-bold">SOL {medaSummary.sol}</dd>
              </div>
              <div className="flex justify-between border-b border-space-800 pb-2">
                <dt className="text-slate-400">VALID SAMPLES</dt>
                <dd className="text-white">{medaSummary.valid_row_count} rows</dd>
              </div>
              <div className="flex justify-between border-b border-space-800 pb-2">
                <dt className="text-slate-400">MEAN PRESSURE</dt>
                <dd className="text-mars-400 font-bold">
                  {medaSummary.measurement?.mean?.toFixed(2)} {medaSummary.measurement?.unit}
                </dd>
              </div>
              <div className="flex justify-between border-b border-space-800 pb-2">
                <dt className="text-slate-400">PRESSURE RANGE</dt>
                <dd className="text-slate-200">
                  {medaSummary.measurement?.minimum?.toFixed(1)} – {medaSummary.measurement?.maximum?.toFixed(1)} {medaSummary.measurement?.unit}
                </dd>
              </div>
              <div className="flex justify-between border-b border-space-800 pb-2">
                <dt className="text-slate-400">MEDIAN PRESSURE</dt>
                <dd className="text-slate-200">{medaSummary.measurement?.median?.toFixed(2)} Pa</dd>
              </div>
              <div className="flex justify-between border-b border-space-800 pb-2">
                <dt className="text-slate-400">STANDARD DEVIATION</dt>
                <dd className="text-slate-200">{medaSummary.measurement?.standard_deviation_population?.toFixed(3)} Pa</dd>
              </div>
              <div className="flex flex-col gap-1 pt-1 text-[10px]">
                <span className="text-slate-500">VERIFIED MD5 HASH</span>
                <span className="text-slate-400 font-mono break-all">{medaSummary.raw_file_md5_verified}</span>
              </div>
            </dl>
          ) : (
            <div className="text-xs font-mono text-slate-500">Loading MEDA telemetry product...</div>
          )}
        </div>
      </div>

      {/* P6 Science Targets & Observations Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* P6 Science Target Card */}
        <div className="bg-space-900/90 backdrop-blur-md border border-space-700 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono uppercase text-mars-500 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Evidence-Linked Science Target</span>
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-space-800 text-slate-400">
              P6 CATALOGUE
            </span>
          </div>

          {targets?.unlocated?.map((t) => (
            <div key={t.target_id} className="p-4 rounded-lg bg-space-950 border border-space-800 space-y-3 font-mono text-xs">
              <div className="flex justify-between items-start">
                <span className="text-white font-bold text-sm">{t.name}</span>
                <span className="text-mars-400 text-[10px] uppercase">{t.target_id}</span>
              </div>

              <div className="p-2.5 rounded bg-space-900 border border-space-800 text-slate-300 text-[11px] font-sans">
                <strong>Reason: </strong> {t.reason}
              </div>

              <div className="space-y-1.5 text-[11px]">
                <span className="text-slate-400 block uppercase">Authoritative Provenance Sources:</span>
                {(Array.isArray(t.provenance)
                  ? t.provenance
                  : typeof t.provenance === 'string'
                  ? t.provenance.trim().split(/\s+/)
                  : []
                ).map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-mars-400 hover:text-mars-300 underline break-all"
                  >
                    <ExternalLink className="w-3 h-3 shrink-0" />
                    <span>{url}</span>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Mars 2020 Geological Observations */}
        <div className="bg-space-900/90 backdrop-blur-md border border-space-700 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono uppercase text-mars-500 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              <span>Rover Observations Catalog</span>
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-space-800 text-slate-400">
              {observations.length} RECORDED
            </span>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {observations.map((obs, i) => (
              <div key={obs.record_id || i} className="p-3.5 rounded-lg bg-space-950 border border-space-800 space-y-2 text-xs">
                <div className="flex justify-between font-mono">
                  <span className="text-white font-bold">{obs.mission}</span>
                  <span className="text-mars-500">{obs.instrument}</span>
                </div>

                <p className="text-slate-300 text-[11px] leading-relaxed">
                  {obs.description}
                </p>

                <div className="text-[10px] font-mono text-slate-400 flex flex-wrap gap-2">
                  <span>SOLS: {obs.sols?.join(', ') || 'N/A'}</span>
                  <span>CATEGORY: {obs.scientific_category}</span>
                </div>

                {obs.source_url && (
                  <a
                    href={obs.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-mono text-mars-400 hover:underline pt-1"
                  >
                    <span>Inspect NASA Science Resource</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
