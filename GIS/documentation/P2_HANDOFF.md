# MarsWalk P2 GIS handoff

## Executive status

**Regional source validation, a reproducible QGIS project, and local HiRISE
terrain derivatives are implemented.** The products cover only the HiRISE
stereo footprint, not all of Jezero or SIM 3464. Absolute positional accuracy
and the reported 100–200 m operational offset remain unresolved.

Generated evidence:

- [`dataset_inventory.csv`](dataset_inventory.csv): 16 registered source products,
  source links, byte sizes, file checksums, local/remote state, raster metadata,
  units, and limitations.
- [`source_manifest.csv`](source_manifest.csv): product IDs, provenance, source
  label links, and checksums.
- [`product_validation.csv`](product_validation.csv): GDAL open/read metadata
  for 15 rasters.
- [`vector_validation.csv`](vector_validation.csv): 13 FileGDB layer checks.
- [`spatial_overlap.csv`](spatial_overlap.csv): approximate footprint coverage
  against the SIM 3464 study boundary.
- [`terrain_processing.json`](terrain_processing.json): source PDS metadata,
  processing settings, statistics, and output checksums.
- [`alignment_assessment.json`](alignment_assessment.json): reproducible local
  image tie-point registration and its limits.
- [`MarsWalk_Jezero.qgz`](../projects/MarsWalk_Jezero.qgz): 24-layer QGIS
  project with relative paths.

The inventory and validation tables are reproducible checks, distinct from the
terrain-analysis outputs listed below. The included
`GIS/scripts/validate_gis.py` run opened all 15 registered raster products and
checked all 13 FileGDB layers; no invalid geometries were reported. The
overlap test is an approximate extent comparison only.

## Data inventory and provenance

The inventory contains these product groups:

| Group | Products | Source and product IDs |
|---|---:|---|
| SIM 3464 regional package | 11 | U.S. Geological Survey, [SIM 3464](https://doi.org/10.3133/sim3464): `Nili.gdb`, CTX mosaic `Nili_CTX_Mosaic_Beta01_Feb2018_MTM`, HRSC `h0988_0000.da4.53`, clipped HRSC DTM and hillshade, two CTX orthophotos, two CTX stereo DTMs, and THEMIS day/night mosaics. |
| MOLA | 2 | NASA PDS Geosciences Node, `MEGT90N000EB.IMG` (topography above the areoid) and `MEGA90N000EB.IMG` (areoid reference surface, not topography); see the exact file and label links in the inventory. |
| HiRISE | 3 | University of Arizona HiRISE PDS: `ESP_022746_1985_IRB_C_01_ORTHO`, `DTEEC_022680_1985_022746_1985_A01`, and `ESP_022680_1985_RED_A_01_ORTHO`; see the direct archive links and labels in the inventory. |

The SIM metadata cites the USGS map by Sun and Stack (2020), Scientific
Investigations Map 3464. Its geographic area is 76.8–77.8°E, 17.7–18.7°N
(approximately 60 by 60 km), at 1:75,000 publication scale. Its geodatabase
uses a local Transverse Mercator Mars 2000 Sphere CRS centered at 77.5°E with a
3,396,190 m sphere. Individual SIM-package raster files do not all include
separate original PDS labels; the SIM DOI is package-level provenance and
should not be mistaken for an acquisition-level citation.

Other verified scale and reference details:

- MOLA MEGDR is 16 pixels per degree (roughly 3.7 km/pixel at the equator),
  with a 3,396 km sphere and simple cylindrical PDS map definition. GDAL
  represents the raster in a Mars equirectangular CRS with metre coordinates.
  Topography is relative to the areoid. It is suitable for global context,
  not rover-scale route analysis.
- The MOLA areoid raster describes a reference surface; its stored values must
  not be interpreted as elevation above the areoid.
- The SIM CTX mosaic reports 5 m pixels in the raster, while the SIM metadata
  describes the primary map base as a 6 m/pixel mosaic.
- Regional rasters use differing grids and projections. The CTX stereo
  products use equirectangular Mars CRSs; the original HRSC DTM uses a
  sinusoidal Mars CRS with a 3,396,000 m sphere; the SIM study layers use their
  local Mars 2000 Sphere TM CRS.
- The HiRISE RED label records 0.2524259537 m/pixel, planetocentric
  equirectangular coordinates, 77.37089912–77.50346219°E and
  18.09654380–18.36864001°N, and `I/F = (DN * 0.0001823385631070) +
  0.0778408302886730`. Preserve this calibration metadata when interpreting
  image values.
- The HiRISE DTM label embedded in its PDS image reports approximately
  1.0097 m/pixel and a Mars 2000 equipotential vertical reference. Pixel size
  is not an accuracy estimate.
- DEM GeoTIFFs in the SIM package do not consistently declare vertical units
  or vertical reference. The inventory and validation report preserve that
  uncertainty; no terrain derivatives were calculated from them.

## Terrain products and spatial checks

The source HiRISE PDS label embedded in `DTEEC_022680_1985_022746_1985_A01.IMG`
explicitly states elevations are meters above the Mars 2000 equipotential
surface. Its Equirectangular Mars CRS uses the product local radius
3,394,839.813 m, center longitude 77.44°E, standard parallel 15°N, and 1.0097
m source pixels. The values have scale 1 and offset 0. No vertical datum
conversion was applied.

The reproducible script creates four GeoTIFFs in
`GIS/processed/hirise_terrain/`:

| Output | Resolution | Units and operation |
|---|---:|---|
| `DTEEC_022680_1985_022746_1985_A01_dem_5m.tif` | 5 m | Source DEM resampled by GDAL Warp average from 1.0097 m. |
| `DTEEC_022680_1985_022746_1985_A01_slope_deg.tif` | 5 m | GDAL slope, Horn 3x3, degrees, vertical/horizontal scale 1. |
| `DTEEC_022680_1985_022746_1985_A01_aspect_deg.tif` | 5 m | GDAL aspect, Horn, clockwise degrees from north; flat-cell aspect is NoData. |
| `DTEEC_022680_1985_022746_1985_A01_roughness_3x3_m.tif` | 5 m | GDAL Roughness, 3x3 max-minus-min elevation, metres. |

All outputs share the analysis DEM's projection and grid. Source NoData is
preserved through resampling; derivative edge computation is disabled, so the
outer edge and unsupported neighborhoods remain NoData. Outputs use tiled,
DEFLATE-compressed GeoTIFFs with floating-point prediction. Exact dimensions,
CRS, file sizes, hashes, statistics, and the parsed PDS label are in
`terrain_processing.json`.

The QGIS project uses paths relative to its file and groups the SIM 3464
geology, HiRISE terrain, imagery, and regional source DEMs. It validates with
24 readable layers in this checkout. Its HiRISE layers require downloading the
ignored source DTM and RED image using the instructions below.

### Relative registration and unresolved accuracy

The CTX mosaic and HiRISE RED orthophoto were warped to the shared HiRISE 5 m
grid and compared using 12 spatially distributed 192x192-pixel Sobel-gradient
tiles and normalized cross-correlation (minimum score 0.3). The median
apparent CTX displacement relative to HiRISE is **10 m west and 55 m south**;
the component-wise median absolute deviation is 5 m. Individual tie scores
and shifts are preserved in `alignment_assessment.json`.

This is a relative image-match estimate over one limited footprint, not an
absolute control-point or accuracy result. The source ortho is not a Mars 2020
operational control dataset. Therefore the reported **100–200 m random SIM
offset relative to later operational products remains unresolved**: it was not
found quantified in the packaged metadata, and the available local sources do
not provide the required independent operational control points. Do not use
this estimate for rover navigation or claim rover-scale accuracy.

The aligned derivative grids and all 13 SIM vector layers are tested
automatically. Raster overlap fractions remain extent-coverage checks only.

## Processing and spatial validation

Implemented:

1. `generate_inventory.py` reads registered products, records GDAL/OGR
   metadata, computes file sizes and SHA-256 checksums, and records Git
   tracking and `origin/main` availability.
2. `validate_gis.py` opens the raster set, checks FileGDB layer geometry
   validity, and transforms the SIM study boundary into each raster CRS to
   estimate how much of that boundary is covered by the raster footprint.
3. `build_terrain_products.py` verifies the embedded PDS product ID and vertical
   reference before resampling or processing. It creates the products and
   checks exact grid equality.
4. `assess_relative_alignment.py` records the tiled image registration estimate
   against the HiRISE orthophoto.
5. The GIS tests verify source metadata, output existence/units/NoData/grid
   alignment, all SIM feature geometries, the QGIS project, and the relative
   registration report.

The footprint fractions are approximate coverage checks. They do not validate
pixel-to-pixel registration, elevation agreement, positional accuracy,
vertical datum consistency, or resolution suitability. The current report
shows full or near-full coverage by the CTX mosaic, clipped HRSC rasters, and
THEMIS mosaics; partial coverage by CTX stereo scenes and the local HiRISE
products; and global coverage by MOLA. Those results are not evidence of
co-registration.

Not implemented: full-SIM-region slope/aspect/roughness coverage, DEM
vertical-datum reconciliation for SIM CTX/HRSC rasters, or absolute
Mars-2020-control-based positional-accuracy assessment. The clipped HRSC
hillshade is a USGS package source, not a MarsWalk derivative. Global MOLA
remains a context visualization, not a rover-scale terrain layer.

## Distribution and ready-to-integrate files

- The SIM 3464 package and previously tracked MOLA files are present in
  `origin/main`. Several regional rasters are tracked with Git LFS; the
  inventory reports the remote pointer state and does not guarantee that each
  developer has fetched the corresponding LFS payload.
- The HiRISE IRB orthophoto is tracked on `origin/main`.
- The HiRISE DTM (479,934,208 bytes; SHA-256
  `b88dac5862f64769a1dae0ad55271952b184f4529aa09980c13a149a0a628add`) and RED
  orthophoto (518,407,009 bytes; SHA-256
  `2fcbb2488242f28ae3b8e8d5c9afbe16850e01bc363eca1b52205df977d67b82`) are
  local-only. Download them from the [official HiRISE PDS directory](https://hirise-pds.lpl.arizona.edu/PDS/DTM/ESP/ORB_022600_022699/ESP_022680_1985_ESP_022746_1985/):
  `DTEEC_022680_1985_022746_1985_A01.IMG` and
  `ESP_022680_1985_RED_A_01_ORTHO.JP2`. Place both in `GIS/raw_data/` and
  verify the checksums above (also listed in the inventory).
- P1 PR #4 remains open and its inventory still marks the RED and IRB products
  `AVAILABLE_NOT_DOWNLOADED`; it does not list the stereo DTM. Its generic
  source URL and proposed `.tif` placement are not acquisition evidence. The
  direct `.IMG` and `.JP2` URLs above return HTTP 200; the DTM label is embedded
  in the `.IMG` (a standalone `.LBL` URL returns 404). The P2 inventory and
  source manifest use the verified product IDs, exact source URLs, checksums,
  and `GIS/raw_data/` placement. The raw files remain excluded from Git.
- NASA's [media-use guidance](https://www.nasa.gov/nasa-brand-center/images-and-media/)
  says NASA content is generally not subject to U.S. copyright and asks users
  to acknowledge the source, while warning that third-party material may have
  separate rights. The PDS3 labels identify the University of Arizona
  producer but do not state a product-specific redistribution license. Given
  that ambiguity and the combined ~998 MB size, this contribution does not
  rehost the two source files. The source archive remains authoritative; retain
  its labels and cite the HiRISE PDS/University of Arizona.
- The small generated derivatives are included as Git LFS TIFFs under the
  repository's existing `*.tif` LFS convention. Local LFS integrity does not
  prove remote LFS availability; the remote payload check must succeed after
  pushing.
- `dataset_inventory.csv`, `source_manifest.csv`, the validation CSVs, source
  label, and scripts are handoff artifacts. Their availability on the remote
  depends on publishing this feature branch; they are not yet part of `main`.
- The exact byte sizes and SHA-256 checksums for individual local files are
  listed in the inventory. The FileGDB is a directory dataset and has no
  aggregate file checksum.

## Downstream integration contract and readiness

The four files in `GIS/processed/hirise_terrain/` are single-band, `Float32`
GeoTIFFs, each 1517 x 3224 cells. They share a 5 m north-up grid (origin
easting -3955.009842 m, northing 1088362.771 m) in the source DTM's
Mars Equirectangular CRS: local sphere radius 3394839.813 m, central longitude
77.44°E, standard parallel 15°N. The product CRS is a custom Mars CRS, not a
terrestrial EPSG code. See `terrain_processing.json` for full WKT and hashes.

| File in `GIS/processed/hirise_terrain/` | Band 1 meaning | Units | NoData |
|---|---|---|---:|
| `DTEEC_022680_1985_022746_1985_A01_dem_5m.tif` | Average-resampled elevation; Mars 2000 equipotential height | m | -3.4028227e38 |
| `DTEEC_022680_1985_022746_1985_A01_slope_deg.tif` | Horn 3x3 slope | degree | -9999 |
| `DTEEC_022680_1985_022746_1985_A01_aspect_deg.tif` | Horn aspect, clockwise from north; flat cells NoData | degree | -9999 |
| `DTEEC_022680_1985_022746_1985_A01_roughness_3x3_m.tif` | 3x3 max-minus-min elevation | m | -9999 |

Use GDAL/OGR raster APIs: read band 1 and honor each band's NoData,
`GetGeoTransform()`, CRS WKT, and unit. Do not combine these rasters with SIM
DEM values unless a compatible vertical reference has been established.

| Consumer | Verified repository interface and readiness |
|---|---|
| P4 route planning | No route-planning module or terrain-consumption interface is present in reviewed `main` or the open PRs inspected. P4 can read the local GeoTIFF contract above with GDAL, but integration is **not implemented**. The DTM and RED source inputs must first be obtained into `GIS/raw_data/`; the outputs cover only their small stereo footprint. These exploratory derivatives are not validated traversability or safety scores. |
| P5 mapping | `src/App.jsx` currently displays `/mars-mola-elevation.png` in a 1000 x 500 global equirectangular view; the frontend package has no GeoTIFF or regional GIS layer reader. The regional outputs are therefore **not directly integrated**. P5 needs a raster-tile/map-layer service or a browser raster renderer, reprojection from the Mars local equirectangular CRS to the map's display CRS, NoData transparency, and explicit local extent/legend. Keep the 5 m native GeoTIFF as the authoritative analysis source. |
| Science / backend | Read the GeoTIFF metadata and this handoff for values and provenance; preserve HiRISE RED's label calibration if interpreting its digital numbers. Do not treat MOLA areoid values as elevation above the areoid. |

All consumers must preserve the limited footprint and NoData mask. Relative
CTX-to-HiRISE image registration is not absolute control; the possible
100–200 m SIM offset remains unresolved, and the products must not be used to
claim rover-scale absolute accuracy.

## Reproduce

From the repository root, with QGIS Python/GDAL and Git available:

```powershell
& "C:\Program Files\QGIS <version>\bin\python-qgis-ltr.bat" GIS\scripts\generate_inventory.py
& "C:\Program Files\QGIS <version>\bin\python-qgis-ltr.bat" GIS\scripts\validate_gis.py
& "C:\Program Files\QGIS <version>\bin\python-qgis-ltr.bat" GIS\scripts\build_terrain_products.py
& "C:\Program Files\QGIS <version>\bin\python-qgis-ltr.bat" GIS\scripts\assess_relative_alignment.py
& "C:\Program Files\QGIS <version>\bin\python-qgis-ltr.bat" -m unittest discover -s GIS\scripts -p "test_*.py"
```

The scripts do not download or alter source rasters. Validation and tests were
run using QGIS 3.44.15 / GDAL 3.13.3 in the implementation environment.
