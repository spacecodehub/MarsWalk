# P1 NASA Data Inventory

## Repository and branch
- Repository: https://github.com/spacecodehub/MarsWalk
- Branch: person1-data-acquisition
- Initial P1 metadata commit: d3a5fa5877476c2ca1d487058a5d5a539ff29200
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
The source requirements call for relevant MEDA and rover observation products but do not define a sol range, time window, target list, or mission-wide archive requirement. The original prompt artifact was not present as a separate repository file; this status uses the requirements supplied in the task conversation and the P1 handoff.

- **HiRISE IRB — VERIFIED EXTERNAL / MAIN-ONLY:** `ESP_022746_1985_IRB_C_01_ORTHO.JP2` and its label are tracked on `origin/main` at `666e512`; they are absent from this P1 branch checkout. Do not duplicate them.
- **HiRISE RED — UNRESOLVED / P2-LOCAL-ONLY:** `ESP_022680_1985_RED_A_01_ORTHO.JP2` is held in P2's workspace. P2 reports 518,407,009 bytes and SHA-256 `2fcbb2488242f28ae3b8e8d5c9afbe16850e01bc363eca1b52205df977d67b82`; P1 cannot access or independently verify that payload. P2 found no product-specific redistribution permission, so it was not copied or rehosted.
- **P2 stereo DTM — VERIFIED EXTERNAL / P2-LOCAL-ONLY:** `DTEEC_022680_1985_022746_1985_A01.IMG` is also held by P2, not in Git. Its reported checksum and size are not P1-verified; do not duplicate or rehost without permission.
- **MEDA — UNRESOLVED beyond sample:** Saniya's branch has the sol-1 derived pressure sample (P02), not the complete MEDA archive. This is a useful external reference, not a time- or location-matched environmental series. The requirements do not specify the sols/time interval needed to select additional observations, so no broader archive was acquired.
- **Rover observations — one product COMPLETE; broader set UNRESOLVED:** the sol-466 Mastcam-Z raw image is acquired and validated (details above). It has no geodetic location or footprint and is not asserted to be part of NASA's 1,118-frame panorama. No required additional product IDs or observation window are specified.
- **Additional CTX — NOT REQUIRED on current scope:** the sibling SIM 3464 package already includes a regional CTX mosaic, stereo orthophoto, and stereo DTM; no additional scene or coverage gap is identified in the supplied requirements.
- **RIMFAX — NOT REQUIRED:** the supplied P1 scope makes it conditional; no requirement to acquire a RIMFAX product was identified.

The P2 source details, label locations, file sizes and reference checksums are recorded in [P1_TEAM_HANDOFF.md](P1_TEAM_HANDOFF.md). P2 reports that no product-specific redistribution license was located for its local-only HiRISE RED and DTM originals; do not rehost them without an approved storage/licensing decision.

Five other HiRISE files were found outside this repository under `Datasetmars/data/raw/hirise/`; none is either requested product. Their names identify `ESP_025436_1990_RED.QLOOK`, `DTEEC_048842_1985_048908_1985_U01`, `ESP_048842_1985_RED_C_01_ORTHO`, and `ESP_048908_1985_RED_C_01_ORTHO`. The available label confirms `ESP_025436_1990_RED`; these files are not treated as P1 acquisitions or copied into the repo.

## File locations
- Source archive: `..\data\raw\geology\sim3464_database.zip` (outside repository; local workspace only)
- Extracted package: `..\data\raw\geology\extracted\sim3464_database\sim3464_JezeroNili_FINAL\` (outside repository; local workspace only)
- Metadata: `..\data\raw\geology\extracted\sim3464_database\sim3464_JezeroNili_FINAL\Metadata\SIM3464_metadata.xml`
- Manifest: data/metadata/dataset_inventory.csv
- Validation manifest: data/metadata/product_validation.csv

The P1 manifest paths use `../data/raw/...` to resolve this sibling workspace data. A fresh clone can obtain it from the official USGS archive by following the reproducible steps in [P1_SOURCE_PROVENANCE.md](P1_SOURCE_PROVENANCE.md).

## Status
- SIM 3464 products: 10 locally validated in the sibling workspace, not tracked in Git.
- Rover products: one Mastcam-Z PDS image and label acquired and tracked in this P1 branch.
- HiRISE: IRB is tracked on `origin/main`; RED and the stereo DTM remain P2-local. P1 did not independently verify their payload hashes or acquire duplicates.
- MEDA: one external sol-1 pressure sample is referenced; a project-period environmental series is unresolved because no sol/time window is specified.
- No large scientific downloads were committed without a confirmed storage plan.
