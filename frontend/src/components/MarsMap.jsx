import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fromArrayBuffer } from 'geotiff';
import {
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Navigation,
  Compass,
  Info,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Target,
} from 'lucide-react';

const TERRAIN_LAYERS = [
  { id: 'dem', label: 'Elevation (DEM)', unit: 'm', legend: 'Mars areoid elevation · m' },
  { id: 'slope', label: 'Slope', unit: 'degrees', legend: 'Surface slope · degrees' },
  { id: 'aspect', label: 'Aspect', unit: 'degrees', legend: 'Orientation · clockwise from North' },
  { id: 'roughness', label: 'Roughness', unit: 'm', legend: '3×3 local relief · m' },
];

const EXPECTED_BOUNDS = [-3955.009842076782, 1072242.7709482254, 3629.990157923218, 1088362.7709482254];

function color(layerId, value, min, max) {
  const raw = max > min ? Math.max(0, Math.min(1, (value - min) / (max - min))) : 0.5;
  const t = layerId === 'dem' ? Math.pow(raw, 0.62) : raw;

  if (layerId === 'aspect') {
    const hue = ((value % 360) + 360) % 360;
    const c = 0.58 * (1 - Math.abs(1.16 - 1));
    const h = hue / 60;
    const x = c * (1 - Math.abs((h % 2) - 1));
    const rgb =
      h < 1
        ? [c, x, 0]
        : h < 2
        ? [x, c, 0]
        : h < 3
        ? [0, c, x]
        : h < 4
        ? [0, x, c]
        : h < 5
        ? [x, 0, c]
        : [c, 0, x];
    const m = 0.58 - c / 2;
    return rgb.map((v) => Math.round((v + m) * 255));
  }

  const stops =
    layerId === 'dem'
      ? [
          [31, 58, 82],
          [42, 104, 139],
          [90, 157, 151],
          [191, 178, 122],
          [239, 218, 160],
          [255, 248, 222],
        ]
      : layerId === 'slope'
      ? [
          [28, 44, 44],
          [86, 114, 99],
          [189, 132, 69],
          [229, 194, 130],
        ]
      : [
          [29, 43, 43],
          [76, 102, 85],
          [169, 116, 70],
          [223, 174, 108],
        ];

  const scaled = t * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(scaled));
  const f = scaled - i;
  return stops[i].map((v, c) => Math.round(v + (stops[i + 1][c] - v) * f));
}

export default function MarsMap({
  layersConfig = [],
  visibleLayers = {},
  activeLayerId: externalActiveLayerId,
  onLayerChange,
  targetsGeoJson = null,
  hazardsGeoJson = null,
  routeGeoJson = null,
  route = null,
  comparisonRoutes = null,
  startPoint = null,
  destPoint = null,
  pickMode = null,
  onPickPoint,
  onSelectFeature,
}) {
  const [internalLayerId, setInternalLayerId] = useState('dem');

  // Sync with external visibleLayers or activeLayerId if provided
  const activeLayerId = useMemo(() => {
    if (externalActiveLayerId) return externalActiveLayerId;
    if (visibleLayers) {
      if (visibleLayers.dem) return 'dem';
      if (visibleLayers.slope) return 'slope';
      if (visibleLayers.aspect) return 'aspect';
      if (visibleLayers.roughness) return 'roughness';
    }
    return internalLayerId;
  }, [externalActiveLayerId, visibleLayers, internalLayerId]);

  const activeLayerDef = useMemo(() => {
    return TERRAIN_LAYERS.find((l) => l.id === activeLayerId) || TERRAIN_LAYERS[0];
  }, [activeLayerId]);

  const [raster, setRaster] = useState(null);
  const [loading, setLoading] = useState(false);
  const [rasterError, setRasterError] = useState('');
  const [noDataToast, setNoDataToast] = useState(null);
  const rasterCache = useRef({});

  // Viewport & Transform state
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const routeCanvasRef = useRef(null);
  const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
  const [mapView, setMapView] = useState({ zoom: 1, x: 0, y: 0 });
  const [cursorTelemetry, setCursorTelemetry] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);

  // Interaction refs
  const dragRef = useRef(null);
  const pointersRef = useRef(new Map());
  const pinchRef = useRef(null);
  const suppressClickRef = useRef(false);

  // ResizeObserver for stage container
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        setMapSize({ width: entry.contentRect.width, height: entry.contentRect.height });
      }
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  // Fetch & Decode GeoTIFF
  useEffect(() => {
    let cancelled = false;

    if (rasterCache.current[activeLayerId]) {
      setRaster(rasterCache.current[activeLayerId]);
      setRasterError('');
      return;
    }

    setLoading(true);
    setRasterError('');

    const url = `/api/navigation/terrain/${activeLayerId}.tif`;

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${activeLayerId}.tif`);
        return res.arrayBuffer();
      })
      .then(async (arrayBuffer) => {
        if (cancelled) return;
        const tiff = await fromArrayBuffer(arrayBuffer);
        const image = await tiff.getImage();
        const width = image.getWidth();
        const height = image.getHeight();
        const [values] = await image.readRasters({ samples: [0], interleave: false });
        const bounds = image.getBoundingBox();

        // Calculate valid cells & statistical stretch
        const valid = new Float32Array(values.length);
        let validCount = 0;
        for (let i = 0; i < values.length; i++) {
          const v = values[i];
          if (Number.isFinite(v) && v > -1e30 && v !== -9999) {
            valid[validCount++] = v;
          }
        }

        if (validCount === 0) throw new Error('No valid terrain cells in raster.');

        const validValues = valid.subarray(0, validCount);
        validValues.sort();
        const min = validValues[0];
        const max = validValues[validCount - 1];
        const low = validValues[Math.floor((validCount - 1) * 0.02)];
        const high = validValues[Math.floor((validCount - 1) * 0.98)];

        // Generate pixel ImageData
        const pixels = new ImageData(width, height);
        for (let i = 0; i < values.length; i++) {
          const o = 4 * i;
          const v = values[i];
          if (!Number.isFinite(v) || v <= -1e30 || v === -9999) {
            pixels.data[o + 3] = 0;
            continue;
          }
          const rgb = color(activeLayerId, v, activeLayerId === 'aspect' ? 0 : low, activeLayerId === 'aspect' ? 360 : high);
          pixels.data[o] = rgb[0];
          pixels.data[o + 1] = rgb[1];
          pixels.data[o + 2] = rgb[2];
          pixels.data[o + 3] = 255;
        }

        const rasterData = {
          width,
          height,
          pixels,
          values,
          min,
          max,
          low,
          high,
          validCount,
          totalCount: values.length,
          bounds: bounds || EXPECTED_BOUNDS,
        };

        if (!cancelled) {
          rasterCache.current[activeLayerId] = rasterData;
          setRaster(rasterData);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setRasterError(err.message || 'Failed to decode HiRISE GeoTIFF raster.');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeLayerId]);

  // Render Raster to Background Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !raster) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = raster.width;
    canvas.height = raster.height;
    ctx.putImageData(raster.pixels, 0, 0);
  }, [raster]);

  // Extract Route Coordinates
  const routeCoordinates = useMemo(() => {
    if (route?.coordinates_projected_m && Array.isArray(route.coordinates_projected_m)) {
      return route.coordinates_projected_m;
    }
    if (routeGeoJson?.features?.[0]?.geometry?.coordinates) {
      return routeGeoJson.features[0].geometry.coordinates;
    }
    if (routeGeoJson?.geometry?.coordinates) {
      return routeGeoJson.geometry.coordinates;
    }
    return null;
  }, [route, routeGeoJson]);

  // Render Calculated Route(s) on Overlay Canvas (Shortest & Safest or Single Mode)
  useEffect(() => {
    const canvas = routeCanvasRef.current;
    if (!canvas || !raster) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = raster.width;
    canvas.height = raster.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const [minX, minY, maxX, maxY] = raster.bounds;

    const drawPath = (coords, strokeColor, shadowColor, lineWidth) => {
      if (!Array.isArray(coords) || coords.length < 2) return;

      // Glow shadow
      ctx.save();
      ctx.beginPath();
      coords.forEach(([x, y], i) => {
        const px = ((x - minX) / (maxX - minX)) * raster.width;
        const py = ((maxY - y) / (maxY - minY)) * raster.height;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.strokeStyle = shadowColor;
      ctx.lineWidth = Math.max(16, raster.width / 75);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Sharp core path
      ctx.beginPath();
      coords.forEach(([x, y], i) => {
        const px = ((x - minX) / (maxX - minX)) * raster.width;
        const py = ((maxY - y) / (maxY - minY)) * raster.height;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = lineWidth || Math.max(8, raster.width / 160);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.restore();
    };

    if (comparisonRoutes) {
      // Draw Shortest Route (Neon Cyan)
      if (comparisonRoutes.shortest?.coordinates_projected_m) {
        drawPath(
          comparisonRoutes.shortest.coordinates_projected_m,
          '#38BDF8',
          'rgba(56, 189, 248, 0.4)',
          Math.max(7, raster.width / 170)
        );
      }
      // Draw Safest Route (Mars Gold/Amber)
      if (comparisonRoutes.safest?.coordinates_projected_m) {
        drawPath(
          comparisonRoutes.safest.coordinates_projected_m,
          '#F1C58A',
          'rgba(217, 107, 67, 0.45)',
          Math.max(9, raster.width / 150)
        );
      }
    } else if (routeCoordinates && routeCoordinates.length >= 2) {
      const isShortest = route?.mode === 'shortest';
      const isScience = route?.mode === 'science-aware';
      const coreColor = isShortest ? '#38BDF8' : isScience ? '#10B981' : '#F1C58A';
      const shadowColor = isShortest
        ? 'rgba(56, 189, 248, 0.4)'
        : isScience
        ? 'rgba(16, 185, 129, 0.4)'
        : 'rgba(217, 107, 67, 0.4)';

      drawPath(routeCoordinates, coreColor, shadowColor, Math.max(8, raster.width / 160));
    }
  }, [raster, routeCoordinates, comparisonRoutes, route]);

  // Map Controls & Navigation
  const fitView = useCallback((zoom = 1) => {
    setMapView({ zoom, x: 0, y: 0 });
  }, []);

  const zoomAt = useCallback((nextZoom, clientX, clientY) => {
    const bounds = stageRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const zoom = Math.max(0.8, Math.min(10, nextZoom));
    const cx = clientX - bounds.left - bounds.width / 2;
    const cy = clientY - bounds.top - bounds.height / 2;
    setMapView((view) => {
      const ratio = zoom / view.zoom;
      return { zoom, x: cx - (cx - view.x) * ratio, y: cy - (cy - view.y) * ratio };
    });
  }, []);

  const fitRoute = useCallback(() => {
    if (!raster || !mapSize.width || !mapSize.height) return;

    let coordsToFit = null;
    if (comparisonRoutes) {
      coordsToFit = [
        ...(comparisonRoutes.safest?.coordinates_projected_m || []),
        ...(comparisonRoutes.shortest?.coordinates_projected_m || []),
      ];
    } else if (routeCoordinates && routeCoordinates.length >= 2) {
      coordsToFit = routeCoordinates;
    } else if (startPoint && destPoint) {
      coordsToFit = [startPoint, destPoint];
    }

    if (!coordsToFit || coordsToFit.length < 2) return;

    const xs = coordsToFit.map(([x]) => x);
    const ys = coordsToFit.map(([, y]) => y);
    const [minX, minY, maxX, maxY] = raster.bounds;
    const px = (Math.min(...xs) + Math.max(...xs)) / 2;
    const py = (Math.min(...ys) + Math.max(...ys)) / 2;
    const rasterAspect = raster.width / raster.height;
    const baseWidth = Math.min(mapSize.width * 0.92, mapSize.height * 0.92 * rasterAspect);
    const baseHeight = baseWidth / rasterAspect;
    const spanX = Math.max(Math.max(...xs) - Math.min(...xs), (maxX - minX) * 0.02);
    const spanY = Math.max(Math.max(...ys) - Math.min(...ys), (maxY - minY) * 0.02);
    const zoom = Math.max(1, Math.min(8, Math.min(0.7 / (spanX / (maxX - minX)), 0.7 / (spanY / (maxY - minY)))));
    const x = (0.5 - (px - minX) / (maxX - minX)) * baseWidth * zoom;
    const y = (0.5 - (maxY - py) / (maxY - minY)) * baseHeight * zoom;
    setMapView({ zoom, x, y });
  }, [mapSize, raster, routeCoordinates, comparisonRoutes, startPoint, destPoint]);

  // Auto-fit route when calculated
  useEffect(() => {
    if ((routeCoordinates && routeCoordinates.length >= 2) || comparisonRoutes) {
      fitRoute();
    }
  }, [routeCoordinates, comparisonRoutes]);

  const onWheel = useCallback(
    (e) => {
      e.preventDefault();
      zoomAt(mapView.zoom * (e.deltaY < 0 ? 1.18 : 1 / 1.18), e.clientX, e.clientY);
    },
    [mapView, zoomAt]
  );

  const onPointerDown = useCallback(
    (e) => {
      if (e.button !== 0 || e.target.closest('.map-controls')) return;
      suppressClickRef.current = false;
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (e.pointerType === 'touch' && pointersRef.current.size === 2) {
        const [a, b] = [...pointersRef.current.values()];
        pinchRef.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom: mapView.zoom, view: mapView };
        dragRef.current = null;
        e.currentTarget.setPointerCapture(e.pointerId);
        return;
      }

      dragRef.current = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        moved: false,
        viewX: mapView.x,
        viewY: mapView.y,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [mapView]
  );

  const onPointerMove = useCallback(
    (e) => {
      if (pointersRef.current.has(e.pointerId)) {
        pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }

      if (pinchRef.current && pointersRef.current.size >= 2) {
        const [a, b] = [...pointersRef.current.values()];
        const bounds = stageRef.current?.getBoundingClientRect();
        if (!bounds) return;
        const pinch = pinchRef.current;
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        const zoom = Math.max(0.8, Math.min(10, (pinch.zoom * distance) / Math.max(1, pinch.distance)));
        const cx = (a.x + b.x) / 2 - bounds.left - bounds.width / 2;
        const cy = (a.y + b.y) / 2 - bounds.top - bounds.height / 2;
        const ratio = zoom / pinch.view.zoom;
        setMapView({ zoom, x: cx - (cx - pinch.view.x) * ratio, y: cy - (cy - pinch.view.y) * ratio });
        return;
      }

      const drag = dragRef.current;
      if (drag && drag.id === e.pointerId) {
        const dx = e.clientX - drag.x;
        const dy = e.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
        if (drag.moved) {
          setMapView((view) => ({ ...view, x: drag.viewX + dx, y: drag.viewY + dy }));
        }
      }

      // Telemetry Inspector on Hover
      if (raster && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        const [minX, minY, maxX, maxY] = raster.bounds;
        const px = Math.max(0, Math.min(raster.width - 1, ((e.clientX - rect.left) / rect.width) * raster.width));
        const py = Math.max(0, Math.min(raster.height - 1, ((e.clientY - rect.top) / rect.height) * raster.height));
        const col = Math.floor(px);
        const row = Math.floor(py);
        const value = raster.values[row * raster.width + col];

        if (Number.isFinite(value) && value > -1e30 && value !== -9999) {
          const easting = minX + (px / raster.width) * (maxX - minX);
          const northing = maxY - (py / raster.height) * (maxY - minY);
          setCursorTelemetry({ easting, northing, value });
        } else {
          setCursorTelemetry(null);
        }
      }
    },
    [raster]
  );

  const onPointerUp = useCallback((e) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (dragRef.current?.id === e.pointerId) {
      const moved = dragRef.current.moved;
      dragRef.current = null;
      if (moved) suppressClickRef.current = true;
    }
  }, []);

  const handleStageClick = useCallback(
    (e) => {
      if (e.target.closest('.map-controls') || e.target.closest('.layer-tabs')) return;
      if (suppressClickRef.current) {
        suppressClickRef.current = false;
        return;
      }
      if (!raster || !canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      if (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      ) {
        return;
      }

      const [minX, minY, maxX, maxY] = raster.bounds;
      const cellResX = (maxX - minX) / raster.width;
      const cellResY = (maxY - minY) / raster.height;
      const px = Math.max(0, Math.min(raster.width - 1, ((e.clientX - rect.left) / rect.width) * raster.width));
      const py = Math.max(0, Math.min(raster.height - 1, ((e.clientY - rect.top) / rect.height) * raster.height));
      const col = Math.floor(px);
      const row = Math.floor(py);
      const value = raster.values[row * raster.width + col];

      if (!Number.isFinite(value) || value <= -1e30 || value === -9999) {
        setNoDataToast('Clicked cell is in NoData / unmapped zone. Please select a visible colored terrain cell.');
        setTimeout(() => setNoDataToast(null), 3500);
        return;
      }

      const point = [
        Math.round((minX + (col + 0.5) * cellResX) * 10) / 10,
        Math.round((maxY - (row + 0.5) * cellResY) * 10) / 10,
      ];

      setSelectedCell({
        easting: point[0],
        northing: point[1],
        value,
        layer: activeLayerDef.label,
        unit: activeLayerDef.unit,
      });

      if (onPickPoint) {
        onPickPoint(point, value);
      }

      if (onSelectFeature) {
        onSelectFeature({
          name: `Terrain Cell (${activeLayerDef.label})`,
          easting: `${point[0].toFixed(1)} m`,
          northing: `${point[1].toFixed(1)} m`,
          [activeLayerDef.label]: `${value.toFixed(2)} ${activeLayerDef.unit}`,
        });
      }
    },
    [activeLayerDef, onPickPoint, onSelectFeature, raster]
  );

  const handleLayerSwitch = (id) => {
    setInternalLayerId(id);
    if (onLayerChange) onLayerChange(id);
  };

  // Derive Start & Destination pin positions
  const startPin = useMemo(() => {
    if (startPoint) return startPoint;
    if (routeCoordinates && routeCoordinates.length > 0) return routeCoordinates[0];
    return null;
  }, [startPoint, routeCoordinates]);

  const destPin = useMemo(() => {
    if (destPoint) return destPoint;
    if (routeCoordinates && routeCoordinates.length > 1) return routeCoordinates[routeCoordinates.length - 1];
    return null;
  }, [destPoint, routeCoordinates]);

  const rasterAspect = raster ? raster.width / raster.height : 1517 / 3224;
  const frameWidth = Math.min(mapSize.width * 0.94, mapSize.height * 0.94 * rasterAspect);

  return (
    <div className="relative w-full h-full bg-space-950 rounded-xl border border-space-700 overflow-hidden flex flex-col select-none">
      {/* Top Map Toolbar: Layer Switcher & Status */}
      <div className="z-10 bg-space-900/90 backdrop-blur-md border-b border-space-800 px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
        <div className="flex items-center gap-1.5 layer-tabs">
          <Layers className="w-4 h-4 text-mars-500 mr-1" />
          {TERRAIN_LAYERS.map((layer) => (
            <button
              key={layer.id}
              onClick={() => handleLayerSwitch(layer.id)}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${
                activeLayerId === layer.id
                  ? 'bg-mars-500 text-white font-bold shadow-md'
                  : 'bg-space-800 text-slate-300 hover:bg-space-700 hover:text-white'
              }`}
            >
              {layer.label.split(' ')[0]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 text-[11px] text-slate-400">
          {cursorTelemetry && (
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-0.5 rounded bg-space-950 border border-space-700 text-slate-200">
              <span>E: {cursorTelemetry.easting.toFixed(0)}m</span>
              <span>N: {cursorTelemetry.northing.toFixed(0)}m</span>
              <span className="text-mars-500 font-semibold">
                {cursorTelemetry.value.toFixed(1)} {activeLayerDef.unit}
              </span>
            </div>
          )}
          <span className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${raster ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
            {loading ? 'Decoding GeoTIFF…' : raster ? '5m HiRISE Live' : 'Connecting'}
          </span>
        </div>
      </div>

      {/* Main Interactive Map Stage */}
      <div
        ref={stageRef}
        onClick={handleStageClick}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={`relative flex-1 w-full overflow-hidden flex items-center justify-center bg-space-950 ${
          pickMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
        }`}
      >
        {/* Map Picking HUD Prompt Banner */}
        {pickMode === 'start' && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-xl bg-emerald-950/90 border border-emerald-500 text-emerald-200 text-xs font-mono shadow-2xl flex items-center gap-2.5 animate-bounce backdrop-blur-md">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-bold">CLICK ON TERRAIN TO SET SOURCE (START) [S]</span>
          </div>
        )}

        {pickMode === 'dest' && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-xl bg-mars-950/90 border border-mars-500 text-mars-200 text-xs font-mono shadow-2xl flex items-center gap-2.5 animate-bounce backdrop-blur-md">
            <span className="w-2.5 h-2.5 rounded-full bg-mars-500 animate-ping" />
            <span className="font-bold">CLICK ON TERRAIN TO SET DESTINATION (TARGET) [D]</span>
          </div>
        )}

        {/* Temporary NoData Warning Toast */}
        {noDataToast && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-xl bg-rose-950/95 border border-rose-500 text-rose-200 text-xs font-mono shadow-2xl flex items-center gap-2 animate-fade-in backdrop-blur-md">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{noDataToast}</span>
          </div>
        )}

        {/* Comparison Route Legend Overlay (When both paths are shown) */}
        {comparisonRoutes && (
          <div className="absolute top-3 right-3 z-10 px-3 py-2 rounded-xl bg-space-900/90 backdrop-blur-md border border-space-700 font-mono text-[11px] space-y-1.5 shadow-xl animate-fade-in">
            <div className="flex items-center gap-2 text-amber-300">
              <span className="w-3.5 h-1.5 rounded-full bg-[#F1C58A]" />
              <span>Safest: {comparisonRoutes.safest?.distance_m?.toFixed(0)}m</span>
            </div>
            <div className="flex items-center gap-2 text-cyan-300">
              <span className="w-3.5 h-1.5 rounded-full bg-[#38BDF8]" />
              <span>Shortest: {comparisonRoutes.shortest?.distance_m?.toFixed(0)}m</span>
            </div>
          </div>
        )}

        {/* Loading Spinner Indicator */}
        {loading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-space-950/80 backdrop-blur-sm pointer-events-none">
            <div className="relative flex items-center justify-center w-12 h-12 mb-3">
              <span className="absolute inset-0 rounded-full border border-mars-500 animate-pulse-ring" />
              <span className="w-3 h-3 rounded-full bg-mars-500 animate-ping" />
            </div>
            <p className="text-sm font-medium text-slate-200 font-mono">
              Loading {activeLayerDef.label} Terrain
            </p>
            <p className="text-xs font-mono text-slate-400 mt-1">
              Decoding 5 m HiRISE GeoTIFF raster in browser…
            </p>
          </div>
        )}

        {/* Error Fallback */}
        {rasterError && !loading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-space-950/90 p-4 text-center">
            <AlertTriangle className="w-10 h-10 text-rose-500 mb-2" />
            <p className="text-sm font-semibold text-rose-300 font-mono">{rasterError}</p>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              Ensure FastAPI backend is running on port 8000.
            </p>
          </div>
        )}

        {/* Scaled & Translated Raster Frame */}
        {raster && (
          <div
            className="absolute shadow-2xl transition-transform ease-out duration-75 will-change-transform"
            style={{
              width: `${frameWidth}px`,
              aspectRatio: `${raster.width} / ${raster.height}`,
              transform: `translate(calc(-50% + ${mapView.x}px), calc(-50% + ${mapView.y}px)) scale(${mapView.zoom})`,
              transformOrigin: 'center center',
            }}
          >
            {/* Background Terrain Canvas */}
            <canvas
              ref={canvasRef}
              className="block w-full h-full"
              style={{ imageRendering: 'pixelated' }}
            />

            {/* Route Overlay Canvas */}
            <canvas
              ref={routeCanvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
            />

            {/* SVG Markers for Start / Destination / Science Targets */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none overflow-visible"
              viewBox={`0 0 ${raster.width} ${raster.height}`}
              preserveAspectRatio="none"
            >
              {/* Start Point Pin (S) */}
              {startPin && (() => {
                const [minX, minY, maxX, maxY] = raster.bounds;
                const sx = ((startPin[0] - minX) / (maxX - minX)) * raster.width;
                const sy = ((maxY - startPin[1]) / (maxY - minY)) * raster.height;
                return (
                  <g key="start-pin" transform={`translate(${sx}, ${sy})`}>
                    <circle r="46" fill="rgba(16, 185, 129, 0.3)" stroke="#10B981" strokeWidth="6" />
                    <circle r="24" fill="#10B981" />
                    <text y="9" fill="#FFFFFF" fontSize="26" fontWeight="bold" textAnchor="middle">
                      S
                    </text>
                  </g>
                );
              })()}

              {/* Destination Point Pin (D) */}
              {destPin && (() => {
                const [minX, minY, maxX, maxY] = raster.bounds;
                const dx = ((destPin[0] - minX) / (maxX - minX)) * raster.width;
                const dy = ((maxY - destPin[1]) / (maxY - minY)) * raster.height;
                return (
                  <g key="dest-pin" transform={`translate(${dx}, ${dy})`}>
                    <circle r="46" fill="rgba(217, 107, 67, 0.3)" stroke="#D96B43" strokeWidth="6" />
                    <circle r="24" fill="#D96B43" />
                    <text y="9" fill="#FFFFFF" fontSize="26" fontWeight="bold" textAnchor="middle">
                      D
                    </text>
                  </g>
                );
              })()}
            </svg>
          </div>
        )}

        {/* Viewport Control Buttons */}
        <div className="map-controls absolute bottom-4 right-4 z-10 flex flex-col gap-1.5 bg-space-900/90 backdrop-blur-md p-1.5 rounded-xl border border-space-700 shadow-xl">
          <button
            type="button"
            onClick={() => fitView(mapView.zoom * 1.3)}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-space-800 hover:bg-space-700 text-slate-200 hover:text-white transition-colors cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => fitView(mapView.zoom / 1.3)}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-space-800 hover:bg-space-700 text-slate-200 hover:text-white transition-colors cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => fitView(1)}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-space-800 hover:bg-space-700 text-slate-200 hover:text-white transition-colors cursor-pointer"
            title="Reset / Fit Terrain"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          {(routeCoordinates || comparisonRoutes) && (
            <button
              type="button"
              onClick={fitRoute}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-mars-500/20 border border-mars-500/50 hover:bg-mars-500/40 text-mars-500 transition-colors cursor-pointer"
              title="Fit Calculated Route"
            >
              <Navigation className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Cell Telemetry Popup */}
        {selectedCell && (
          <div className="absolute top-4 left-4 z-10 max-w-xs bg-space-900/95 backdrop-blur-md border border-mars-500/40 rounded-xl p-3.5 shadow-xl font-mono text-xs animate-fade-in">
            <div className="flex items-center justify-between border-b border-space-700 pb-1.5 mb-2">
              <span className="text-mars-500 font-bold uppercase">{selectedCell.layer} Telemetry</span>
              <button
                onClick={() => setSelectedCell(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">P2 Easting:</span>
                <span className="text-slate-100">{selectedCell.easting.toFixed(2)} m</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">P2 Northing:</span>
                <span className="text-slate-100">{selectedCell.northing.toFixed(2)} m</span>
              </div>
              <div className="flex justify-between border-t border-space-800 pt-1">
                <span className="text-slate-400">{selectedCell.layer}:</span>
                <span className="text-emerald-400 font-bold">
                  {selectedCell.value.toFixed(2)} {selectedCell.unit}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Map Footer HUD: Legend Ramp & Grid Footprint Info */}
      {raster && (
        <div className="bg-space-900/95 border-t border-space-800 px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono">
          {/* Active Layer Legend Ramp */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <span className="text-slate-400 text-[11px] whitespace-nowrap">
              {activeLayerId === 'aspect' ? '0° (N)' : `${raster.low.toFixed(1)} ${activeLayerDef.unit}`}
            </span>
            <div
              className="h-2 flex-1 sm:w-48 rounded-full border border-space-700"
              style={{
                background:
                  activeLayerId === 'dem'
                    ? 'linear-gradient(90deg, #1F3A52, #2A688B, #5A9D97, #BFB27A, #EFDAA0, #FFF8DE)'
                    : activeLayerId === 'slope'
                    ? 'linear-gradient(90deg, #1C2C2C, #567263, #BD8445, #E5C282)'
                    : activeLayerId === 'roughness'
                    ? 'linear-gradient(90deg, #1D2B2B, #4C6655, #A97446, #DFAE6C)'
                    : 'linear-gradient(90deg, hsl(0,58%,58%), hsl(60,58%,58%), hsl(120,58%,58%), hsl(180,58%,58%), hsl(240,58%,58%), hsl(300,58%,58%), hsl(360,58%,58%))',
              }}
            />
            <span className="text-slate-400 text-[11px] whitespace-nowrap">
              {activeLayerId === 'aspect' ? '360° (N)' : `${raster.high.toFixed(1)} ${activeLayerDef.unit}`}
            </span>
            <span className="text-slate-500 text-[10px] hidden md:inline">
              ({activeLayerId === 'dem' ? '2–98% stretch' : activeLayerDef.legend})
            </span>
          </div>

          {/* Grid Footprint Stats */}
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span>5 m grid ({((raster.validCount / raster.totalCount) * 100).toFixed(1)}% valid)</span>
            <span className="hidden lg:inline text-slate-500">
              E {raster.bounds[0].toFixed(0)} to {raster.bounds[2].toFixed(0)} m · N {raster.bounds[1].toFixed(0)} to {raster.bounds[3].toFixed(0)} m
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
