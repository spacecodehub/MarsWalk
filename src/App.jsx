import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fromArrayBuffer } from 'geotiff'
import './App.css'

const API = (import.meta.env.VITE_NAVIGATION_API_URL || '').replace(/\/+$/, '')
const LAYERS = [
  { id: 'dem', label: 'Elevation / DEM', unit: 'm', env: 'VITE_TERRAIN_DEM_URL' },
  { id: 'slope', label: 'Slope', unit: 'degrees', env: 'VITE_TERRAIN_SLOPE_URL' },
  { id: 'aspect', label: 'Aspect', unit: 'degrees clockwise from north', env: 'VITE_TERRAIN_ASPECT_URL' },
  { id: 'roughness', label: 'Roughness', unit: 'm', env: 'VITE_TERRAIN_ROUGHNESS_URL' },
]
const CRS = 'P2 custom Mars Equirectangular · local radius 3,394,839.813 m · 77.44°E · standard parallel 15°N'
const urlFor = (layer) => import.meta.env[layer.env]?.trim() || `${API}/api/navigation/terrain/${layer.id}.tif`
const number = (v, digits = 1) => Number.isFinite(v) ? v.toLocaleString(undefined, { maximumFractionDigits: digits }) : '—'
const pointText = (p) => p ? `${number(p[0], 2)} m E, ${number(p[1], 2)} m N` : 'Not selected'

function color(layer, value, min, max) {
  const t = max > min ? Math.max(0, Math.min(1, (value - min) / (max - min))) : .5
  if (layer === 'aspect') {
    const hue = ((value % 360) + 360) % 360
    const c = .58 * (1 - Math.abs(1.16 - 1))
    const h = hue / 60
    const x = c * (1 - Math.abs((h % 2) - 1))
    const rgb = h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x]
    const m = .58 - c / 2
    return rgb.map((v) => Math.round((v + m) * 255))
  }
  const stops = layer === 'dem' ? [[23,35,39],[77,91,81],[164,145,113],[228,205,158]] : layer === 'slope' ? [[28,44,44],[86,114,99],[189,132,69],[229,194,130]] : [[29,43,43],[76,102,85],[169,116,70],[223,174,108]]
  const scaled = t * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(scaled)), f = scaled - i
  return stops[i].map((v, c) => Math.round(v + (stops[i + 1][c] - v) * f))
}

async function loadRaster(layer) {
  const url = urlFor(layer)
  if (!url) throw new Error(`No ${layer.label.toLowerCase()} GeoTIFF URL is configured. P2 data are not bundled in the frontend.`)
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Terrain source returned HTTP ${response.status}.`)
  const tiff = await fromArrayBuffer(await response.arrayBuffer())
  const image = await tiff.getImage(), width = image.getWidth(), height = image.getHeight()
  const [values] = await image.readRasters({ samples: [0], interleave: false })
  const geoKeys = image.getGeoKeys()
  if (geoKeys.GTModelTypeGeoKey !== 1 || geoKeys.ProjectedCSTypeGeoKey !== 32767 || Math.abs(geoKeys.GeogSemiMajorAxisGeoKey - 3394839.8133163) > 0.01 || geoKeys.ProjCoordTransGeoKey !== 17 || geoKeys.ProjStdParallel1GeoKey !== 15 || geoKeys.ProjCenterLongGeoKey !== 77.44) throw new Error('Raster CRS does not match the verified P2 Mars Equirectangular grid.')
  const bounds = image.getBoundingBox(), resolution = image.getResolution()
  const expectedBounds = [-3955.009842076782, 1072242.7709482254, 3629.990157923218, 1088362.7709482254]
  if (width !== 1517 || height !== 3224 || bounds.some((v, i) => Math.abs(v - expectedBounds[i]) > 0.01) || Math.abs(resolution[0] - 5) > 0.01 || Math.abs(Math.abs(resolution[1]) - 5) > 0.01) throw new Error('Raster does not match the verified 5 m P2 HiRISE footprint grid.')
  const tag = image.getGDALNoData?.(), noData = tag == null ? null : Number(tag)
  const expectedNoData = layer.id === 'dem' ? -3.4028226550889045e38 : -9999
  if (noData === null || (layer.id === 'dem' ? Math.abs((noData - expectedNoData) / expectedNoData) > 1e-7 : noData !== expectedNoData)) throw new Error('Raster NoData metadata does not match the verified P2 product.')
  let min = Infinity, max = -Infinity
  for (const v of values) if (Number.isFinite(v) && (noData === null || v !== noData)) { min = Math.min(min, v); max = Math.max(max, v) }
  if (!Number.isFinite(min)) throw new Error('Selected raster contains no valid cells.')
  const pixels = new ImageData(width, height)
  for (let i = 0; i < values.length; i++) {
    const o = 4 * i, v = values[i]
    if (!Number.isFinite(v) || (noData !== null && v === noData)) { pixels.data[o + 3] = 0; continue }
    const rgb = color(layer.id, v, min, max)
    pixels.data[o] = rgb[0]; pixels.data[o + 1] = rgb[1]; pixels.data[o + 2] = rgb[2]; pixels.data[o + 3] = 255
  }
  return { width, height, pixels, values, min, max, noData, geoKeys, bounds }
}

async function jsonFetch(url, options) {
  const response = await fetch(url, options)
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(typeof body?.detail === 'string' ? body.detail : `Navigation API returned HTTP ${response.status}.`)
  return body
}

export default function App() {
  const [layerId, setLayerId] = useState('dem'), [raster, setRaster] = useState(null)
  const [rasterError, setRasterError] = useState('')
  const [api, setApi] = useState({ state: 'checking', terrain: false, layers: null })
  const [science, setScience] = useState({ state: 'checking', targets: [] })
  const [start, setStart] = useState(null), [destination, setDestination] = useState(null)
  const [selectionError, setSelectionError] = useState('')
  const [pick, setPick] = useState('start'), [mode, setMode] = useState('safest')
  const [route, setRoute] = useState(null), [routeError, setRouteError] = useState(''), [routeLoading, setRouteLoading] = useState(false)
  const canvasRef = useRef(null), routeCanvasRef = useRef(null)
  const layer = useMemo(() => LAYERS.find((item) => item.id === layerId), [layerId])

  useEffect(() => {
    let live = true
    if (!urlFor(layer)) { queueMicrotask(() => { if (live) setRasterError(`No ${layer.label.toLowerCase()} GeoTIFF URL is configured. P2 data are not bundled in the frontend.`) }); return () => { live = false } }
    loadRaster(layer).then((data) => { if (live) setRaster(data) }).catch((err) => { if (live) setRasterError(err.message) })
    return () => { live = false }
  }, [layer])
  useEffect(() => {
    const canvas = canvasRef.current, context = canvas?.getContext('2d')
    if (!canvas || !context || !raster) return
    canvas.width = raster.width; canvas.height = raster.height; context.putImageData(raster.pixels, 0, 0)
  }, [raster])

  useEffect(() => {
    const canvas = routeCanvasRef.current, context = canvas?.getContext('2d')
    if (!canvas || !context || !raster) return
    canvas.width = raster.width; canvas.height = raster.height; context.clearRect(0, 0, canvas.width, canvas.height)
    const coordinates = route?.coordinates_projected_m
    if (!Array.isArray(coordinates) || coordinates.length < 2) return
    const [minX, minY, maxX, maxY] = raster.bounds
    context.beginPath()
    coordinates.forEach(([x, y], i) => { const px = (x - minX) / (maxX - minX) * raster.width, py = (maxY - y) / (maxY - minY) * raster.height; if (i) context.lineTo(px, py); else context.moveTo(px, py) })
    context.strokeStyle = '#f1c58a'; context.lineWidth = Math.max(5, raster.width / 300); context.lineJoin = 'round'; context.lineCap = 'round'; context.stroke()
  }, [raster, route])

  useEffect(() => {
    let live = true
    Promise.all([jsonFetch(`${API}/api/health`), jsonFetch(`${API}/api/navigation/layers`)]).then(([health, layers]) => {
      if (live) setApi({ state: 'connected', terrain: Boolean(health.terrain_available), layers })
    }).catch((err) => { if (live) setApi({ state: 'unavailable', terrain: false, layers: null, message: err.message }) })
    return () => { live = false }
  }, [])

  useEffect(() => {
    let live = true
    jsonFetch(`${API}/api/science/targets`).then((payload) => {
      if (live) setScience({ state: 'available', targets: payload.targets || [], policy: payload.map_display_policy })
    }).catch((err) => { if (live) setScience({ state: 'unavailable', targets: [], message: err.message }) })
    return () => { live = false }
  }, [])

  const choosePoint = useCallback((event) => {
    if (!raster || !canvasRef.current || !pick) return
    const rect = canvasRef.current.getBoundingClientRect(), [minX, minY, maxX, maxY] = raster.bounds
    const px = Math.max(0, Math.min(raster.width - 1, (event.clientX - rect.left) / rect.width * raster.width))
    const py = Math.max(0, Math.min(raster.height - 1, (event.clientY - rect.top) / rect.height * raster.height))
    const col = Math.floor(px), row = Math.floor(py)
    const selectedValue = raster.values[row * raster.width + col]
    if (layer.id !== 'aspect' && (!Number.isFinite(selectedValue) || selectedValue === raster.noData)) {
      setSelectionError('That pixel is NoData. Choose a visible terrain cell inside the mapped footprint.')
      return
    }
    const point = [minX + px / raster.width * (maxX - minX), maxY - py / raster.height * (maxY - minY)]
    setSelectionError('')
    if (pick === 'start') setStart(point); else setDestination(point)
    setPick(pick === 'start' ? 'destination' : 'start'); setRoute(null); setRouteError('')
  }, [layer.id, pick, raster])

  async function calculateRoute() {
    if (!gridMatches) return
    setRoute(null); setRouteError(''); setRouteLoading(true)
    try {
      const result = await jsonFetch(`${API}/api/navigation/route`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ start, destination, mode, coordinates_crs: null }) })
      if (!result?.feasible || !Array.isArray(result.coordinates_projected_m) || result.coordinates_projected_m.length < 1 || !result.coordinates_projected_m.every((point) => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite))) throw new Error('P4 did not return a feasible route with projected map coordinates.')
      setRoute(result)
    } catch (err) { setRouteError(err.message) } finally { setRouteLoading(false) }
  }

  const p4Dem = api.layers?.layers?.dem
  const p4Crs = p4Dem?.crs_wkt || ''
  const crsMatches = p4Crs.includes('3394839.8133163') && /(?:central_meridian|longitude of natural origin)[^0-9]*77\.44/i.test(p4Crs) && /(?:standard_parallel_1|latitude of 1st standard parallel)[^0-9]*15(?:\.0+)?/i.test(p4Crs)
  const gridMatches = Boolean(raster && crsMatches && p4Dem?.available && p4Dem.width === raster.width && p4Dem.height === raster.height && Array.isArray(p4Dem.bounds) && p4Dem.bounds.every((v, i) => Math.abs(v - raster.bounds[i]) < 0.01) && Array.isArray(p4Dem.resolution) && Math.abs(Math.abs(p4Dem.resolution[0]) - (raster.bounds[2] - raster.bounds[0]) / raster.width) < 0.01 && Math.abs(Math.abs(p4Dem.resolution[1]) - (raster.bounds[3] - raster.bounds[1]) / raster.height) < 0.01)

  const metrics = route ? [['Distance', route.distance_m == null ? null : `${number(route.distance_m / 1000, 2)} km`], ['Maximum slope', route.slope_deg?.maximum == null ? null : `${number(route.slope_deg.maximum, 2)}°`], ['Maximum roughness', route.roughness_m?.maximum == null ? null : `${number(route.roughness_m.maximum, 2)} m`], ['Route cells', route.cells == null ? null : String(route.cells)]].filter(([, v]) => v !== null) : []
  const apiLabel = api.state === 'connected' ? api.terrain ? 'P4 API · TERRAIN READY' : 'API CONNECTED · TERRAIN UNAVAILABLE' : api.state === 'checking' ? 'CHECKING API' : 'API UNAVAILABLE'

  return <main className="app-shell">
    <header className="topbar"><a className="brand" href="#overview"><span className="brand-mark">M</span><span>MarsWalk <small>/ TERRAIN PLANNER</small></span></a><div className="connection"><i className={api.state === 'connected' && api.terrain ? 'status-dot online' : 'status-dot'} />{apiLabel}</div></header>
    <section className="intro" id="overview"><div><p className="eyebrow">JEZERO · LOCAL HIRISE FOOTPRINT</p><h1>Plan across real terrain.</h1><p className="intro-copy">Explore verified regional elevation products and request a terrain-aware route from the P4 navigation service.</p></div><div className="availability"><i className={raster ? 'status-dot online' : 'status-dot'} />{raster ? 'REGIONAL RASTER LOADED' : 'REGIONAL RASTER NOT CONFIGURED'}</div></section>
    <section className="workspace" aria-label="Terrain map and route planning">
      <div className="map-panel"><div className="map-toolbar"><div><p className="eyebrow">TERRAIN MAP</p><strong>{layer.label}</strong></div><div className="layer-control" role="group" aria-label="Terrain layer">{LAYERS.map((item) => <button type="button" key={item.id} disabled={!urlFor(item)} title={urlFor(item) ? item.label : 'Raster URL not configured'} className={item.id === layerId ? 'layer-button selected' : 'layer-button'} onClick={() => { setLayerId(item.id); setRaster(null); setRasterError(''); setRoute(null) }}>{item.label.replace(' / ', ' ')}</button>)}</div></div>
        <div className={`map-stage ${raster ? 'is-picking' : ''}`} onClick={choosePoint}>
          {!raster && <div className="map-empty"><span className="map-glyph">⌖</span><strong>{urlFor(layer) && !rasterError ? 'Loading terrain raster…' : 'Regional terrain is unavailable'}</strong><p>{rasterError || 'Configure an actual P2 GeoTIFF URL for this layer.'}</p><small>No global MOLA or sample image is used as a substitute.</small></div>}
          {raster && <div className="raster-frame" style={{ aspectRatio: `${raster.width} / ${raster.height}`, height: 'min(68vh, 680px)' }}><canvas ref={canvasRef} aria-label={`${layer.label} terrain raster`} /><canvas ref={routeCanvasRef} className="route-overlay" aria-hidden="true" /><svg className="map-markers" viewBox={`0 0 ${raster.width} ${raster.height}`} preserveAspectRatio="none" aria-hidden="true">{[['S', start], ['D', destination]].map(([label, point]) => { if (!point) return null; const [minX, minY, maxX, maxY] = raster.bounds; const x = (point[0] - minX) / (maxX - minX) * raster.width, y = (maxY - point[1]) / (maxY - minY) * raster.height; return <g key={label}><circle className="marker-halo" cx={x} cy={y} r="24"/><circle className="marker-dot" cx={x} cy={y} r="10"/><text x={x} y={y - 35}>{label}</text></g> })}</svg></div>}
          {raster && <div className="map-hint">Click terrain to set {pick === 'start' ? 'start' : 'destination'}</div>}
        </div>{raster && <><div className="map-footer"><span>{layer.label} · {layer.unit}</span><span>5 m grid · HiRISE stereo footprint only</span></div><div className="raster-legend"><span>{number(raster.min, 2)} {layer.unit}</span><span className={`legend-ramp ${layer.id}`} aria-hidden="true"/><span>{number(raster.max, 2)} {layer.unit}</span></div></>}
      </div>
      <aside className="side-panel"><section className="panel-section route-section"><p className="eyebrow">NAVIGATION</p><h2>Plan a route</h2><p className="muted">Select two locations on the loaded P2 terrain. P4 checks coverage and terrain cells.</p>
        <div className="point-row"><div><b><i className="point-marker start-marker">S</i> Start</b><small>{pointText(start)}</small></div><button type="button" className={pick === 'start' ? 'pick-button active' : 'pick-button'} onClick={() => setPick('start')}>Pick</button></div>
        <div className="point-row"><div><b><i className="point-marker destination-marker">D</i> Destination</b><small>{pointText(destination)}</small></div><button type="button" className={pick === 'destination' ? 'pick-button active' : 'pick-button'} onClick={() => setPick('destination')}>Pick</button></div>
        <label className="field-label" htmlFor="route-mode">Route preference</label><select id="route-mode" value={mode} onChange={(e) => setMode(e.target.value)}><option value="safest">Safest</option><option value="shortest">Shortest</option></select>
        <button className="calculate-button" type="button" onClick={calculateRoute} disabled={routeLoading || !start || !destination || api.state !== 'connected' || !api.terrain || !raster || !gridMatches}>{routeLoading ? 'Calculating route…' : 'Calculate route'} <span>→</span></button>
        {api.state === 'unavailable' && <p className="state-note error">Navigation API unavailable: {api.message}</p>}{api.state === 'connected' && !api.terrain && <p className="state-note">P4 is connected, but its terrain bundle is unavailable. Route requests are disabled.</p>}{api.state === 'connected' && api.terrain && raster && !gridMatches && <p className="state-note error">The loaded raster grid does not match P4 terrain metadata. Route requests are disabled.</p>}{!raster && <p className="state-note">Route planning requires the same actual P2 footprint loaded in this map and configured in P4.</p>}{selectionError && <p className="state-note error" role="alert">{selectionError}</p>}{routeError && <p className="state-note error" role="alert">{routeError}</p>}
      </section>
      {route && <section className="panel-section result-section" aria-live="polite"><p className="eyebrow">P4 ROUTE RESULT · {route.mode}</p><h2>Route calculated</h2>{metrics.length > 0 && <dl className="metrics">{metrics.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}<p className="route-footnote">Returned by P4 and drawn from projected metre vertices in the P2 CRS.</p></section>}
      <section className="panel-section layer-details"><p className="eyebrow">ACTIVE LAYER</p><h3>{layer.label}</h3><dl className="data-list"><div><dt>Units</dt><dd>{layer.unit}</dd></div>{raster && <><div><dt>Raster size</dt><dd>{raster.width.toLocaleString()} × {raster.height.toLocaleString()}</dd></div><div><dt>Resolution</dt><dd>{number((raster.bounds[2] - raster.bounds[0]) / raster.width, 2)} × {number((raster.bounds[3] - raster.bounds[1]) / raster.height, 2)} m</dd></div><div><dt>Value range</dt><dd>{number(raster.min, 2)} to {number(raster.max, 2)}</dd></div><div><dt>NoData</dt><dd>{raster.noData === null ? 'TIFF tag not supplied' : number(raster.noData, 4)}</dd></div><div><dt>Extent</dt><dd>{number(raster.bounds[0])}, {number(raster.bounds[1])} to {number(raster.bounds[2])}, {number(raster.bounds[3])} m</dd></div></>}</dl>{raster && <p className="crs-note">{CRS}</p>}</section>
      <section className="panel-section science-section"><p className="eyebrow">P6 · SCIENCE CATALOGUE</p><h3>Evidence-linked targets</h3>{science.state === 'checking' && <p className="muted">Loading the connected catalogue…</p>}{science.state === 'unavailable' && <p className="state-note error">Science catalogue unavailable: {science.message}</p>}{science.state === 'available' && science.targets.length === 0 && <p className="muted">No science targets are available.</p>}{science.targets.map((target) => <article className="science-target" key={target.target_id}><strong>{target.name}</strong><span>{target.science_category || 'Category not supplied'}</span><p>{target.scientific_justification?.objective || 'No science objective supplied.'}</p>{target.location ? <div className="target-location">Verified location: {number(target.location.coordinates.x, 4)}, {number(target.location.coordinates.y, 4)} {target.location.units} · {target.location.crs}</div> : <div className="target-location unknown">Location and CRS unavailable · list only</div>}{target.priority_score !== null && target.priority_score !== undefined && <div className="priority-note">{number(target.priority_score, 1)}/100 · {target.priority?.method || 'Project heuristic'} · advisory only, not a NASA score</div>}<div className="target-sources">{(target.provenance?.sources || []).map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.source_type || 'Source'}</a>)}</div></article>)}</section>
      <section className="coverage-note"><span>!</span><p><strong>Coverage limitation</strong><br/>The HiRISE terrain footprint covers only part of Jezero. These exploratory terrain layers are not validated safety surfaces. NoData and uncovered cells are not interpolated.</p></section></aside>
    </section><footer className="page-footer"><span>MARSWALK / SCIENTIFIC TERRAIN PLANNING</span><span>Regional data only · No live rover telemetry</span></footer>
  </main>
}
