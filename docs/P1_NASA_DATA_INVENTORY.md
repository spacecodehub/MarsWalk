# P1 NASA Data Inventory

## Repository and branch
- Repository: https://github.com/spacecodehub/MarsWalk
- Branch: person1-data-acquisition
- P1 contribution commit: d3a5fa5877476c2ca1d487058a5d5a539ff29200
- Raw SIM 3464 package is available in the sibling workspace directory `..\data\raw\geology\`; it is not tracked in the P1 branch or `origin/main`.

## Verified inventory
The following SIM 3464 products were validated from sibling-workspace files, not from Git-tracked repository files:

- sim3464_database.zip
- SIM3464_metadata.xml
- Nili_CTX_Mosaic_Beta01_Feb2018_MTM.tif
- h0988_0000.da4.53.tif
- nili_h0988_0000_da4_clip.tif
- nili_h0988_0000_hillshade_clip.tif
- J03_045994_1986_XN_18N282W_6m_ORTHO.tif
- B18_016575_1978_B17_016219_1978_20m_DTM.tif
- nili_THEMIS_DayIR_Controlled_oct2018.tif
- nili_THEMIS_NightIR_Controlled_oct2018.tif
- Nili.gdb directory

## Additional acquired PDS rover product
- Image: `data/raw/rover/mastcamz/sol0466/ZL0_0466_0708309593_769ECM_N0260756ZCAM08486_1100LMJ01.IMG`
- Label: `data/raw/rover/mastcamz/sol0466/ZL0_0466_0708309593_769ECM_N0260756ZCAM08486_1100LMJ01.xml`
- Product LID: `urn:nasa:pds:mars2020_mastcamz_ops_raw:data:zl0_0466_0708309593_769ecm_n0260756zcam08486_1100lmj`
- Sol 466; 2022-06-12T12:47:07.279Z; 1648x1200x1 uint8 DN. The product label supplies no geodetic coordinates or image footprint.

## Product summary
- Source: USGS SIM 3464, https://doi.org/10.3133/sim3464
- Coverage: 76.8°–77.8°E; 17.7°–18.7°N
- CRS: Mars Transverse Mercator, Mars_2000_(Sphere)
- Units: meters; pixel scales recorded as ~6 m, 20 m, 75 m, 100 m depending on product
- Documentation: Metadata XML and ArcGIS project are present in the extracted package
- Limitation: USGS metadata records 100–200 m random positional offsets relative to later Mars 2020 surface-operation products

## Pending product categories
The following work is not present in the P1 branch checkout:
- `ESP_022680_1985_RED_A_01_ORTHO`: P2 verified the official PDS source and retains the 518,407,009-byte JP2 locally only; P2 reports SHA-256 `2fcbb2488242f28ae3b8e8d5c9afbe16850e01bc363eca1b52205df977d67b82`. It is not downloaded or independently rehashed in P1.
- `ESP_022746_1985_IRB_C_01_ORTHO`: P2 records the 19,743,927-byte JP2 and label as tracked on `origin/main` at `666e512`; they are not present in the P1 checkout. Do not download a duplicate.
- MEDA: Saniya's branch contains a verified sol-1 derived pressure sample (P02), not a complete environmental archive. Its CSV and label have not been brought into the P1 checkout.
- Perseverance observations: one sol-466 raw Mastcam-Z image is acquired and validated (details below). NASA's 1,118-frame, color-enhanced delta panorama is a published aggregate, not an individual product catalog; no image-to-panorama relation or geodetic coordinates are claimed. Further observation products remain pending.
- Additional CTX source products beyond the already included SIM 3464 package
- RIMFAX is optional under the original P1 prompt (only if an actual Jezero-relevant product is verified); no product was selected or acquired.

The P2 source details, label locations, file sizes and reference checksums are recorded in [P1_TEAM_HANDOFF.md](P1_TEAM_HANDOFF.md). P2 reports that no product-specific redistribution license was located for its local-only HiRISE RED and DTM originals; do not rehost them without an approved storage/licensing decision.

Five other HiRISE files were found outside this repository under `Datasetmars/data/raw/hirise/`; none is either requested product. Their names identify `ESP_025436_1990_RED.QLOOK`, `DTEEC_048842_1985_048908_1985_U01`, `ESP_048842_1985_RED_C_01_ORTHO`, and `ESP_048908_1985_RED_C_01_ORTHO`. The available label confirms `ESP_025436_1990_RED`; these files are not treated as P1 acquisitions or copied into the repo.

## File locations
- Source archive: `..\data\raw\geology\sim3464_database.zip` (outside repository; local workspace only)
- Extracted package: `..\data\raw\geology\extracted\sim3464_database\sim3464_JezeroNili_FINAL\` (outside repository; local workspace only)
- Metadata: `..\data\raw\geology\extracted\sim3464_database\sim3464_JezeroNili_FINAL\Metadata\SIM3464_metadata.xml`
- Manifest: data/metadata/dataset_inventory.csv
- Validation manifest: data/metadata/product_validation.csv

The P1 manifest paths use `../data/raw/...` to resolve this sibling workspace data. A fresh clone will not have the raw package unless it is distributed separately.

## Status
- SIM 3464 products: 10 locally validated in the sibling workspace, not tracked in Git.
- Rover products: one Mastcam-Z PDS image and label acquired and tracked in this P1 branch.
- Pending HiRISE: RED is P2-local only; IRB is tracked on origin/main but not in this P1 checkout. No duplicate acquired.
- No large scientific downloads were committed without a confirmed storage plan.
