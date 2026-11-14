import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'

const API_BASE = (import.meta.env.VITE_MARSWALK_API_URL || '').replace(/\/$/, '')

async function request(path, options) {
  let response
  try {
    response = await fetch(`${API_BASE}${path}`, options)
  } catch {
    throw new Error(`Cannot reach the MarsWalk API at ${API_BASE}. Start the backend and check VITE_MARSWALK_API_URL.`)
  }
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = payload.detail
    throw new Error(typeof detail === 'string' ? detail : `API request failed (${response.status})`)
  }
  return payload
}

function RoutePlot({ route, bounds }) {
  const points = route?.coordinates_projected_m
  const extent = bounds?.length === 4 ? bounds : null
  const plotBounds = useMemo(() => {
    if (extent) return extent
    if (!points?.length) return [-1, -1, 1, 1]
    const xs = points.map(([x]) => x)
    const ys = points.map(([, y]) => y)
    const pad = Math.max((Math.max(...xs) - Math.min(...xs)) * 0.12, 10)
    return [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad]
  }, [extent, points])

  if (!points?.length) {
    return <div className="plot-empty">A route trace will appear here after the API returns a feasible path.</div>
  }

  const [left, bottom, right, top] = plotBounds
  const width = Math.max(right - left, 1)
  const height = Math.max(top - bottom, 1)
  const project = ([x, y]) => `${28 + ((x - left) / width) * 544},${272 - ((y - bottom) / height) * 244}`
  const line = points.map(project).join(' ')

  return (
    <div className="plot-wrap">
      <svg className="route-plot" viewBox="0 0 600 300" role="img" aria-label="Returned route in the terrain dataset projected coordinate system">
        <defs>
          <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(154,178,188,.11)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect x="20" y="16" width="560" height="264" fill="url(#grid)" />
        <line x1="28" y1="272" x2="572" y2="272" className="axis" />
        <line x1="28" y1="24" x2="28" y2="272" className="axis" />
        <polyline points={line} className="route-line" />
        <circle cx={project(points[0]).split(',')[0]} cy={project(points[0]).split(',')[1]} r="6" className="route-start" />
        <circle cx={project(points.at(-1)).split(',')[0]} cy={project(points.at(-1)).split(',')[1]} r="6" className="route-end" />
      </svg>
      <div className="plot-caption"><span>Projected X (m)</span><span>Projected Y (m), north up</span></div>
      <p className="plot-note">Route geometry is plotted in the source raster’s projected coordinate system. This view does not imply terrain imagery or coverage beyond the returned path.</p>
    </div>
  )
}

function App() {
  const [health, setHealth] = useState(null)
  const [layers, setLayers] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)
  const [startX, setStartX] = useState('')
  const [startY, setStartY] = useState('')
  const [endX, setEndX] = useState('')
  const [endY, setEndY] = useState('')
  const [mode, setMode] = useState('safest')
  const [route, setRoute] = useState(null)
  const [routeError, setRouteError] = useState('')
  const [planning, setPlanning] = useState(false)

  const refreshStatus = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [nextHealth, nextLayers] = await Promise.all([
        request('/api/health'),
        request('/api/navigation/layers'),
      ])
      setHealth(nextHealth)
      setLayers(nextLayers)
    } catch (error) {
      setLoadError(error.message)
      setHealth(null)
      setLayers(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { Promise.resolve().then(refreshStatus) }, [refreshStatus])

  const bounds = useMemo(() => {
    const demBounds = layers?.layers?.dem?.bounds
    return Array.isArray(demBounds) ? demBounds : null
  }, [layers])

  async function planRoute(event) {
    event.preventDefault()
    setPlanning(true)
    setRouteError('')
    setRoute(null)
    const body = {
      start: [Number(startX), Number(startY)],
      destination: [Number(endX), Number(endY)],
      mode,
    }
    try {
      setRoute(await request('/api/navigation/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }))
    } catch (error) {
      setRouteError(error.message)
    } finally {
      setPlanning(false)
    }
  }

  const hasCoordinates = [startX, startY, endX, endY].every((value) => value !== '' && Number.isFinite(Number(value)))

  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="MarsWalk home"><span className="brand-mark">M</span><span>MARSWALK</span></a>
        <div className="topbar-right"><span className="eyebrow">JEZERO CRATER · ROUTE PLANNING</span><span className={`connection ${health?.status === 'ok' ? 'online' : ''}`}><i />{loading ? 'Checking API' : health?.status === 'ok' ? 'API connected' : 'API unavailable'}</span></div>
      </header>

      <section className="intro" id="top">
        <div className="intro-copy"><p className="kicker">TERRAIN AWARE EXPLORATION</p><h1>Plan a route<br /><span>across Mars.</span></h1><p className="intro-text">Explore a traverse against the available Mars terrain products. Every path is checked against the configured hard terrain limits.</p></div>
        <div className="mission-stamp"><span className="stamp-orbit">◎</span><span>MISSION AREA</span><strong>JEZERO</strong><small>LOCAL STEREO COVERAGE</small></div>
      </section>

      {loadError && <div className="notice error" role="alert"><strong>Navigation service unavailable</strong><span>{loadError}</span><button className="text-button" onClick={refreshStatus}>Retry connection</button></div>}

      <section className="status-grid" aria-label="Data availability">
        <article className="status-card"><div className="card-label"><span className="status-dot" /> TERRAIN MODEL <span className="card-code">P2</span></div><strong>{loading ? 'Checking…' : health?.terrain_available ? 'Available' : 'Unavailable'}</strong><p>{layers?.source || 'Waiting for backend terrain configuration'}</p>{layers?.coverage && <small>{layers.coverage}</small>}</article>
        <article className="status-card"><div className="card-label"><span className="status-dot science" /> SCIENCE CATALOGUE <span className="card-code">P6</span></div><strong>{loading ? 'Checking…' : health?.science_catalogue_available ? 'Configured' : 'Unavailable'}</strong><p>{health?.science_catalogue_available ? 'Catalogue file is available to the backend.' : 'Targets are not available to this backend.'}</p><small>Only located, evidence-backed targets can influence a science-aware route.</small></article>
        <article className="status-card mode-card"><div className="card-label">ACTIVE DATA MODE</div><strong>{health?.terrain_available ? 'Configured terrain' : 'No terrain loaded'}</strong><p>This interface does not substitute demo or synthetic data.</p></article>
      </section>

      {layers?.alignment && <aside className="alignment-note"><span>POSITIONAL LIMITATION</span><p>Relative alignment: {layers.alignment.relative_estimate}. Absolute accuracy: {layers.alignment.absolute_accuracy}.</p></aside>}

      <section className="workspace">
        <div className="panel route-panel">
          <div className="section-heading"><div><p className="kicker">ROUTE BUILDER <span>01</span></p><h2>Set your traverse</h2></div><span className="panel-icon">↗</span></div>
          {!health?.terrain_available && <div className="notice muted"><strong>Terrain data is not configured.</strong><span>Connect the backend to verified P2 products before requesting a route.</span></div>}
          <form onSubmit={planRoute}>
            <div className="coordinate-group"><div className="field-heading"><span className="point start-point" /> Start point <span className="unit-label">PROJECTED METRES</span></div><div className="field-row"><label>X coordinate<input inputMode="decimal" type="number" step="any" value={startX} onChange={(event) => setStartX(event.target.value)} placeholder="e.g. 1200" required /></label><label>Y coordinate<input inputMode="decimal" type="number" step="any" value={startY} onChange={(event) => setStartY(event.target.value)} placeholder="e.g. 2500" required /></label></div></div>
            <div className="coordinate-group"><div className="field-heading"><span className="point end-point" /> Destination <span className="unit-label">PROJECTED METRES</span></div><div className="field-row"><label>X coordinate<input inputMode="decimal" type="number" step="any" value={endX} onChange={(event) => setEndX(event.target.value)} placeholder="e.g. 1800" required /></label><label>Y coordinate<input inputMode="decimal" type="number" step="any" value={endY} onChange={(event) => setEndY(event.target.value)} placeholder="e.g. 3100" required /></label></div></div>
            {bounds && <p className="bounds-hint">P2 raster bounds: X {bounds[0].toFixed(1)} to {bounds[2].toFixed(1)} m · Y {bounds[1].toFixed(1)} to {bounds[3].toFixed(1)} m</p>}
            <label className="mode-label">Planning preference<select value={mode} onChange={(event) => setMode(event.target.value)}><option value="safest">Safest route</option><option value="shortest">Shortest feasible route</option><option value="science-aware" disabled={!health?.science_catalogue_available}>Science-aware route{!health?.science_catalogue_available ? ' · unavailable' : ''}</option></select></label>
            <p className="safety-copy">Hard slope, roughness, elevation and NoData constraints remain in force for every mode. Thresholds are project settings, not NASA-certified safety limits.</p>
            <button className="submit-button" type="submit" disabled={!hasCoordinates || planning || !health?.terrain_available}>{planning ? 'Calculating route…' : 'Calculate route'}<span>→</span></button>
          </form>
          {routeError && <div className="notice error" role="alert"><strong>Route not returned</strong><span>{routeError}</span></div>}
        </div>

        <div className="panel visualization-panel">
          <div className="section-heading"><div><p className="kicker">ROUTE VIEW <span>02</span></p><h2>{route ? 'Feasible traverse' : 'Awaiting route'}</h2></div>{route && <span className="feasible-tag"><i /> FEASIBLE</span>}</div>
          <RoutePlot route={route} bounds={bounds} />
          {route && <div className="route-summary"><div><span>DISTANCE</span><strong>{Number(route.distance_m).toLocaleString(undefined, { maximumFractionDigits: 0 })} <small>m</small></strong></div><div><span>ROUTE CELLS</span><strong>{route.cells}</strong></div><div><span>MAX SLOPE</span><strong>{Number(route.slope_deg?.maximum).toFixed(1)}<small>°</small></strong></div><div><span>MAX ROUGHNESS</span><strong>{Number(route.roughness_m?.maximum).toFixed(2)}<small> m</small></strong></div></div>}
          {route && <div className="route-explanation"><span>WHY THIS ROUTE</span><p>{route.explanation}</p></div>}
          {route?.scientific_contribution?.length > 0 && <div className="science-contribution"><span>SCIENCE PREFERENCE · PROJECT HEURISTIC</span>{route.scientific_contribution.map((target) => <p key={target.target_id}><strong>{target.name}</strong> · heuristic priority {target.priority}/100 · {Number(target.distance_to_route_m).toFixed(0)} m from route</p>)}</div>}
          {route?.excluded_cells && <details className="excluded-details"><summary>Terrain cells excluded from routing</summary><div>{Object.entries(route.excluded_cells).map(([reason, count]) => <span key={reason}>{reason.replaceAll('_', ' ')}: <strong>{count}</strong></span>)}</div></details>}
          {!route && <div className="empty-legend"><span><i className="legend-start" /> Start</span><span><i className="legend-end" /> Destination</span><small>Route points are plotted only after the API returns them.</small></div>}
        </div>
      </section>

      <footer><span>MARSWALK <i>·</i> SCIENCE LED EXPLORATION</span><span>Data availability and provenance are reported by the connected API.</span></footer>
    </main>
  )
}

export default App
