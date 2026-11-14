# MarsWalk

MarsWalk combines source-linked Mars science information with a local terrain map and hard-constrained route planning for the available Jezero HiRISE stereo footprint. The browser loads the actual P2 GeoTIFFs served by the FastAPI backend, checks the map grid against P4 metadata, and sends selected projected coordinates to P4. The browser does not synthesize terrain or calculate successful routes locally.

## Components and status

- **P1 — Data acquisition:** source inventory, validation manifests, provenance documents, and one checked-in Mastcam-Z source product. Products that were not acquired remain explicitly marked unavailable.
- **P2 — Terrain/GIS:** MOLA global context, GIS inventory and QGIS project, and four 5 m HiRISE analysis GeoTIFFs in Git LFS: DEM, slope, aspect, and roughness. The regional products cover only their stereo footprint.
- **P4 — Route planning:** A* navigation API, terrain constraints, NoData/coverage rejection, route comparison, and P2/P6 adapters.
- **P5 — Map and route interface:** browser GeoTIFF rendering, layer selection, start/destination picking, P4 grid verification, and returned route metrics.
- **P6 — Science intelligence:** versioned source-linked catalogue, target schema, environmental observations, and MEDA processing. The current `jezero-western-delta` target is not located; its coordinates and CRS are null.

Contributor history is preserved in the release branch merges. Source PRs #3, #4, and #5 remain open for review and are not modified by this release branch.

## Data provenance and limits

- The route map is the actual P2 local HiRISE stereo footprint, not a complete Jezero or Mars basemap. Global MOLA is available for context and is not a route-safety surface.
- The four P2 analysis layers share a 1517 × 3224 grid at 5 m resolution. Their CRS, bounds, units, and NoData tags are validated by the P5 loader and P4 terrain adapter.
- NoData is transparent in the map and excluded from routing. The API does not interpolate terrain or route beyond valid coverage.
- P2 reports a 10 m west / 55 m south relative CTX-to-HiRISE offset (5 m component MAD). Absolute alignment remains unverified; a possible 100–200 m offset from later operational products is unresolved.
- These terrain descriptors and route thresholds are exploratory project settings, not NASA-certified safety limits or an operational rover navigation system.
- The P6 target points to a NASA Mastcam-Z panorama aggregate, not individual PDS image IDs. NASA's cited resource does not provide verified point coordinates or CRS, so the target appears in a list only and cannot influence route rewards.
- Any displayed science priority is the P6 project heuristic. It is not an official NASA score. Science priority cannot override P4's hard terrain constraints.
- The P1 Mastcam-Z file and MEDA sample have their own provenance. MEDA is not evidence for the delta target's location.

## Requirements

- Node.js 20.19+ or 22.12+, and npm
- Python 3.10+
- Git LFS for the tracked terrain rasters

## Install

From a fresh clone:

```powershell
git lfs install
git lfs pull
npm ci
python -m venv .venv-p4
.\.venv-p4\Scripts\Activate.ps1
python -m pip install -r requirements-p4.txt
python -m pip install -r requirements-science.txt
```

`requirements-p4.txt` installs the API and geospatial runtime. `requirements-science.txt` adds the Pandas/Matplotlib tools used to process and report on MEDA data.

## Run the application

Start the backend from the repository root in one terminal:

```powershell
$env:MARSWALK_TERRAIN_DIR = (Resolve-Path .\GIS\processed\hirise_terrain).Path
$env:MARSWALK_P6_TARGETS = (Resolve-Path .\data\science\targets\targets.json).Path
python -m uvicorn api:app --reload --port 8000
```

Start the frontend in a second terminal:

```powershell
npm run dev
```

Open the URL printed by Vite, normally `http://localhost:5173`. Vite proxies `/api` to the backend. The P2 GeoTIFF URLs default to the backend's `/api/navigation/terrain/{layer}.tif` endpoints, so a local `.env.local` is not required. To serve the frontend and API on separate origins, copy `.env.example` to `.env.local`, set `VITE_NAVIGATION_API_URL`, and configure `MARSWALK_CORS_ORIGINS` on the API to include the frontend origin.

The app begins with the DEM. Use the layer buttons to inspect slope, aspect, or roughness. Click a visible valid pixel to choose the start, then the destination. P5 confirms the displayed raster grid matches the P4 DEM grid before enabling the request. The API reports why an endpoint or route is rejected.

## API

Interactive API documentation: `http://127.0.0.1:8000/docs`.

- `GET /api/health` — backend and configured data availability
- `GET /api/navigation/layers` — raster metadata, coverage, and alignment limitations
- `GET /api/navigation/terrain/{dem|slope|aspect|roughness}.tif` — configured raster stream for the map
- `POST /api/navigation/route` — `shortest`, `safest`, or `science-aware` planning
- `POST /api/navigation/compare` — shortest and risk-weighted route comparison
- `POST /api/navigation/feasibility` — safe-path feasibility check
- `GET /api/science/targets` — P6 map payload; unlocated targets remain list-only

## Validate

Run the Python suites and P1 metadata validation:

```powershell
python -m unittest discover -s tests -p "test_*.py" -v
python -m unittest discover -s GIS\scripts -p "test_*.py" -v
python scripts\validate_p1_metadata.py
```

The GIS processing and some GIS validation commands require the QGIS Python/GDAL environment described in [`GIS/README.md`](GIS/README.md). Frontend checks:

```powershell
npm run lint
npm run build
```

P6 science-engine checks are included in the `tests` suite. The P4 suite supports real-data integration through `MARSWALK_P2_TERRAIN_DIR` and `MARSWALK_P6_TARGETS`; when unset, only the explicitly labelled fixture tests run.

## Configuration

The backend defaults to `GIS/processed/hirise_terrain/` and `data/science/targets/targets.json`. Set `MARSWALK_TERRAIN_DIR` and `MARSWALK_P6_TARGETS` when using alternate local data. For individual aligned rasters instead of the P2 directory, set `MARSWALK_DEM_PATH`, `MARSWALK_SLOPE_PATH`, and `MARSWALK_ROUGHNESS_PATH`; aspect is optional. The Vite proxy is for local development; deployments should serve `/api` behind the same origin or set an API origin and allow it explicitly in `MARSWALK_CORS_ORIGINS`.

## Further documentation

- [`GIS/README.md`](GIS/README.md) — GIS products, reproducible processing, and QGIS setup
- [`GIS/documentation/P2_HANDOFF.md`](GIS/documentation/P2_HANDOFF.md) — P2 provenance, CRS, NoData, coverage, and alignment
- [`docs/P4_NAVIGATION.md`](docs/P4_NAVIGATION.md) — route engine, API schemas, and hard constraints
- [`docs/P6_P4_P5_SCIENCE_TARGET_INTERFACE.md`](docs/P6_P4_P5_SCIENCE_TARGET_INTERFACE.md) — target payload and map policy
- [`docs/SCIENCE_METHODOLOGY.md`](docs/SCIENCE_METHODOLOGY.md) — documented priority heuristic
- [`docs/P1_SOURCE_PROVENANCE.md`](docs/P1_SOURCE_PROVENANCE.md) — acquired data and source status
