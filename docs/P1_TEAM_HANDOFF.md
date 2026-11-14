# P1 Team Handoff

## P2 (GIS processing)
Use the Git-tracked SIM 3464 map package and relevant product metadata:

- `Datasetmars/data/raw/geology/extracted/sim3464_database/sim3464_JezeroNili_FINAL/`
- The original ZIP is external/local-only at `..\data\raw\geology\sim3464_database.zip`; it is not required for the tracked raster/geodatabase products.

Relevant details:
- CRS: product-specific. The geodatabase and selected regional products use Mars Transverse Mercator; the source HRSC DTM is Sinusoidal; CTX stereo products are Equirectangular. See individual inventory rows for parameters.
- Map/vector coverage: 76.8°–77.8°E; 17.7°–18.7°N. Some raster footprints extend beyond this boundary; each raster extent is recorded in the inventory.
- Base package includes ten CTX/HRSC/THEMIS rasters, a geodatabase, metadata, and symbology; DTM units/vertical references are not inferred where source metadata is silent.
- Known limitation: documented 100–200 m position offsets relative to later Mars 2020 operational product sets

## Saniya (science intelligence)
Current verified source package is geology-focused and appropriate as a spatial framework for Jezero science context. Missing product categories still need explicit coordination before doing science-target cataloging:

- HiRISE references: P2 PR #5 is open at head `335412b`; source URLs and placement first appeared in commit `70d661c`. `ESP_022746_1985_IRB_C_01_ORTHO.JP2` plus label are tracked on `main` at `666e512` and independently verified in this branch. `ESP_022680_1985_RED_A_01_ORTHO.JP2` and paired `DTEEC_022680_1985_022746_1985_A01.IMG` remain P2-local only. Do not download duplicates. See [P1_SOURCE_PROVENANCE.md](P1_SOURCE_PROVENANCE.md) for official URLs, P2-reported checksums, caveats, and placement.
- MEDA sample on Saniya's current branch (`3d1d27c`): sol-1 derived pressure product `urn:nasa:pds:mars2020_meda:data_derived_env:we__0001___________der_ps__________________p`; P1 verified the CSV SHA-256 and the label-reported MD5. CSV and detached XML label remain external under `data/science/meda/raw/`, not copied into P1. This is not a complete environmental archive.
- Rover imagery: NASA's 1,118-frame Mastcam-Z delta panorama is an aggregate reference only; individual PDS product IDs and coordinates are not supplied by that page. P1 acquired one separate PDS sol-466 Mastcam-Z image (next bullet); it has no geodetic coordinates/CRS and is not asserted to be in the panorama.
- P1 rover sample: `data/raw/rover/mastcamz/sol0466/ZL0_0466_0708309593_769ECM_N0260756ZCAM08486_1100LMJ01.IMG` plus `.xml` label. Use its PDS LID, timestamp, 1648x1200x1 uint8 DN layout, SHA-256 and no-geolocation limitation from the manifests. This is available for science context, not a registered GIS layer or route-safety input.
- RIMFAX is optional unless a Jezero-relevant original product is verified against the project scope.
- The supplied requirements define no MEDA sol/time interval or additional rover product IDs. Do not treat the sol-1 sample as a complete, route-matched environmental series; select more observations only after P4/P6 specifies the science window. SIM 3464 already contains the regional CTX mosaic and stereo products, so no additional CTX scene is currently identified as necessary.

## P3 (backend)
Use the manifests in:

- data/metadata/dataset_inventory.csv
- data/metadata/source_manifest.csv
- data/metadata/product_validation.csv

These provide stable identifiers, file paths, and provenance for the verified current dataset inventory.

## P4 (AI/risk analysis)
Use the validated product inventory and documented limitations as the input baseline. Do not treat the geologic package as rover-scale positional accuracy or as complete environmental coverage.
Do not use the Mastcam-Z raw frame for geospatial risk or navigation because it has no geodetic position or footprint. P2's 5 m terrain derivative contract and limits are in PR #5's `GIS/documentation/P2_HANDOFF.md`; those layers remain on P2's branch until integrated. P4 development need not wait for optional HiRISE or RIMFAX acquisition.

## P5 (frontend)
Use the Git-tracked GIS package and metadata records for map display context. Continue to rely on the SIM 3464 package for the base Jezero/Nili spatial context; additional source families are not required for current map display.
The SIM 3464 rasters are Git-LFS tracked; a clean clone needs Git LFS enabled. The original source ZIP remains external and is optional for validating the extracted files. P2's GIS handoff describes regional raster placement and display constraints; no P1 raster renderer or app integration is claimed.

## Distribution note
P1 did not add large science files in this follow-up. The extracted SIM 3464 rasters, geodatabase and HiRISE IRB product were inherited from `main` when synchronizing this branch. The original SIM archive remains in the sibling workspace, not Git. Mastcam-Z sol-466 and its label are P1-tracked. HiRISE RED/DTM and the MEDA sample remain explicitly identified as P2/Saniya external references, not P1-local acquisitions.

## Current coordination state (checked 2026-11-14)
- P2 PR #5 is open at head `335412b`; its handoff documents `GIS/raw_data/` placement. The RED/DTM originals are not rehosted because P2 found no product-specific redistribution license and they total about 998 MB. The IRB image/label were already tracked on `main`, merged into this branch, and independently verified by P1; no duplicate download was made.
- The P2-reported SHA-256 values in the P1 manifests are provenance references only; P1 did not retrieve those payloads and did not independently verify them.
- Saniya's remote branch contains a P1-verified PDS MEDA pressure sample; P1 references it as external and does not copy or claim it as P1-local.
- The five local HiRISE files under the sibling `Datasetmars/data/raw/hirise/` directory are different products (ESP_025436_1990_RED, DTEEC_048842_1985_048908_1985_U01, ESP_048842_1985_RED_C_01_ORTHO, ESP_048908_1985_RED_C_01_ORTHO). They are outside this repository and were not copied or treated as the requested products.
- No P4/P6 deliverables were modified. The SIM positional uncertainty remains 100–200 m relative to later Mars 2020 operational products.
