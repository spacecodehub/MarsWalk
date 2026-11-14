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

- HiRISE source products: ESP_022680_1985_RED_A_01_ORTHO, ESP_022746_1985_IRB_C_01_ORTHO
- MEDA environmental archive
- Mars 2020 rover observations
- RIMFAX archives if available and in-scope

## P3 (backend)
Use the manifests in:

- data/metadata/dataset_inventory.csv
- data/metadata/source_manifest.csv
- data/metadata/product_validation.csv

These provide stable identifiers, file paths, and provenance for the verified current dataset inventory.

## P4 (AI/risk analysis)
Use the validated product inventory and documented limitations as the input baseline. Do not treat the geologic package as rover-scale positional accuracy or as complete environmental coverage.

## P5 (frontend)
Use the verified GIS package and metadata records for map display context. Continue to rely on the SIM 3464 source package for the base Jezero/Nili spatial context until the missing product families are downloaded and validated.

## Distribution note
No large scientific files were committed without a confirmed storage strategy. The currently verified product package is stored in the working repository and is ready for the local team to use, while the missing HiRISE/MEDA/rover families remain recorded as pending rather than claimed as available.
