# P1 Team Handoff

## P2 (GIS processing)
Hand off the verified SIM 3464 geologic map package and the relevant product metadata in the following folder:

- data/raw/geology/extracted/sim3464_database/sim3464_JezeroNili_FINAL/

Relevant details:
- CRS: Mars Transverse Mercator, Mars_2000_(Sphere)
- Coverage: 76.8°–77.8°E; 17.7°–18.7°N
- Base package includes CTX, HRSC, CTX stereo DTM/orthophotos, THEMIS mosaics, geodatabase, and symbology
- Known limitation: documented 100–200 m position offsets relative to later Mars 2020 operational product sets

## Saniya (science intelligence)
Current verified source package is geology-focused and appropriate as a spatial framework for Jezero science context. Missing product categories still need explicit coordination before doing science-target cataloging:

- HiRISE references: P2 PR #5 is open at head `335412b`; source URLs and placement first appeared in commit `70d661c`. `ESP_022746_1985_IRB_C_01_ORTHO.JP2` plus label are tracked on `origin/main` at `666e512`; `ESP_022680_1985_RED_A_01_ORTHO.JP2` and paired `DTEEC_022680_1985_022746_1985_A01.IMG` are P2-local only. Do not download duplicates. See [P1_SOURCE_PROVENANCE.md](P1_SOURCE_PROVENANCE.md) for official URLs, P2-reported checksums, caveats, and placement.
- MEDA sample already on Saniya's branch: sol-1 derived pressure product `urn:nasa:pds:mars2020_meda:data_derived_env:we__0001___________der_ps__________________p`; CSV and detached XML label are under `data/science/meda/raw/`. This is not a complete environmental archive and is not in this P1 checkout.
- Rover imagery: NASA's 1,118-frame Mastcam-Z delta panorama is an aggregate reference only; individual PDS product IDs and coordinates are not supplied by that page. P1 acquired one separate PDS sol-466 Mastcam-Z image (next bullet); it has no geodetic coordinates/CRS and is not asserted to be in the panorama.
- P1 rover sample: `data/raw/rover/mastcamz/sol0466/ZL0_0466_0708309593_769ECM_N0260756ZCAM08486_1100LMJ01.IMG` plus `.xml` label. Use its PDS LID, timestamp, 1648x1200x1 uint8 DN layout, SHA-256 and no-geolocation limitation from the manifests. This is available for science context, not a registered GIS layer or route-safety input.
- RIMFAX is optional unless a Jezero-relevant original product is verified against the project scope.

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
Use the verified GIS package and metadata records for map display context. Continue to rely on the SIM 3464 source package for the base Jezero/Nili spatial context until the missing product families are downloaded and validated.
SIM 3464 rasters are outside Git in this workspace; a clean clone needs the separate data distribution. P2's GIS handoff describes regional raster placement and display constraints; no P1 raster renderer or app integration is claimed.

## Distribution note
No large scientific files were committed without a confirmed storage strategy. The verified SIM 3464 raw package is available in the sibling workspace folder `..\data\raw\geology\`, not in the repository or remote branch. The P1 manifests and docs and the small PDS rover image are in this branch; a clean clone needs the SIM package distributed separately. HiRISE/MEDA items remain status-labeled in the manifests and are not represented as P1-local acquisitions.

## Current coordination state (checked 2026-11-14)
- P2 PR #5 is open at head `335412b`; its handoff documents `GIS/raw_data/` placement. The RED/DTM originals are not rehosted because P2 found no product-specific redistribution license and they total about 998 MB. The IRB image/label are already on `origin/main`; consume those after base integration rather than downloading another copy.
- The P2-reported SHA-256 values in the P1 manifests are provenance references only; P1 did not retrieve those payloads and did not independently verify them.
- Saniya's remote branch contains a verified PDS MEDA pressure sample; P1 references it but does not copy or claim it as P1-local.
- The five local HiRISE files under the sibling `Datasetmars/data/raw/hirise/` directory are different products (ESP_025436_1990_RED, DTEEC_048842_1985_048908_1985_U01, ESP_048842_1985_RED_C_01_ORTHO, ESP_048908_1985_RED_C_01_ORTHO). They are outside this repository and were not copied or treated as the requested products.
- No P4/P6 deliverables were modified. The SIM positional uncertainty remains 100–200 m relative to later Mars 2020 operational products.
