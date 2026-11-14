# Saniya — P1/P2 dataset integration status

**Status: WAITING FOR P1/P2 DATASETS**

## Shared repository check

Checked the shared repository on 2026-11-14 after fetching `main` and after Saniya's branch push:

- `main` was at `c4c7153b7e98d898b60be8564d68f896945207e7`.
- GitHub's branch listing contained `main`, `docs/readme`, `setup/project`, and Saniya's branch; no P1/P2 branches were present.
- The only listed pull requests were the already merged README and project-setup pull requests; no P1/P2 data pull requests were present.
- `main` contains a Vite/React starter scaffold (`src/App.jsx` still renders the starter counter/logo screen), but no science provider, Mars observation datasets, or GIS layers.
- No P1/P2 data manifests, source products, PDS labels, GIS layers, or team data branches were visible.

This is the repository state at the check time; no background monitoring is running.

## Missing P1 inputs and proposed delivery paths

These paths define a proposed handoff layout for this integration. They are not an existing team contract; P1/P3 may agree to different paths before delivery.

1. **Perseverance observation manifest and original products**
   - Manifest: `data/science/p1/observations/manifest.csv`.
   - Original files and detached labels: `data/science/p1/observations/raw/<instrument>/<sol>/<product-id>.*` and the matching PDS4 `.xml` label.
   - Include all available relevant Mastcam-Z, Navcam, SuperCam, PIXL and SHERLOC products; include other instruments only when their source products and metadata are available.
   - Manifest fields needed to join into Saniya's catalogue: actual PDS LID/product ID and version, instrument, mission, sol, UTC bounds, named target, coordinates with CRS/datum and coordinate meaning (rover position vs. target/pointing), source URL, product filename, processing level, units, quality flags, and paired image/metadata references.
   - **Currently missing:** P1's actual product manifest, per-product metadata labels and files. The NASA Mastcam-Z panorama aggregate already catalogued by Saniya does not expose individual product IDs or coordinates.

2. **Complete MEDA environmental collection**
   - Product files: `data/science/p1/meda/raw/<product-id>.CSV`.
   - Paired PDS4 labels: `data/science/p1/meda/raw/<product-id>.xml`.
   - Collection inventory and applicable SIS/readme documents: `data/science/p1/meda/metadata/`.
   - Expected available sensor families: calibrated/derived air temperature (ATS), pressure (PS), relative humidity (RHS), wind (WIND), thermal infrared/surface temperature (TIRS), and radiation/dust (RDS), with product levels and quality metadata retained.
   - **Currently missing:** P1's complete or scoped MEDA collection and its inventory. Saniya's one official sol-1 derived pressure product is a small independently retrieved sample, not the P1 handoff.

## Missing P2 inputs and proposed delivery paths

These paths define a proposed handoff layout for this integration. They are not an existing team contract; P2/P3 may agree to different paths before delivery.

- Study boundary and geology/unit layer(s): `data/science/p2/jezero/geology_units.gpkg` or an equivalent GIS-native file.
- Registered raster terrain/base layer(s), if used: `data/science/p2/jezero/<layer-name>.tif` with its CRS embedded or a matching `.prj`/world file.
- Observation/target point join layer, if produced by P2: `data/science/p2/jezero/observation_locations.gpkg`.
- Required layer manifest: `data/science/p2/jezero/manifest.json`, listing each layer's filename, source, processing history, geometry/raster type, CRS authority and parameters, units, nodata/quality rules, extent, resolution and feature/record counts.
- **Currently missing:** P2's agreed Jezero study boundary, geologic map/unit layer, registered locations/coverage and CRS metadata. No GIS layers exist in the shared repository.

## Integration gate and validation required after resume

Do not join, reproject, normalize, replace or activate any incoming dataset until its source, product identifiers, provenance, format, CRS, units, coordinates, metadata and integrity have been checked against the actual files and labels. Preserve the incoming raw and demo datasets unchanged. Produce a migration/integration report showing direct joins, transformations required, incompatibilities and unresolved fields before integrating into Saniya's module.

No real-data provider has been activated or replaced and no application data mode has been changed. Request Saniya's explicit approval before either action. No shared API, database or frontend contract has been changed; P3/P4/P5 review remains required. Do not merge the Saniya PR without explicit approval.

Resume only when the user sends exactly: `P1/P2 DATASETS PUSHED — RESUME`.
