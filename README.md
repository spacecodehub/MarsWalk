# MarsWalk P5 — Terrain and Route Planner

P5 is a React/Vite single-page frontend. It decodes configured P2 GeoTIFFs in the browser with `geotiff`, keeps NoData transparent, and submits route requests to the verified P4 navigation API. It does not bundle terrain files or calculate routes in the browser.

## Run

Use npm from the repository root:

```powershell
npm.cmd install
npm.cmd run dev
```

For verification and production output:

```powershell
npm.cmd run lint
npm.cmd run build
```

The P5 validation run executed the install, lint, build, and Vite dev-server commands. It also requested `/` and `/src/App.jsx` from the local dev server; both returned HTTP 200. No frontend test script or browser automation suite is defined in this repository.

## Configuration

Copy `.env.example` to `.env.local` and set HTTP-served URLs. Browser configuration must not contain local filesystem paths or secrets.

- `VITE_NAVIGATION_API_URL`: origin of the P4 FastAPI service, e.g. `http://localhost:8000`. The app calls `GET /api/health`, `GET /api/navigation/layers`, and `POST /api/navigation/route`.
- `VITE_TERRAIN_DEM_URL`: P2 5 m DEM GeoTIFF URL.
- `VITE_TERRAIN_SLOPE_URL`: P2 slope GeoTIFF URL, degrees.
- `VITE_TERRAIN_ASPECT_URL`: P2 aspect GeoTIFF URL, degrees clockwise from north.
- `VITE_TERRAIN_ROUGHNESS_URL`: P2 roughness GeoTIFF URL, metres.

The raster host and P4 API must allow browser CORS requests. The map reads each selected GeoTIFF's extent, dimensions, resolution, NoData tag, and CRS keys. It accepts the verified P2 Mars Equirectangular projection only. Start/destination clicks are converted from that raster extent into projected metres; those coordinates are sent unchanged to P4 with `coordinates_crs: null`. The frontend checks P4's DEM CRS, dimensions, bounds, and resolution against the displayed raster before enabling route calculation. Returned `coordinates_projected_m` vertices are drawn in the same projection; Mars lon/lat GeoJSON is not treated as Earth coordinates.

## P2 layers, coverage, and limits

Supported layers are the four aligned P2 HiRISE stereo products: DEM, slope, aspect, and roughness. Each is single-band Float32 on a 1517 × 3224 grid with 5 m pixels. The custom Equirectangular Mars CRS uses a 3,394,839.8133163 m local radius, 77.44°E central longitude, and 15° standard parallel. The DEM vertical reference is metres above the Mars 2000 equipotential surface.

| Layer | Units / meaning | NoData |
|---|---|---:|
| DEM | Elevation, metres | `-3.4028226550889045e38` |
| Slope | Horn 3×3 slope, degrees | `-9999` |
| Aspect | Horn aspect, clockwise degrees from north; flat cells are NoData | `-9999` |
| Roughness | 3×3 maximum minus minimum elevation, metres | `-9999` |

The footprint is only the local HiRISE stereo coverage, not all of Jezero or Mars. Transparent NoData shows the available raster shape. NoData and out-of-coverage cells are not interpolated. P2 reports a 10 m west / 55 m south relative CTX-to-HiRISE image offset (5 m component MAD); that is not absolute control. A possible 100–200 m offset from later operational products remains unresolved. These are exploratory terrain descriptors, not validated route-safety surfaces. Global MOLA is not a fallback or substitute.

P2 PR #5 is open on the inspected upstream repository. Its GeoTIFFs are not present on `main` until merged or served. With no configured URLs, the app reports terrain unavailable and renders no sample map.

## P4 navigation

The inspected P4 API accepts `POST /api/navigation/route` with `start`, `destination`, `mode`, and optional `coordinates_crs`, `safety`, `hazard_geojson`, and `hazard_crs`. This UI exposes the supported `safest` and `shortest` modes. It displays returned distance, maximum slope, maximum roughness, and cell count when those fields exist. P4 validates endpoints, data coverage, NoData, slope, and roughness; API errors remain visible and never become successful routes.

P4's terrain-aware API is on a separate branch/service and is not deployed by this frontend. Route planning remains disabled unless P4 reports terrain available, its DEM grid matches the displayed raster, and the P2 raster is loaded. The existing `feature/back` branch's `/api/mission` endpoint is simulated and is not used. P4 safety values are experimental demonstration settings, not NASA-certified limits.

## Science targets

The inspected P6 catalogue contains one target, `jezero-western-delta`, with null coordinates and CRS. It is not mapped, used to influence routes, or presented with a geographic location. Science-aware routing is omitted because no located science target is available.

## Pending verification

The P2 PR, P4 navigation branch, and P6 PR are separate upstream changes. The actual P2 LFS GeoTIFFs were decoded and their alignment, CRS keys, bounds, resolution, dimensions, NoData tags, and values were checked during this work. A live browser render against served raster URLs and an end-to-end route against a running P4 service remain unverified because those URLs/services are not configured in this checkout.
