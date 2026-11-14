# MarsWalk P2 GIS handoff

## Executive status

**GIS source inventory and read-only validation are implemented; regional terrain
analysis is not.** The reports describe data available in this checkout and
whether source paths are tracked on `origin/main`. They do not imply that
every developer has fetched Git LFS payloads or has access to local-only files.

Generated evidence:

- [`dataset_inventory.csv`](dataset_inventory.csv): 16 registered products,
  source links, byte sizes, file checksums, local/remote state, raster metadata,
  units, and limitations.
- [`source_manifest.csv`](source_manifest.csv): product IDs, provenance, source
  label links, and checksums.
- [`product_validation.csv`](product_validation.csv): GDAL open/read metadata
  for 15 rasters.
- [`vector_validation.csv`](vector_validation.csv): 13 FileGDB layer checks.
- [`spatial_overlap.csv`](spatial_overlap.csv): approximate footprint coverage
  against the SIM 3464 study boundary.

These are reproducible read-only checks, not terrain-analysis outputs. The
included `GIS/scripts/validate_gis.py` run opened all 15 registered raster
products and checked all 13 FileGDB layers; no invalid geometries were reported.
The overlap test is an approximate extent comparison only.

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

The project brief warns of possible 100–200 m random offsets in SIM 3464
relative to later Mars 2020 operational products. This audit did not locate
that quantitative statement in the packaged SIM metadata and did not measure
the offset. Treat it as an unverified warning that must be checked against an
authoritative rover operational reference before local navigation or
high-precision integration.

## Processing and spatial validation

Implemented:

1. `generate_inventory.py` reads registered products, records GDAL/OGR
   metadata, computes file sizes and SHA-256 checksums, and records Git
   tracking and `origin/main` availability.
2. `validate_gis.py` opens the raster set, checks FileGDB layer geometry
   validity, and transforms the SIM study boundary into each raster CRS to
   estimate how much of that boundary is covered by the raster footprint.
3. `test_gis_common.py` checks north-up and rotated affine raster corner
   calculations.

The footprint fractions are approximate coverage checks. They do not validate
pixel-to-pixel registration, elevation agreement, positional accuracy,
vertical datum consistency, or resolution suitability. The current report
shows full or near-full coverage by the CTX mosaic, clipped HRSC rasters, and
THEMIS mosaics; partial coverage by CTX stereo scenes and the local HiRISE
products; and global coverage by MOLA. Those results are not evidence of
co-registration.

Not implemented: a QGIS project; regional DEM reprojection/resampling;
NoData-normalized analysis surfaces; slope, aspect, roughness, or new hillshade
outputs; vertical-datum reconciliation; or independent positional-accuracy
assessment. The clipped HRSC hillshade is already present in the USGS package
and is not an output generated by the MarsWalk scripts. The global MOLA PNG
used by the web map is a visualization asset, not a local terrain-analysis
layer.

## Distribution and ready-to-integrate files

- The SIM 3464 package and previously tracked MOLA files are present in
  `origin/main`. Several regional rasters are tracked with Git LFS; the
  inventory reports the remote pointer state and does not guarantee that each
  developer has fetched the corresponding LFS payload.
- The HiRISE IRB orthophoto is tracked on `origin/main`.
- The HiRISE DTM and RED orthophoto are present only in this machine's ignored
  `GIS/raw_data/` directory. They are intentionally not included as ordinary
  Git files because of their large sizes. The RED PDS label is included with
  this handoff. Downstream users must obtain the imagery/DTM from the
  authoritative archive or arrange an approved large-file distribution path.
- `dataset_inventory.csv`, `source_manifest.csv`, the validation CSVs, source
  label, and scripts are handoff artifacts. Their availability on the remote
  depends on publishing this feature branch; they are not yet part of `main`.
- The exact byte sizes and SHA-256 checksums for individual local files are
  listed in the inventory. The FileGDB is a directory dataset and has no
  aggregate file checksum.

## Downstream integration

| Consumer | Use now | Do not assume |
|---|---|---|
| P3 backend | Read SIM 3464 FileGDB and published GeoTIFF/IMG/JP2 source layers with GDAL/OGR; use the manifest and inventory for provenance, CRS, units, and Git/LFS status. | Do not assume every LFS payload is fetched, or that ignored HiRISE products are available remotely. |
| P4 AI / terrain risk | Use source imagery and DEMs only after checking their labels, vertical references, resolution, coverage, and registration for the intended model. | No prepared slope/aspect/roughness or validated risk surface is supplied; do not treat pixel spacing or footprint overlap as accuracy. |
| P5 frontend | Use the checked-in global MOLA map assets for global context. | MOLA does not support local route safety; regional overlays need a common, verified map CRS and explicit scale/NoData handling. |
| Science integration | Cite SIM 3464 and the original PDS product/label URLs; keep MOLA topography distinct from the areoid and retain the HiRISE RED DN-to-I/F calibration. | Do not present uncertain DEM vertical references or the unverified 100–200 m offset as resolved facts. |

## Reproduce

From the repository root, with QGIS Python/GDAL and Git available:

```powershell
& "C:\Program Files\QGIS <version>\bin\python-qgis-ltr.bat" GIS\scripts\generate_inventory.py
& "C:\Program Files\QGIS <version>\bin\python-qgis-ltr.bat" GIS\scripts\validate_gis.py
python -m unittest discover -s GIS\scripts -p "test_*.py"
```

The scripts do not download data, alter source rasters, or produce terrain
derivatives. Validation was run using QGIS 3.44.15 / GDAL 3.13.3 in the
implementation environment.
