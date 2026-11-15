import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fromArrayBuffer } from 'geotiff'
import './App.css'
import MarsScene from './MarsScene'

const API = (import.meta.env.VITE_NAVIGATION_API_URL || '').replace(/\/+$/, '')
const LAYERS = [
  { id: 'dem', label: 'Elevation / DEM', unit: 'm', legend: 'Mars areoid elevation · m', env: 'VITE_TERRAIN_DEM_URL' },
  { id: 'slope', label: 'Slope', unit: 'degrees', legend: 'Slope · degrees', env: 'VITE_TERRAIN_SLOPE_URL' },
  { id: 'aspect', label: 'Aspect', unit: 'degrees clockwise from north', legend: 'Aspect · degrees clockwise from north', env: 'VITE_TERRAIN_ASPECT_URL' },
  { id: 'roughness', label: 'Roughness', unit: 'm', legend: '3×3 local relief · m', env: 'VITE_TERRAIN_ROUGHNESS_URL' },
]
const CRS = 'P2 custom Mars Equirectangular · local radius 3,394,839.813 m · 77.44°E · standard parallel 15°N'
const JEZERO_GAZETTEER = { lat: 18.41, lon: 77.69 }
const JEZERO_P2 = {
  x: 3394839.8133163 * Math.cos(15 * Math.PI / 180) * (JEZERO_GAZETTEER.lon - 77.44) * Math.PI / 180,
  y: 3394839.8133163 * JEZERO_GAZETTEER.lat * Math.PI / 180,
}
const urlFor = (layer) => import.meta.env[layer.env]?.trim() || `${API}/api/navigation/terrain/${layer.id}.tif`
const number = (v, digits = 1) => Number.isFinite(v) ? v.toLocaleString(undefined, { maximumFractionDigits: digits }) : '—'
const pointText = (p) => p ? `${number(p[0], 2)} m E, ${number(p[1], 2)} m N` : 'Not selected'

function color(layer, value, min, max) {
  const raw = max > min ? Math.max(0, Math.min(1, (value - min) / (max - min))) : .5
  const t = layer === 'dem' ? Math.pow(raw, .62) : raw
  if (layer === 'aspect') {
    const hue = ((value % 360) + 360) % 360
    const c = .58 * (1 - Math.abs(1.16 - 1))
    const h = hue / 60
    const x = c * (1 - Math.abs((h % 2) - 1))
    const rgb = h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x]
    const m = .58 - c / 2
    return rgb.map((v) => Math.round((v + m) * 255))
  }
  const stops = layer === 'dem' ? [[31, 58, 82], [42, 104, 139], [90, 157, 151], [191, 178, 122], [239, 218, 160], [255, 248, 222]] : layer === 'slope' ? [[28, 44, 44], [86, 114, 99], [189, 132, 69], [229, 194, 130]] : [[29, 43, 43], [76, 102, 85], [169, 116, 70], [223, 174, 108]]
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
  const valid = new Float32Array(values.length)
  let validCount = 0
  for (const v of values) if (Number.isFinite(v) && (noData === null || v !== noData)) valid[validCount++] = v
  if (!validCount) throw new Error('Selected raster contains no valid cells.')
  const validValues = valid.subarray(0, validCount)
  validValues.sort()
  const min = validValues[0], max = validValues[validCount - 1]
  const low = validValues[Math.floor((validCount - 1) * .02)], high = validValues[Math.floor((validCount - 1) * .98)]
  const actualNoDataCount = values.length - validCount
  const pixels = new ImageData(width, height)
  for (let i = 0; i < values.length; i++) {
    const o = 4 * i, v = values[i]
    if (!Number.isFinite(v) || (noData !== null && v === noData)) { pixels.data[o + 3] = 0; continue }
    const rgb = color(layer.id, v, layer.id === 'aspect' ? 0 : low, layer.id === 'aspect' ? 360 : high)
    pixels.data[o] = rgb[0]; pixels.data[o + 1] = rgb[1]; pixels.data[o + 2] = rgb[2]; pixels.data[o + 3] = 255
  }
  return { width, height, pixels, values, min, max, low, high, validCount, noDataCount: actualNoDataCount, noData, geoKeys, bounds }
}

function validateMapPoint(point, raster) {
  if (!point || point.length !== 2 || !point.every(Number.isFinite)) return 'Enter finite easting and northing values.'
  if (!raster) return 'Terrain is still loading.'
  const [x, y] = point, [minX, minY, maxX, maxY] = raster.bounds
  if (x < minX || x > maxX || y < minY || y > maxY) return 'That coordinate is outside the loaded HiRISE terrain extent.'
  const col = Math.min(raster.width - 1, Math.floor((x - minX) / (maxX - minX) * raster.width))
  const row = Math.min(raster.height - 1, Math.floor((maxY - y) / (maxY - minY) * raster.height))
  const value = raster.values[row * raster.width + col]
  if (!Number.isFinite(value) || value === raster.noData) return 'That coordinate falls on a NoData cell. Choose a visible terrain cell.'
  return ''
}

async function jsonFetch(url, options) {
  const response = await fetch(url, options)
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(typeof body?.detail === 'string' ? body.detail : `Navigation API returned HTTP ${response.status}.`)
  return body
}

export default function App() {
  const [mapOpen, setMapOpen] = useState(false)
  const [layerId, setLayerId] = useState('dem'), [raster, setRaster] = useState(null)
  const [rasterError, setRasterError] = useState('')
  const [api, setApi] = useState({ state: 'checking', terrain: false, layers: null })
  const [science, setScience] = useState({ state: 'checking', targets: [] })
  const [start, setStart] = useState(null), [destination, setDestination] = useState(null)
  const [startInput, setStartInput] = useState(['', '']), [destinationInput, setDestinationInput] = useState(['', ''])
  const [selectionError, setSelectionError] = useState('')
  const [pick, setPick] = useState('start'), [mode, setMode] = useState('safest')
  const [route, setRoute] = useState(null), [routeError, setRouteError] = useState(''), [routeLoading, setRouteLoading] = useState(false)
  const canvasRef = useRef(null), routeCanvasRef = useRef(null)
  const stageRef = useRef(null), dragRef = useRef(null)
  const pointersRef = useRef(new Map()), pinchRef = useRef(null)
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 })
  const [mapView, setMapView] = useState({ zoom: 1, x: 0, y: 0 })
  const suppressClickRef = useRef(false)
  const layer = useMemo(() => LAYERS.find((item) => item.id === layerId), [layerId])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const observer = new ResizeObserver(([entry]) => setMapSize({ width: entry.contentRect.width, height: entry.contentRect.height }))
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  const fitView = useCallback((zoom = 1) => setMapView({ zoom, x: 0, y: 0 }), [])
  const zoomAt = useCallback((nextZoom, clientX, clientY) => {
    const bounds = stageRef.current?.getBoundingClientRect()
    if (!bounds) return
    const zoom = Math.max(1, Math.min(8, nextZoom))
    const cx = clientX - bounds.left - bounds.width / 2, cy = clientY - bounds.top - bounds.height / 2
    setMapView((view) => {
      const ratio = zoom / view.zoom
      return { zoom, x: cx - (cx - view.x) * ratio, y: cy - (cy - view.y) * ratio }
    })
  }, [])

  const onMapWheel = useCallback((event) => {
    event.preventDefault()
    zoomAt(mapView.zoom * (event.deltaY < 0 ? 1.18 : 1 / 1.18), event.clientX, event.clientY)
  }, [mapView, zoomAt])

  const onPointerDown = useCallback((event) => {
    if (event.button !== 0 || event.target.closest('.map-controls')) return
    // A new pointer gesture means a previous drag never generated its click.
    suppressClickRef.current = false
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (event.pointerType === 'touch' && pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()]
      pinchRef.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom: mapView.zoom, view: mapView }
      dragRef.current = null
      event.currentTarget.setPointerCapture(event.pointerId)
      return
    }
    dragRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false, viewX: mapView.x, viewY: mapView.y }
    event.currentTarget.setPointerCapture(event.pointerId)
  }, [mapView])
  const onPointerMove = useCallback((event) => {
    if (pointersRef.current.has(event.pointerId)) pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pinchRef.current && pointersRef.current.size >= 2) {
      const [a, b] = [...pointersRef.current.values()]
      const bounds = stageRef.current?.getBoundingClientRect()
      if (!bounds) return
      const pinch = pinchRef.current, distance = Math.hypot(a.x - b.x, a.y - b.y)
      const zoom = Math.max(1, Math.min(8, pinch.zoom * distance / Math.max(1, pinch.distance)))
      const cx = (a.x + b.x) / 2 - bounds.left - bounds.width / 2, cy = (a.y + b.y) / 2 - bounds.top - bounds.height / 2
      const ratio = zoom / pinch.view.zoom
      setMapView({ zoom, x: cx - (cx - pinch.view.x) * ratio, y: cy - (cy - pinch.view.y) * ratio })
      return
    }
    const drag = dragRef.current
    if (!drag || drag.id !== event.pointerId) return
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true
    if (drag.moved) setMapView((view) => ({ ...view, x: drag.viewX + dx, y: drag.viewY + dy }))
  }, [])
  const onPointerUp = useCallback((event) => {
    pointersRef.current.delete(event.pointerId)
    if (pointersRef.current.size < 2) pinchRef.current = null
    if (dragRef.current?.id === event.pointerId) {
      const moved = dragRef.current.moved
      dragRef.current = null
      if (moved) suppressClickRef.current = true
    }
  }, [])
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
    context.strokeStyle = '#f1c58a'; context.lineWidth = Math.max(12, raster.width / 100); context.lineJoin = 'round'; context.lineCap = 'round'; context.stroke()
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
    if (event.target.closest('.map-controls')) return
    if (suppressClickRef.current) { suppressClickRef.current = false; return }
    if (!raster || !canvasRef.current || !pick) return
    const rect = canvasRef.current.getBoundingClientRect(), [minX, minY, maxX, maxY] = raster.bounds
    const px = Math.max(0, Math.min(raster.width - 1, (event.clientX - rect.left) / rect.width * raster.width))
    const py = Math.max(0, Math.min(raster.height - 1, (event.clientY - rect.top) / rect.height * raster.height))
    const col = Math.floor(px), row = Math.floor(py)
    const selectedValue = raster.values[row * raster.width + col]
    if (!Number.isFinite(selectedValue) || selectedValue === raster.noData) {
      setSelectionError('That pixel is NoData. Choose a visible terrain cell inside the mapped footprint.')
      return
    }
    const point = [minX + px / raster.width * (maxX - minX), maxY - py / raster.height * (maxY - minY)]
    const pointText = point.map((value) => String(Math.round(value * 100) / 100))
    setSelectionError('')
    if (pick === 'start') { setStart(point); setStartInput(pointText) } else { setDestination(point); setDestinationInput(pointText) }
    setPick(pick === 'start' ? 'destination' : 'start'); setRoute(null); setRouteError('')
  }, [pick, raster])

  const editPointCoordinate = useCallback((which, axis, value) => {
    const current = which === 'start' ? startInput : destinationInput
    const next = [...current]
    next[axis] = value
    if (which === 'start') { setStartInput(next); setStart(null) } else { setDestinationInput(next); setDestination(null) }
    setPick(which)
    setRoute(null); setRouteError('')
    if (next.some((part) => part.trim() === '')) { setSelectionError('Enter both easting and northing coordinates in the P2 Mars CRS.'); return }
    const point = next.map(Number)
    const validation = validateMapPoint(point, raster)
    if (validation) { setSelectionError(`${which === 'start' ? 'Start' : 'Destination'}: ${validation}`); return }
    if (which === 'start') setStart(point); else setDestination(point)
    setSelectionError('')
  }, [destinationInput, raster, startInput])

  const fitRoute = useCallback(() => {
    if (!route || !raster || !mapSize.width || !mapSize.height) return
    const coords = route.coordinates_projected_m
    const xs = coords.map(([x]) => x), ys = coords.map(([, y]) => y)
    const [minX, minY, maxX, maxY] = raster.bounds
    const px = (Math.min(...xs) + Math.max(...xs)) / 2, py = (Math.min(...ys) + Math.max(...ys)) / 2
    const rasterAspect = raster.width / raster.height
    const baseWidth = Math.min(mapSize.width * .94, mapSize.height * .94 * rasterAspect)
    const baseHeight = baseWidth / rasterAspect
    const spanX = Math.max(Math.max(...xs) - Math.min(...xs), (maxX - minX) * .015)
    const spanY = Math.max(Math.max(...ys) - Math.min(...ys), (maxY - minY) * .015)
    const zoom = Math.max(1, Math.min(8, Math.min(.65 / (spanX / (maxX - minX)), .65 / (spanY / (maxY - minY)))))
    const x = (0.5 - (px - minX) / (maxX - minX)) * baseWidth * zoom
    const y = (0.5 - (maxY - py) / (maxY - minY)) * baseHeight * zoom
    setMapView({ zoom, x, y })
  }, [mapSize, raster, route])

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
  const routePoints = [
    { id: 'start', label: 'Start', point: start, input: startInput, markerClass: 'start-marker' },
    { id: 'destination', label: 'Destination', point: destination, input: destinationInput, markerClass: 'destination-marker' },
  ]
  const noDataPercent = raster ? raster.noDataCount / (raster.width * raster.height) * 100 : 0

  return <main className={`app-shell ${mapOpen ? 'map-open' : 'map-closed'}`}>
    <MarsScene background interactive={!mapOpen} onPlanetClick={() => setMapOpen(true)}>
      <h1 className="mars-title">MarsWalk</h1>
      <p className="mars-sub">Click Mars to open the terrain map.</p>
    </MarsScene>
    <header className="topbar"><a className="brand" href="#overview"><span className="brand-mark">M</span><span>MarsWalk <small>/ TERRAIN PLANNER</small></span></a><div className="connection"><i className={api.state === 'connected' && api.terrain ? 'status-dot online' : 'status-dot'} />{apiLabel}</div></header>
    <section className="intro" id="overview"><div><p className="eyebrow">JEZERO · LOCAL HIRISE FOOTPRINT</p><h1>Plan across real terrain.</h1><p className="intro-copy">Explore verified regional elevation products and request a terrain-aware route from the P4 navigation service.</p></div><div className="availability"><i className={raster ? 'status-dot online' : 'status-dot'} />{raster ? 'REGIONAL RASTER LOADED' : 'REGIONAL RASTER NOT CONFIGURED'}</div></section>
    <section className="workspace" aria-label="Terrain map and route planning">
      <div className="map-panel"><div className="map-toolbar"><div><p className="eyebrow">TERRAIN MAP</p><strong>{layer.label}</strong></div><div className="layer-control" role="group" aria-label="Terrain layer">{LAYERS.map((item) => <button type="button" key={item.id} disabled={!urlFor(item)} title={urlFor(item) ? item.label : 'Raster URL not configured'} className={item.id === layerId ? 'layer-button selected' : 'layer-button'} onClick={() => { setLayerId(item.id); setRaster(null); setRasterError(''); setRoute(null) }}>{item.label.replace(' / ', ' ')}</button>)}</div></div>
        <div ref={stageRef} className={`map-stage ${raster ? 'is-picking' : ''}`} onClick={choosePoint} onWheel={onMapWheel} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
          {!raster && <div className="map-empty"><span className="map-glyph">⌖</span><strong>{urlFor(layer) && !rasterError ? 'Loading terrain raster…' : 'Regional terrain is unavailable'}</strong><p>{rasterError || 'Configure an actual P2 GeoTIFF URL for this layer.'}</p><small>No global MOLA or sample image is used as a substitute.</small></div>}
          {raster && <div className="raster-frame" style={{ aspectRatio: `${raster.width} / ${raster.height}`, width: `${Math.min(mapSize.width * .94, mapSize.height * .94 * raster.width / raster.height)}px`, transform: `translate(calc(-50% + ${mapView.x}px), calc(-50% + ${mapView.y}px)) scale(${mapView.zoom})` }}><canvas ref={canvasRef} aria-label={`${layer.label} terrain raster`} /><canvas ref={routeCanvasRef} className="route-overlay" aria-hidden="true" /><svg className="map-markers" viewBox={`0 0 ${raster.width} ${raster.height}`} preserveAspectRatio="none" aria-hidden="true">{[['S', start], ['D', destination]].map(([label, point]) => { if (!point) return null; const [minX, minY, maxX, maxY] = raster.bounds; const x = (point[0] - minX) / (maxX - minX) * raster.width, y = (maxY - point[1]) / (maxY - minY) * raster.height; return <g key={label}><circle className="marker-halo" cx={x} cy={y} r="48" /><circle className="marker-dot" cx={x} cy={y} r="22" /><text x={x} y={y - 58}>{label}</text></g> })}</svg></div>}
          {raster && <div className="map-controls" role="group" aria-label="Map navigation">
            <button type="button" aria-label="Zoom in" title="Zoom in" onClick={() => zoomAt(mapView.zoom * 1.25, stageRef.current.getBoundingClientRect().left + mapSize.width / 2, stageRef.current.getBoundingClientRect().top + mapSize.height / 2)}>+</button>
            <button type="button" aria-label="Zoom out" title="Zoom out" onClick={() => zoomAt(mapView.zoom / 1.25, stageRef.current.getBoundingClientRect().left + mapSize.width / 2, stageRef.current.getBoundingClientRect().top + mapSize.height / 2)}>−</button>
            <button type="button" onClick={() => fitView(1)}>Fit terrain</button>
            <button type="button" onClick={() => fitView(1)}>Reset view</button>
            {route && <button type="button" onClick={fitRoute}>Fit route</button>}
          </div>}
          {raster && <div className="map-hint">Click terrain to set {pick === 'start' ? 'start' : 'destination'}</div>}
        </div>{raster && <><div className="map-footer"><span>{layer.label} · {layer.unit}</span><span>5 m grid · {number(100 - noDataPercent, 1)}% valid cells · HiRISE footprint</span><span>P2 local grid E {number(raster.bounds[0], 0)}–{number(raster.bounds[2], 0)} m · N {number(raster.bounds[1], 0)}–{number(raster.bounds[3], 0)} m</span></div><div className={`raster-legend ${layer.id === 'aspect' ? 'aspect-legend' : ''}`}><span>{layer.id === 'aspect' ? '0° · N' : number(layer.id === 'dem' ? raster.low : raster.min, 2)}</span><span className={`legend-ramp ${layer.id}`} aria-hidden="true" /><span>{layer.id === 'aspect' ? '360° · N' : number(layer.id === 'dem' ? raster.high : raster.max, 2)}</span><span className="legend-description">{layer.id === 'dem' ? 'Elevation · m · 2–98% stretch' : layer.legend}</span></div><div className="geo-context"><span className="geo-symbol">◎</span><p><strong>Jezero Crater · IAU-adopted</strong><br />USGS Gaz. center 18.41°N, 77.69°E transforms to {number(JEZERO_P2.x, 0)} m E, {number(JEZERO_P2.y, 0)} m N in the local P2 equirectangular CRS (R 3,394,839.813 m; 77.44° central longitude; 15° standard parallel). It lies northeast and outside this raster extent, so no crater marker is placed here. The unlocated western-delta target remains catalogue-only.</p><a href="https://planetarynames.wr.usgs.gov/Feature/Jezero" target="_blank" rel="noreferrer">USGS Gazetteer ↗</a></div></>}
      </div>
      <aside className="side-panel"><section className="panel-section route-section"><p className="eyebrow">NAVIGATION</p><h2>Plan a route</h2><p className="muted">Choose Start or Destination, then click a colored terrain cell. Enter coordinates in the P2 local grid as a fallback.</p>
        {routePoints.map(({ id, label, point, input, markerClass }) => <div className="route-point" key={id}>
          <div className="point-row"><div><b><i className={`point-marker ${markerClass}`}>{id === 'start' ? 'S' : 'D'}</i> {label}</b><small>{pointText(point)}</small></div><button type="button" className={pick === id ? 'pick-button active' : 'pick-button'} aria-pressed={pick === id} onClick={() => { setPick(id); if (id === 'start') { setStart(null); setStartInput(['', '']) } else { setDestination(null); setDestinationInput(['', '']) } setSelectionError(`Click a valid terrain cell to set the ${label.toLowerCase()}.`) }}>Pick on map</button></div>
          <div className="coordinate-fields"><label htmlFor={`${id}-easting`}>Easting (m)<input id={`${id}-easting`} type="number" step="0.01" value={input[0]} placeholder="e.g. -162.34" onChange={(event) => editPointCoordinate(id, 0, event.target.value)} /></label><label htmlFor={`${id}-northing`}>Northing (m)<input id={`${id}-northing`} type="number" step="0.01" value={input[1]} placeholder="e.g. 1080314" onChange={(event) => editPointCoordinate(id, 1, event.target.value)} /></label></div>
        </div>)}
        <label className="field-label" htmlFor="route-mode">Route preference</label><select id="route-mode" value={mode} onChange={(e) => setMode(e.target.value)}><option value="safest">Safest</option><option value="shortest">Shortest</option></select>
        <button className="calculate-button" type="button" onClick={calculateRoute} disabled={routeLoading || !start || !destination || api.state !== 'connected' || !api.terrain || !raster || !gridMatches}>{routeLoading ? 'Calculating route…' : 'Calculate route'} <span>→</span></button>
        {api.state === 'unavailable' && <p className="state-note error">Navigation API unavailable: {api.message}</p>}{api.state === 'connected' && !api.terrain && <p className="state-note">P4 is connected, but its terrain bundle is unavailable. Route requests are disabled.</p>}{api.state === 'connected' && api.terrain && raster && !gridMatches && <p className="state-note error">The loaded raster grid does not match P4 terrain metadata. Route requests are disabled.</p>}{!raster && <p className="state-note">Route planning requires the same actual P2 footprint loaded in this map and configured in P4.</p>}{selectionError && <p className="state-note error" role="alert">{selectionError}</p>}{routeError && <p className="state-note error" role="alert">{routeError}</p>}
      </section>
        {route && <section className="panel-section result-section" aria-live="polite"><p className="eyebrow">P4 ROUTE RESULT · {route.mode}</p><h2>Route calculated</h2>{metrics.length > 0 && <dl className="metrics">{metrics.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}<p className="route-footnote">Returned by P4 and drawn from projected metre vertices in the P2 CRS.</p></section>}
        <section className="panel-section layer-details"><p className="eyebrow">ACTIVE LAYER</p><h3>{layer.label}</h3><dl className="data-list"><div><dt>Units</dt><dd>{layer.unit}</dd></div>{raster && <><div><dt>Raster size</dt><dd>{raster.width.toLocaleString()} × {raster.height.toLocaleString()}</dd></div><div><dt>Resolution</dt><dd>{number((raster.bounds[2] - raster.bounds[0]) / raster.width, 2)} × {number((raster.bounds[3] - raster.bounds[1]) / raster.height, 2)} m</dd></div><div><dt>Valid range</dt><dd>{number(raster.min, 2)} to {number(raster.max, 2)} {layer.unit}</dd></div>{layer.id === 'dem' && <div><dt>Display stretch</dt><dd>{number(raster.low, 1)} to {number(raster.high, 1)} m (2nd–98th percentile)</dd></div>}<div><dt>NoData</dt><dd>Masked · {number(noDataPercent, 1)}% of cells</dd></div><div><dt>Extent</dt><dd>{number(raster.bounds[0])}, {number(raster.bounds[1])} to {number(raster.bounds[2])}, {number(raster.bounds[3])} m</dd></div></>}</dl>{raster && <p className="crs-note">{CRS}</p>}</section>
        <section className="panel-section science-section"><p className="eyebrow">P6 · SCIENCE CATALOGUE</p><h3>Evidence-linked targets</h3>{science.state === 'checking' && <p className="muted">Loading the connected catalogue…</p>}{science.state === 'unavailable' && <p className="state-note error">Science catalogue unavailable: {science.message}</p>}{science.state === 'available' && science.targets.length === 0 && <p className="muted">No science targets are available.</p>}{science.targets.map((target) => <article className="science-target" key={target.target_id}><strong>{target.name}</strong><span>{target.science_category || 'Category not supplied'}</span><p>{target.scientific_justification?.objective || 'No science objective supplied.'}</p>{target.location ? <div className="target-location">Verified location: {number(target.location.coordinates.x, 4)}, {number(target.location.coordinates.y, 4)} {target.location.units} · {target.location.crs}</div> : <div className="target-location unknown">Location and CRS unavailable · list only</div>}{target.priority_score !== null && target.priority_score !== undefined && <div className="priority-note">{number(target.priority_score, 1)}/100 · {target.priority?.method || 'Project heuristic'} · advisory only, not a NASA score</div>}<div className="target-sources">{(target.provenance?.sources || []).map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.source_type || 'Source'}</a>)}</div></article>)}</section>
        <section className="coverage-note"><span>!</span><p><strong>Coverage limitation</strong><br />The HiRISE terrain footprint covers only part of Jezero. These exploratory terrain layers are not validated safety surfaces. NoData and uncovered cells are not interpolated.</p></section></aside>
    </section><footer className="page-footer"><span>MARSWALK / SCIENTIFIC TERRAIN PLANNING</span><span>Regional data only · No live rover telemetry</span></footer>
  </main>
}
