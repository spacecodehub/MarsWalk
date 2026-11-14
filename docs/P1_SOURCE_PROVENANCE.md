# P1 Source Provenance

## Verified source dataset
The primary source package is the USGS SIM 3464 release for the Jezero/Nili geologic map.

- DOI: https://doi.org/10.3133/sim3464
- USGS index: https://pubs.usgs.gov/sim/3464/
- Metadata URL: https://pubs.usgs.gov/sim/3464/sim3464_metadata.txt
- Readme URL: https://pubs.usgs.gov/sim/3464/sim3464_readme.txt

## Local package provenance
The repository contains the extracted package at:

- data/raw/geology/extracted/sim3464_database/sim3464_JezeroNili_FINAL/

The metadata file confirms the ownership and citation:

- Author(s): Vivian Z. Sun and Kathryn M. Stack
- Year: 2020
- Series: U.S. Geological Survey Scientific Investigations Map 3464
- Title: Geologic map of Jezero crater and the Nili Planum region, Mars

## Spatial provenance
- Longitude: 76.8°E to 77.8°E
- Latitude: 17.7°N to 18.7°N
- Projection: Mars Transverse Mercator
- Geodetic reference: Mars_2000_(Sphere)
- Primary basis map: MRO CTX mosaic at approximately 6 m/pixel

## Limitation recorded in source metadata
The USGS readme states that this map was produced on a semi-controlled CTX mosaic and may carry random geolocation offsets of roughly 100–200 m relative to later Mars 2020 operational products. This uncertainty must be preserved in every downstream handoff.

## Pending provenance work
The following product families have no verified local files in this repo and therefore remain pending provenance records rather than verified dataset handoffs:

- HiRISE: ESP_022680_1985_RED_A_01_ORTHO and ESP_022746_1985_IRB_C_01_ORTHO
- MEDA environmental archive
- Mars 2020 rover image archives
- RIMFAX archive

These remain documented as `AVAILABLE_NOT_DOWNLOADED` or `PENDING_DISTRIBUTION` in the manifest files, not as verified source products.
