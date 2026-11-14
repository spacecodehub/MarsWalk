# P1 NASA Data Inventory

## Repository and branch
- Repository: https://github.com/spacecodehub/MarsWalk
- Branch: person1-data-acquisition
- Initial P1 metadata commit: d3a5fa5877476c2ca1d487058a5d5a539ff29200
- The original SIM 3464 ZIP remains in the sibling workspace at `..\data\raw\geology\sim3464_database.zip` and is not Git-tracked.
- The extracted SIM 3464 package is tracked on `main` under `Datasetmars/data/raw/geology/extracted/sim3464_database/sim3464_JezeroNili_FINAL/`. The map rasters and geodatabase are present in this branch after merging `main`; P1 did not add a duplicate data package.

## Verified inventory
The SIM 3464 inventory has distinct repository and workspace copies:

- Ten raster products and `Nili.gdb` are Git-tracked under the extracted package path above. Their raster and geodatabase payloads match the sibling-workspace copies; the P1 manifest paths point to the tracked files.
- The original ZIP and a separately validated `SIM3464_metadata.xml` copy remain in the sibling workspace. Their SHA-256 values are recorded as `VERIFIED_EXTERNAL`; the ZIP is not required to validate the extracted products already in Git.
- The Git-tracked package contains 151 files. Compared with the sibling extraction, 140 files are byte-identical and the remaining 11 text metadata/sidecar files differ only by LF/CRLF line endings. Contributor-specific ArcGIS lock files and `.DS_Store` from the sibling workspace are not committed.
- Git LFS is required to materialize the tracked raster payloads in a fresh clone.

## Additional acquired PDS rover product
- Image: `data/raw/rover/mastcamz/sol0466/ZL0_0466_0708309593_769ECM_N0260756ZCAM08486_1100LMJ01.IMG`
- Label: `data/raw/rover/mastcamz/sol0466/ZL0_0466_0708309593_769ECM_N0260756ZCAM08486_1100LMJ01.xml`
- Product LID: `urn:nasa:pds:mars2020_mastcamz_ops_raw:data:zl0_0466_0708309593_769ecm_n0260756zcam08486_1100lmj`
- Sol 466; 2022-06-12T12:47:07.279Z; 1648x1200x1 uint8 DN. The product label supplies no geodetic coordinates or image footprint.

## Product summary
- Source: USGS SIM 3464, https://doi.org/10.3133/sim3464
- Geologic map/vector coverage: 76.8°–77.8°E; 17.7°–18.7°N. Raster footprints vary; the inventory records bounding extents derived from each GeoTIFF.
- CRS: the vector geodatabase and selected regional rasters use Mars Transverse Mercator; the source HRSC DTM is Sinusoidal; CTX stereo products are Equirectangular. Exact central meridians, radii, and extents are product-specific in the inventory.
- Units: product-specific. Imagery, THEMIS, and hillshade values are DN/brightness; DTM units and vertical references are explicitly marked unknown where not stated by source metadata.
- Documentation: Metadata XML and ArcGIS project are present in the extracted package
- Limitation: USGS metadata records 100–200 m random positional offsets relative to later Mars 2020 surface-operation products

## Pending product categories
The source requirements call for relevant MEDA and rover observation products but do not define a sol range, time window, target list, or mission-wide archive requirement. The original prompt artifact was not present as a separate repository file; this status uses the requirements supplied in the task conversation and the P1 handoff.

- **HiRISE IRB — VERIFIED / GIT-TRACKED:** `ESP_022746_1985_IRB_C_01_ORTHO.JP2` and its PDS3 label are tracked on `main` at `666e512` and present in this branch after merge. P1 independently verified the product ID, label metadata, raster readability, dimensions, resolution, size and image SHA-256. No duplicate was downloaded.
- **HiRISE RED — UNRESOLVED / P2-LOCAL-ONLY:** `ESP_022680_1985_RED_A_01_ORTHO.JP2` is held in P2's workspace. P2 reports 518,407,009 bytes and SHA-256 `2fcbb2488242f28ae3b8e8d5c9afbe16850e01bc363eca1b52205df977d67b82`; P1 cannot access or independently verify that payload. P2 found no product-specific redistribution permission, so it was not copied or rehosted.
- **P2 stereo DTM — VERIFIED EXTERNAL / P2-LOCAL-ONLY:** `DTEEC_022680_1985_022746_1985_A01.IMG` is also held by P2, not in Git. Its reported checksum and size are not P1-verified; do not duplicate or rehost without permission.
- **MEDA — VERIFIED EXTERNAL SAMPLE; FULL ARCHIVE UNRESOLVED:** Saniya's current branch has the sol-1 derived pressure sample (P02). P1 verified its product ID, CSV size/SHA-256, and the PDS label's MD5 and timing. It is not in this branch and is not the complete MEDA archive or a time-/location-matched environmental series. The requirements do not specify the sols/time interval needed to select additional observations, so no broader archive was acquired.
- **Rover observations — one product COMPLETE; broader set UNRESOLVED:** the sol-466 Mastcam-Z raw image is acquired and validated (details above). It has no geodetic location or footprint and is not asserted to be part of NASA's 1,118-frame panorama. No required additional product IDs or observation window are specified.
- **Additional CTX — OPTIONAL / ALREADY TRACKED:** `B17_016219_1978_XN_17N282W_6m_ORTHO` and `J03_045994_1986_J03_046060_1986_20m_DTM` are optional SIM 3464 companion products; both are already tracked and validated. No additional scene acquisition is required by the supplied scope.
- **RIMFAX — NOT REQUIRED:** the supplied P1 scope makes it conditional; no requirement to acquire a RIMFAX product was identified.

The P2 source details, label locations, file sizes and reference checksums are recorded in [P1_TEAM_HANDOFF.md](P1_TEAM_HANDOFF.md). P2 reports that no product-specific redistribution license was located for its local-only HiRISE RED and DTM originals; do not rehost them without an approved storage/licensing decision.

Five other HiRISE files were found outside this repository under `Datasetmars/data/raw/hirise/`; none is either requested product. Their names identify `ESP_025436_1990_RED.QLOOK`, `DTEEC_048842_1985_048908_1985_U01`, `ESP_048842_1985_RED_C_01_ORTHO`, and `ESP_048908_1985_RED_C_01_ORTHO`. The available label confirms `ESP_025436_1990_RED`; these files are not treated as P1 acquisitions or copied into the repo.

## File locations
- Source archive: `..\data\raw\geology\sim3464_database.zip` (outside repository; local workspace only)
- Git-tracked extracted rasters and geodatabase: `Datasetmars/data/raw/geology/extracted/sim3464_database/sim3464_JezeroNili_FINAL/`
- External metadata copy: `..\data\raw\geology\extracted\sim3464_database\sim3464_JezeroNili_FINAL\Metadata\SIM3464_metadata.xml` (hash validated; equivalent text is tracked with checkout line endings)
- Manifest: data/metadata/dataset_inventory.csv
- Validation manifest: data/metadata/product_validation.csv

The P1 manifest paths use repository-relative paths for Git-tracked map products and `../data/raw/...` only for the external ZIP and its separately hashed metadata copy. The validator permits those `VERIFIED_EXTERNAL` files to be absent in a fresh clone; follow [P1_SOURCE_PROVENANCE.md](P1_SOURCE_PROVENANCE.md) to retrieve and revalidate the ZIP if needed.

## Status
- SIM 3464 products: ten raster products and the geodatabase are tracked and validated in Git; the original ZIP and a separately hashed metadata copy are verified external/local-only.
- Rover products: one Mastcam-Z PDS image and label acquired and tracked in this P1 branch.
- HiRISE: IRB is tracked and independently validated in this branch; RED and the stereo DTM remain P2-local. P1 did not independently verify their payload hashes or acquire duplicates.
- MEDA: one external sol-1 pressure sample is referenced; a project-period environmental series is unresolved because no sol/time window is specified.
- P1 did not add large map files in this follow-up; the existing main-branch GIS products are stored with Git LFS.
