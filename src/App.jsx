import { useRef, useState } from 'react'
import './App.css'

const JEZERO = { latitude: 18.4, longitude: 77.7 }
const GRID_LONGITUDES = [-120, -60, 0, 60, 120]
const GRID_LATITUDES = [-60, -30, 0, 30, 60]

function projectCoordinates(latitude, longitude) {
  return {
    x: ((longitude + 180) / 360) * 1000,
    y: ((90 - latitude) / 180) * 500,
  }
}

function App() {
  const mapRef = useRef(null)
  const dragRef = useRef(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [coordinates, setCoordinates] = useState(null)
  const jezero = projectCoordinates(JEZERO.latitude, JEZERO.longitude)

  function changeZoom(nextZoom) {
    const boundedZoom = Math.min(8, Math.max(1, nextZoom))
    setZoom(boundedZoom)
    if (boundedZoom === 1) setPan({ x: 0, y: 0 })
  }

  function focusJezero() {
    const bounds = mapRef.current?.getBoundingClientRect()
    if (!bounds) return

    const nextZoom = 4
    setZoom(nextZoom)
    setPan({
      x: (bounds.width / 2 - (jezero.x / 1000) * bounds.width) * nextZoom,
      y: (bounds.height / 2 - (jezero.y / 500) * bounds.height) * nextZoom,
    })
  }

  function handleWheel(event) {
    event.preventDefault()
    changeZoom(zoom + (event.deltaY < 0 ? 0.25 : -0.25))
  }

  function handlePointerDown(event) {
    if (zoom === 1) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
    setIsDragging(true)
  }

  function handlePointerMove(event) {
    const drag = dragRef.current
    if (drag?.pointerId === event.pointerId) {
      const deltaX = event.clientX - drag.x
      const deltaY = event.clientY - drag.y
      setPan((current) => ({ x: current.x + deltaX, y: current.y + deltaY }))
      dragRef.current = { ...drag, x: event.clientX, y: event.clientY }
      return
    }

    const bounds = mapRef.current?.getBoundingClientRect()
    if (!bounds) return

    const x = bounds.width / 2 + (event.clientX - bounds.left - bounds.width / 2 - pan.x) / zoom
    const y = bounds.height / 2 + (event.clientY - bounds.top - bounds.height / 2 - pan.y) / zoom
    const longitude = (x / bounds.width) * 360 - 180
    const latitude = 90 - (y / bounds.height) * 180

    if (longitude >= -180 && longitude <= 180 && latitude >= -90 && latitude <= 90) {
      setCoordinates({ latitude, longitude })
    } else {
      setCoordinates(null)
    }
  }

  function handlePointerUp(event) {
    if (dragRef.current?.pointerId !== event.pointerId) return
    dragRef.current = null
    setIsDragging(false)
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="MarsWalk home">
          <span className="brand-mark" aria-hidden="true">M</span>
          <span>MarsWalk<span className="brand-divider">/</span><span className="brand-section">Terrain atlas</span></span>
        </a>
        <div className="topbar-meta">
          <span className="status-dot" />
          <span>GLOBAL ELEVATION</span>
          <span className="topbar-separator">·</span>
          <span>MARS 2000</span>
        </div>
      </header>

      <section className="page-heading">
        <div>
          <p className="eyebrow">PLANETARY SURFACE / 01</p>
          <h1>Mars, in elevation.</h1>
          <p className="page-description">
            A global topographic view from MOLA, with Jezero Crater marked for orientation.
          </p>
        </div>
        <button className="focus-button" onClick={focusJezero} type="button">
          <span aria-hidden="true">⌖</span>
          Focus Jezero
          <span className="button-arrow" aria-hidden="true">↗</span>
        </button>
      </section>

      <section className="atlas-layout" aria-label="Mars elevation map">
        <div className="map-column">
          <div className="map-toolbar">
            <div className="map-title">
              <span className="layer-icon" aria-hidden="true">▧</span>
              <span>Global elevation</span>
              <span className="resolution-chip">16 px / degree</span>
            </div>
            <div className="map-controls" aria-label="Map controls">
              <button
                aria-label="Zoom out"
                disabled={zoom <= 1}
                onClick={() => changeZoom(zoom - 0.5)}
                type="button"
              >
                −
              </button>
              <span className="zoom-value">{Math.round(zoom * 100)}%</span>
              <button
                aria-label="Zoom in"
                disabled={zoom >= 8}
                onClick={() => changeZoom(zoom + 0.5)}
                type="button"
              >
                +
              </button>
              <button
                aria-label="Reset map view"
                className="reset-button"
                onClick={() => changeZoom(1)}
                type="button"
              >
                Reset
              </button>
            </div>
          </div>

          <div
            aria-label="Global Mars elevation map. Jezero Crater is marked in the eastern hemisphere."
            className={`map-frame${isDragging ? ' is-dragging' : ''}`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
            ref={mapRef}
            role="img"
          >
            <div
              className="map-transform"
              style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
            >
              <img
                alt=""
                className="elevation-image"
                draggable="false"
                src="/mars-mola-elevation.png"
              />
              <svg
                aria-hidden="true"
                className="map-overlay"
                preserveAspectRatio="none"
                viewBox="0 0 1000 500"
              >
                <defs>
                  <filter height="300%" id="marker-glow" width="300%" x="-100%" y="-100%">
                    <feGaussianBlur result="blur" stdDeviation="3" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <g className="graticule">
                  {GRID_LONGITUDES.map((longitude) => {
                    const x = ((longitude + 180) / 360) * 1000
                    return (
                      <g key={`longitude-${longitude}`}>
                        <line x1={x} x2={x} y1="0" y2="500" />
                        <text textAnchor="middle" x={x} y="484">
                          {longitude}°
                        </text>
                      </g>
                    )
                  })}
                  {GRID_LATITUDES.map((latitude) => {
                    const y = ((90 - latitude) / 180) * 500
                    return (
                      <g key={`latitude-${latitude}`}>
                        <line x1="0" x2="1000" y1={y} y2={y} />
                        <text textAnchor="start" x="14" y={y - 7}>
                          {latitude > 0 ? `${latitude}°N` : latitude < 0 ? `${Math.abs(latitude)}°S` : '0°'}
                        </text>
                      </g>
                    )
                  })}
                </g>
                <g className="jezero-marker" filter="url(#marker-glow)" transform={`translate(${jezero.x} ${jezero.y})`}>
                  <circle className="marker-halo" r="13" />
                  <circle className="marker-ring" r="5.5" />
                  <circle className="marker-core" r="2" />
                </g>
                <text className="jezero-label" x={jezero.x + 14} y={jezero.y - 12}>
                  JEZERO CRATER
                </text>
              </svg>
            </div>
            <div className="map-coordinate">
              {coordinates
                ? `${Math.abs(coordinates.latitude).toFixed(2)}°${coordinates.latitude >= 0 ? 'N' : 'S'}  ${Math.abs(coordinates.longitude).toFixed(2)}°${coordinates.longitude >= 0 ? 'E' : 'W'}`
                : 'MOVE OVER MAP TO READ COORDINATES'}
            </div>
            <div className="map-projection">EQUIRECTANGULAR <span>·</span> PLANETOCENTRIC</div>
            <div className="map-credit">MOLA MEGDR / PDS</div>
          </div>

          <div className="map-caption">
            <span>Longitude: east-positive <span className="caption-separator">/</span> Latitude: planetocentric</span>
            <span>Click “Focus Jezero” to zoom in</span>
          </div>
        </div>

        <aside className="info-panel">
          <div className="panel-section">
            <p className="panel-label">ACTIVE LAYER</p>
            <div className="active-layer">
              <span className="layer-swatch" />
              <div>
                <h2>MOLA elevation</h2>
                <p>Height above the areoid</p>
              </div>
              <span className="visibility-icon" aria-label="Visible">◉</span>
            </div>
            <div className="legend">
              <div className="legend-gradient" />
              <div className="legend-labels"><span>−8,177 m</span><span>0 m</span><span>+21,171 m</span></div>
            </div>
            <p className="legend-note">Color stretch shows global relief; values are not a rover-scale terrain assessment.</p>
          </div>

          <div className="panel-section location-section">
            <p className="panel-label">REFERENCE LOCATION</p>
            <div className="location-heading">
              <span className="location-marker" />
              <h2>Jezero Crater</h2>
            </div>
            <p className="location-coordinates">18.4° N <span>/</span> 77.7° E</p>
            <p className="location-description">
              The landing region for NASA’s Perseverance rover, shown here against the global elevation model.
            </p>
            <button className="text-button" onClick={focusJezero} type="button">
              Center on Jezero <span aria-hidden="true">→</span>
            </button>
          </div>

          <div className="panel-section data-section">
            <p className="panel-label">DATA DETAILS</p>
            <dl className="data-list">
              <div><dt>Instrument</dt><dd>MOLA</dd></div>
              <div><dt>Product</dt><dd>MEGT90N000EB</dd></div>
              <div><dt>Grid spacing</dt><dd>16 px / degree</dd></div>
              <div><dt>Nominal scale</dt><dd>3.7 km / px at equator</dd></div>
              <div><dt>Reference</dt><dd>MOLA areoid</dd></div>
            </dl>
          </div>

          <div className="source-note">
            <span className="source-icon" aria-hidden="true">↗</span>
            <p>
              Source: NASA / PDS Geosciences Node
              <a href="https://pds-geosciences.wustl.edu/mgs/urn-nasa-pds-mgs_mola_topography_derived/meg016/" rel="noreferrer" target="_blank">
                View product archive
              </a>
            </p>
          </div>
        </aside>
      </section>

      <footer className="page-footer">
        <span>MARSWALK <span className="footer-divider">/</span> SCIENCE &amp; TERRAIN</span>
        <span>Global context only <span className="footer-divider">·</span> Not suitable for surface-route planning</span>
      </footer>
    </main>
  )
}

export default App
