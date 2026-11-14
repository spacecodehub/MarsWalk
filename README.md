# MarsWalk

MarsWalk combines Mars data provenance, terrain mapping, terrain-aware route planning, and science-target context for exploration planning. The current navigation service plans routes only within configured raster coverage and rejects NoData or unsafe terrain. It does not claim mission-certified route safety.

## Current project state

- **P1 data acquisition:** dataset inventory and provenance are maintained on open PR #4.
- **P2 terrain mapping:** reproducible Jezero terrain products and GIS validation are on open PR #5. The HiRISE products cover a local stereo footprint only; raw source products are not rehosted.
- **P4 route planning:** the FastAPI service and P2/P6 adapters are in this branch. It accepts projected coordinates in metres and returns a route, terrain metrics, exclusions, and geographic geometry.
- **P5 interface:** the web client reads availability and layer metadata from the API, submits route requests, and plots only the route geometry returned by the backend.
- **P6 science intelligence:** the versioned catalogue and science service are on open PR #3. The known Jezero western delta record has null coordinates and CRS; it cannot be plotted or used to reward a route. The documented 86.3/100 priority is a project heuristic, not a NASA score.

These contributor pull requests remain separate and should be reviewed before integration into `main`.

## Requirements

- Node.js and npm
- Python 3.10 or newer
- Python packages from `requirements-p4.txt`
- The four aligned P2 terrain rasters and the P6 catalogue for a real-data route

Install dependencies from the repository root:

```powershell
npm install
python -m venv .venv-p4
.\.venv-p4\Scripts\Activate.ps1
python -m pip install -r requirements-p4.txt
```

## Configure data

Set `MARSWALK_TERRAIN_DIR` to the directory containing the P2 DEM, slope, aspect, and roughness GeoTIFFs. The filenames and expected grid are defined in `terrain_adapter.py`. Set `MARSWALK_P6_TARGETS` to the versioned `targets.json` catalogue. The backend returns explicit unavailable states when these products are absent; it does not fall back to synthetic terrain or targets.

For aligned rasters stored under different names, set all required variables instead:

```powershell
$env:MARSWALK_DEM_PATH = "C:\data\dem.tif"
$env:MARSWALK_SLOPE_PATH = "C:\data\slope.tif"
$env:MARSWALK_ROUGHNESS_PATH = "C:\data\roughness.tif"
$env:MARSWALK_ASPECT_PATH = "C:\data\aspect.tif"
$env:MARSWALK_P6_TARGETS = "C:\data\targets.json"
```

When using `MARSWALK_TERRAIN_DIR`, clear any individual raster path variables so the directory configuration is used.

## Run locally

Start the API from the repository root in one terminal:

```powershell
python -m uvicorn api:app --reload --port 8000
```

Start the Vite client in another terminal:

```powershell
npm run dev
```

The Vite development server proxies `/api` requests to `http://127.0.0.1:8000`. For a deployed client, serve the API under the same origin or set `VITE_MARSWALK_API_URL` to an API host configured to allow the client origin.

In the interface, enter start and destination coordinates in the projected metre CRS reported by the P2 layer metadata. Requests outside valid terrain coverage, through NoData, or outside hard safety constraints fail with the backend's explanation. The route plot shows returned projected coordinates only; it is not a terrain basemap.

## API

FastAPI's interactive documentation is available at `http://127.0.0.1:8000/docs`.

- `GET /api/health` — API and configured data availability
- `GET /api/navigation/layers` — raster metadata, coverage, and alignment limitations
- `POST /api/navigation/route` — route generation (`shortest`, `safest`, or `science-aware`)
- `POST /api/navigation/compare` — compare shortest and risk-weighted routes
- `POST /api/navigation/feasibility` — check whether a safe path exists

## Validation

Run the P4 integration suite with the geospatial dependencies installed:

```powershell
python -m unittest discover -s tests -p "test_*.py" -v
```

The P2 PR documents its GIS validation and reproducible terrain processing commands in `GIS/README.md`. P1 provides `scripts/validate_p1_metadata.py`; P6 provides the science-engine test suite. Those files are on their respective open PR branches and are not present in this checkout yet.

## Data and scientific limitations

- Route safety thresholds are project demonstration settings, not NASA-certified operational limits.
- P2 terrain coverage is limited to the valid HiRISE stereo raster footprint. No route is supported beyond it.
- Relative image alignment has been estimated, but absolute alignment remains unverified; the documented possible 100–200 m displacement remains unresolved.
- The current P6 catalogue has one panorama aggregate target without point coordinates, CRS, or individual PDS image identifiers. Null location fields must stay null until authoritative location evidence is joined.
- MEDA and other science products must retain their own provenance and must not be treated as location evidence for the delta target.
- Global MOLA context, where available in the GIS deliverables, is not a substitute for the local route-safety rasters.
