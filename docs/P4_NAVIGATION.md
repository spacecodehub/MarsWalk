# P4 Terrain-Aware Navigation

## Status and integration boundaries

P4 adds a raster-backed route planner and FastAPI service. The repository's
`main` branch currently has no route API. P2 outputs are defined by open PR
[#5](https://github.com/spacecodehub/MarsWalk/pull/5), current head
`335412bdbf1bc02b244aef24a3d5b04e963968b2`; the PR is not merged. That PR now
includes `GIS/scripts/terrain_adapter.py`, a GDAL point sampler that validates
the bundle and rejects NoData/out-of-coverage points. A* needs access to the
full grid, so this branch's P2 adapter loads the same four documented rasters
as arrays and applies the P2 metadata checks before route search. It does not
copy or depend on files from the unmerged branch.

The real P2 GeoTIFFs were read from a temporary sparse worktree at the P2 PR
head for validation; they were not added to the P4 branch. The normal fixture
tests remain useful for fast repeatable unit coverage.

P6 is open PR [#3](https://github.com/spacecodehub/MarsWalk/pull/3), head
`b6a4f292f3063697877f39f723b51478261de8a5`; it is also not merged. Its actual
`targets.json` schema and scoring fields are the adapter contract. Its one
catalogued Jezero delta target has `coordinates: null` and `crs: null`, so it
is reported as unlocated and contributes no route reward. Science-aware
routing becomes available only when an evidence-backed, georeferenced target
is supplied. Tests use an explicitly synthetic target only to exercise the
scoring path. The actual P6 catalogue was also read from its open PR branch;
the adapter returned zero located targets and preserved the target's NASA
source provenance, as expected.

The current React app is the global MOLA atlas and has no navigation API
client or local GeoTIFF reader. The separate `feature/back` branch has a
FastAPI app with CORS and `/api/mission`; P4's router is exposed at both the
requested root paths and `/api/navigation` aliases. P5 can mount the same
`router` in its existing app with `app.include_router(router, prefix="/api")`.
P4 does not replace the UI or backend lifespan.

## Architecture and workflow

1. `P2TerrainAdapter` opens the documented DEM, slope, aspect, and roughness
   products and checks that their CRS, dimensions, and affine transforms match.
   It also checks P2's documented grid dimensions, origin, resolution, and
   local Mars CRS. It never resamples a safety layer.
2. `P6ScienceAdapter` validates schema version 1.0, target IDs, evidence
   provenance, and the documented 0–4 priority inputs. It transforms valid
   target longitude/latitude into the raster CRS; null or incomplete records
   stay unlocated and receive no reward.
3. `MarsRoutePlanner` combines valid DEM/slope/roughness cells, applies the
   configured safety limits and hazard masks, then searches the remaining
   graph. The same hard-valid mask is used by all three objectives.
4. `api.py` maps requests to the planner and returns route metrics and
   GeoJSON. It does not relax constraints or produce an unsafe fallback.

## A* connectivity, costs, and output coordinates

The grid uses 8-connectivity. Each edge length is computed from the raster's
full affine transform, including rotation or skew. A diagonal edge is allowed
only when both orthogonal side cells are also safe. The queue uses a stable
tie-break counter so equal-cost routes are reproducible.

- **Shortest:** edge cost is map distance. Euclidean map distance is an
  admissible heuristic.
- **Safest:** edge cost is distance times `1 + risk_weight * mean_relative_risk`;
  risk is normalized to 0–1 from slope and roughness. The Euclidean distance
  heuristic remains admissible because this multiplier is at least 1.
- **Science-aware:** uses the same risk term and subtracts a bounded reward
  proportional to the mean P6 priority near an edge. The multiplier is
  clamped above zero, and a zero heuristic (Dijkstra) is used.

Risk references (34.723 degrees slope and 13.039 metres roughness), weights,
and default safety limits (25 degrees slope and 10 metres roughness) are
experimental demonstration settings inherited or selected for this project.
They are not NASA-certified rover limits, verified traversability limits, or
an operational safety case. Configure limits for each use. The P2 roughness
is a 3x3 maximum-minus-minimum elevation range; the original local P4
preliminary product used 3x3 standard deviation. Their numbers are not
interchangeable, and this branch reads raw slope and roughness for hard limits.

Input points can be projected metres in the raster CRS (default), or can supply
`coordinates_crs` for a coordinate transformation. GeoJSON route vertices are
Mars east-positive longitude and planetocentric latitude in `[longitude,
latitude]` order; the response includes the projected metre coordinates and
the Mars raster CRS WKT. This is a structurally valid GeoJSON feature
collection with a Mars CRS extension, not a claim that Mars coordinates are
Earth WGS84. Frontends must honor `coordinate_convention` and `mars_crs_wkt`.

## P2 raster adapter contract

The adapter expects these files under `GIS/processed/hirise_terrain/`:

| File | Meaning | Units | NoData |
|---|---|---|---:|
| `DTEEC_022680_1985_022746_1985_A01_dem_5m.tif` | Average-resampled Mars 2000 equipotential elevation | m | `-3.4028227e38` |
| `DTEEC_022680_1985_022746_1985_A01_slope_deg.tif` | Horn 3x3 slope | degrees | `-9999` |
| `DTEEC_022680_1985_022746_1985_A01_aspect_deg.tif` | Horn aspect, clockwise from north; flat cells are NoData | degrees | `-9999` |
| `DTEEC_022680_1985_022746_1985_A01_roughness_3x3_m.tif` | 3x3 maximum minus minimum elevation | m | `-9999` |

Per P2's `GIS/documentation/P2_HANDOFF.md` and
`GIS/documentation/terrain_processing.json`, all four products are single-band
Float32, 1517 columns by 3224 rows, on a north-up 5 m grid. Origin is
(-3955.009842 m, 1088362.771 m). The custom Mars Equirectangular CRS uses local
sphere radius 3,394,839.813 m, central longitude 77.44 degrees east, and
standard parallel 15 degrees. Full CRS WKT, exact transforms, hashes, and
statistics are in P2's processing manifest. The P2 source DTM's vertical
reference is metres above the Mars 2000 equipotential surface.

All layers must have identical CRS, affine transform, shape, and coverage.
NoData from DEM/slope/roughness is excluded before traversal; aspect NoData on
flat cells does not make an otherwise valid cell unsafe. No interpolation or
extrapolation is performed. P2 outputs cover only the available HiRISE stereo
footprint, not all of Jezero. Routing outside the valid intersection is
rejected.

P2 measured a 12-tie relative CTX-to-HiRISE image displacement of 10 m west
and 55 m south, with 5 m component MAD. This is a relative estimate, not
verified absolute accuracy. A possible 100–200 m SIM offset remains
unverified. The exploratory terrain derivatives are not validated
traversability surfaces.

If generic rasters are needed for a test or local experiment, configure
`MARSWALK_DEM_PATH`, `MARSWALK_SLOPE_PATH`, `MARSWALK_ROUGHNESS_PATH`, and
optionally `MARSWALK_ASPECT_PATH`. Generic rasters still must match exactly in
CRS, affine transform, dimensions, and units appropriate to their layer.

## Hard safety constraints

The defaults are explicit experimental settings and can be overridden on each
route request. Every mode excludes:

- non-finite values, each layer's NoData, and cells outside raster coverage;
- slope above `max_slope_deg` or roughness above `max_roughness_m`;
- elevation outside optional `min_elevation_m` / `max_elevation_m`;
- cells burned from supplied GeoJSON Polygon or MultiPolygon hazards. Hazard
  rasterization uses `all_touched=true` for conservative exclusion.

Unsafe start or destination coordinates return an error. If no safe path
exists, the API reports infeasibility. There is no threshold relaxation,
science override, or fallback route. `excluded_cells` counts reasons and may
overlap because one cell can violate multiple constraints.

## P6 science adapter contract

The adapter consumes P6 `data/science/targets/targets.json` schema version
`1.0`: `target_id`, `name`, `geological_category`, `coordinates` with
`longitude_east_deg` and `latitude_deg`, `crs`, `priority_inputs`, and
`evidence_sources`. Priority scoring uses P6's own documented weights:

| P6 input | Weight |
|---|---:|
| `scientific_significance` | 0.25 |
| `evidence_strength` | 0.25 |
| `observation_availability` | 0.15 |
| `geological_diversity` | 0.15 |
| `investigation_value` | 0.20 |

Each input must be finite and between 0 and 4. The weighted score is mapped to
0–100 and used only as a soft, bounded route preference inside the configured
influence radius. Provenance URLs and evidence summaries accompany route
contributions. P6 explicitly excludes terrain danger, accessibility, route
distance, and route safety from its science score; P4 handles hard terrain
constraints independently.

The P6 PR is not merged, and its actual Jezero target has no point coordinates
or CRS. P4 therefore does not infer coordinates from a panorama image or use
that target as a spatial reward. A schema-shaped, mock target in tests is
marked as synthetic and only verifies the adapter computation.

## API contract

Run from the repository root after installing `requirements-p4.txt`:

```powershell
python -m uvicorn api:app --reload
```

The default terrain directory is `GIS/processed/hirise_terrain/`. The default
science catalogue is `data/science/targets/targets.json`. Override paths with
`MARSWALK_TERRAIN_DIR` or the four individual raster variables above and
`MARSWALK_P6_TARGETS`. `/health` stays available when the data are absent and
reports availability; route requests return 503 until required rasters exist.

### `GET /health`

Returns service and data availability:

```json
{"status":"ok","terrain_available":false,"science_catalogue_available":false}
```

The same handlers are available under `/api` for the current backend prefix,
including `/api/health` and `/api/navigation/route`.

### `GET /navigation/layers`

Returns layer paths, dimensions, CRS WKT, transform, bounds, resolution,
units, NoData, source availability, the limited P2 footprint, and the
alignment caveat. It does not claim coverage beyond the raster bounds.

### `POST /navigation/route`

Request:

```json
{
  "start": [-3000, 1087000],
  "destination": [-2500, 1086500],
  "mode": "safest",
  "coordinates_crs": null,
  "safety": {
    "max_slope_deg": 25,
    "max_roughness_m": 10,
    "min_elevation_m": null,
    "max_elevation_m": null
  },
  "hazard_geojson": null,
  "hazard_crs": null
}
```

Modes are `shortest`, `safest`, or `science-aware`. The first two need no P6
targets. Science-aware requests fail clearly if no located, evidence-backed
targets exist. `coordinates_crs` applies to start/destination; hazard
coordinates use `hazard_crs` or default to the raster CRS.

Success returns `feasible`, selected `mode`, distance, average/maximum
relative risk, elevation/slope/roughness summaries, excluded-cell counts,
`aspect_deg` summary (circular mean over non-NoData route cells), projected metre
vertices, a Mars-coordinate GeoJSON feature collection, and
`scientific_contribution` for science-aware routes. Invalid requests return
422; unavailable data return 503; unsafe or infeasible routes return a clear
4xx response. The API never returns an unsafe fallback.

### `POST /navigation/compare`

Uses the same start, destination, coordinate CRS, and hard safety settings to
attempt all three modes. Returns one result or explicit infeasibility error
per mode; it does not weaken constraints to make a mode succeed.

### `POST /navigation/feasibility`

Uses the same hard safety settings to validate both endpoints and search for
any safe connection. Returns `feasible`, start/destination grid cells, path
cell count, excluded-cell reasons, or a human-readable failure reason.

## Frontend integration

The current frontend has no navigation API client. The separate
`feature/back` FastAPI app serves `/api/mission`; mount the exported P4
`router` with `app.include_router(router, prefix="/api")` to add
`/api/navigation/*` while retaining its CORS middleware, database lifespan,
and existing mission route. The standalone `api:app` exposes both root
`/navigation/*` and `/api/navigation/*` paths. Send Mars projected coordinates
in the P2 CRS (or explicitly provide
`coordinates_crs`), and render route GeoJSON after interpreting its Mars
longitude/latitude coordinate convention. Use `/navigation/layers` to show
active layer metadata and valid extent. Provide controls for all three modes
and editable experimental constraints. Present infeasibility errors verbatim;
do not silently keep an old route after a failed response. A map based on the
global MOLA image needs a projection/extent-aware bridge before drawing this
regional route. The 5 m P2 GeoTIFFs are not browser-readable via the existing
atlas image flow; a tile service or explicit browser raster renderer is a
separate P5 task.

## Validation and test commands

Run the deterministic backend suite:

```powershell
python -m unittest discover -s tests -v
```

To run the two real-data integration tests, set
`MARSWALK_P2_TERRAIN_DIR` to the P2 branch's processed GeoTIFF directory and
`MARSWALK_P6_TARGETS` to the P6 branch's `data/science/targets/targets.json`,
then rerun the same command.

The tests cover path optimality/reproducibility, diagonal corner blocking,
all objectives sharing safety masks, slope/roughness/hazards/elevation,
NoData, unsafe endpoints, infeasibility, coordinate transforms, GeoJSON
ordering, raster alignment, P2 adapter shape, P6 schema and science scoring,
and all five API endpoints including validation errors. P2/P6 test data are
synthetic adapter fixtures, not merged project products. Two optional
integration tests can use actual open-PR data when
`MARSWALK_P2_TERRAIN_DIR` and `MARSWALK_P6_TARGETS` point to their checkout
paths. Without those variables, the actual-data tests are skipped.

Frontend checks (no frontend implementation is changed by P4):

```powershell
npm.cmd run lint
npm.cmd run build
```

Executed in this checkout on 2026-11-14:

- `python -B -m unittest discover -s tests -v`: **20 passed, 2 actual-data tests skipped** when open PR paths are not configured.
- Same suite with `MARSWALK_P2_TERRAIN_DIR` and `MARSWALK_P6_TARGETS` set to the temporary sparse worktrees: **22 passed**, including real P2 routing and actual P6 catalogue handling.
- Actual P2 smoke check at open PR #5 head `335412b`: adapter loaded the 1517x3224 grid, found 3,507,080 common valid cells, and planned a 5 m route over adjacent safe cells (maximum slope 7.4417 degrees; maximum roughness 1.6284 m).
- Actual P6 smoke check at open PR #3 head `b6a4f29`: zero located targets; `jezero-western-delta` was retained as unlocated because coordinates and CRS are null.
- `npm.cmd run lint`: **passed** (`eslint .`, exit code 0).
- `npm.cmd run build`: **passed** (Vite 8.3.8, 20 modules transformed).
- No Python type-checker or Python lint configuration is present in the
  repository; imports and syntax were exercised by the unit suite.

Experimental route scoring is not NASA-certified rover safety validation.

## Limitations and assumptions

- This experimental planner is not flight software or a NASA-certified
  safety model. Human review and mission-specific safety requirements are
  required before operational use.
- Real P2 outputs and the P6 catalogue remain on separate open PR branches.
  They passed the temporary real-data integration checks above, but are not
  bundled in the P4 branch. A deployment needs those raster files and the P6
  JSON present at the configured paths.
- P2's 100–200 m possible SIM offset remains unverified; 10 m west / 55 m
  south is relative alignment only.
- P2's local HiRISE footprint is small; no route is extrapolated through
  uncovered terrain.
- P2 DEM elevations use a Mars 2000 equipotential reference. Do not combine
  with SIM CTX/HRSC elevation values whose vertical references are unverified.
- P6's existing target coordinates are null; no real science target is
  currently spatially associated with the route.
- GeoJSON's coordinate convention is Mars-specific and must not be mistaken
  for Earth WGS84.
