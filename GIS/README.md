# MarsWalk GIS data and validation

This directory contains the global MOLA map renderer and local Mars raster
sources. Regional SIM 3464 data are kept under `Datasetmars/data/raw/geology/`.
The machine-generated inventory and validation results are in
[`documentation/`](documentation/).

## Build and validate the Jezero GIS package

Use QGIS 3.44.15 or compatible QGIS Python/GDAL and the repository's existing
Git LFS configuration. Run these commands from the repository root:

```powershell
& "C:\Program Files\QGIS <version>\bin\python-qgis-ltr.bat" GIS\scripts\generate_inventory.py
& "C:\Program Files\QGIS <version>\bin\python-qgis-ltr.bat" GIS\scripts\validate_gis.py
& "C:\Program Files\QGIS <version>\bin\python-qgis-ltr.bat" GIS\scripts\build_terrain_products.py
& "C:\Program Files\QGIS <version>\bin\python-qgis-ltr.bat" GIS\scripts\assess_relative_alignment.py
& "C:\Program Files\QGIS <version>\bin\python-qgis-ltr.bat" -m unittest discover -s GIS\scripts -p "test_*.py"
```

If Git is not on `PATH` and is not installed with GitHub Desktop, set
`MARSWALK_GIT_EXECUTABLE` to the full path of `git.exe`. The scripts read source
rasters and write products/reports under `GIS\processed\`,
`GIS\projects\`, and `GIS\documentation\`. The image-registration script also
requires SciPy in the QGIS Python environment.

The terrain builder requires
`GIS\raw_data\DTEEC_022680_1985_022746_1985_A01.IMG` and verifies its embedded
PDS product ID and vertical datum before processing. The alignment check also
requires `GIS\raw_data\ESP_022680_1985_RED_A_01_ORTHO.JP2`. Download both from
the [official HiRISE PDS archive](https://hirise-pds.lpl.arizona.edu/PDS/DTM/ESP/ORB_022600_022699/ESP_022680_1985_ESP_022746_1985/).
Verify SHA-256 values in [`documentation/dataset_inventory.csv`](documentation/dataset_inventory.csv).

## Scope and readiness

- The included React map uses the global MOLA topography image for context; it
  is not a regional route or terrain-safety product.
- The source bundle contains the SIM 3464 FileGDB and regional raster layers,
  MOLA topography/areoid products, and the tracked HiRISE IRB orthophoto.
- The reproducible [QGIS project](projects/MarsWalk_Jezero.qgz) includes the
  SIM 3464 geology, regional imagery, and HiRISE terrain products using
  relative paths.
- HiRISE slope, aspect, and 3x3 roughness are 5 m-grid products over the local
  stereo footprint only. Their source DTM vertical reference is verified as
  meters above the Mars 2000 equipotential surface.
- Raw HiRISE DTM and RED imagery are not rehosted due to their combined size
  (~998 MB) and the absence of an explicit product-specific redistribution
  license in the PDS labels. Download them from the authoritative PDS archive.
- Image matching estimates a relative local offset between CTX and HiRISE
  products; it does not establish absolute positional accuracy or resolve the
  possible 100-200 m displacement relative to Mars 2020 operational products.

See [`documentation/P2_HANDOFF.md`](documentation/P2_HANDOFF.md) for CRS and
units, provenance, limitations, and downstream integration guidance.
