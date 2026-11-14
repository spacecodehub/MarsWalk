# P1 Data Validation Report

## Validation scope

The P1 validator checks the three CSV manifests and files reachable from this checkout. The extracted SIM 3464 rasters and geodatabase are Git-tracked under `Datasetmars/data/raw/geology/extracted/...` (rasters use Git LFS). The source ZIP and separately hashed metadata copy are external sibling-workspace files with `VERIFIED_EXTERNAL` status: if present, the validator verifies their checksums and sizes; if absent in a clean clone, validation proceeds against the tracked extracted products. [P1_SOURCE_PROVENANCE.md](P1_SOURCE_PROVENANCE.md) documents Git LFS setup and optional retrieval of the official ZIP.

The sol-466 Mastcam-Z PDS image and detached XML label are tracked in this P1 branch and validated locally. P2's HiRISE payloads and Saniya's MEDA sample are external references, not P1-local files; their reported checksums are not treated as P1 validation.

## Product validation results

- Ten SIM 3464 rasters are Git-LFS tracked; their file sizes and SHA-256 values match the sibling-workspace package. Rasterio opened all ten and confirmed their product-specific CRSs, dimensions, and pixel scales. GDAL 3.12.4 via Pyogrio opened 13 `Nili.gdb` layers and read three `GeoUnits_v1` features; the feature layers report Mars Transverse Mercator on Mars_2000_(Sphere). The raw ZIP (349,336,873 bytes; SHA-256 `A88BD53A5573743CC4A20036C10E585106D08A433AD2F34AF269E9CEA1529F87`) and sibling metadata XML (20,351 bytes; SHA-256 `5F686FBCF1D0D90E0D106BFAFEA28F950095B7564E580A85119D46B29842F078`) are verified external copies, not Git-tracked.
- Mastcam-Z sol-466 image: 2,022,096 bytes; SHA-256 `6C679BD74D17C0748D510474C0D0ED88563589BB5DA79E06EBB9961D6F639871`.
- Mastcam-Z XML label: 79,543 bytes; SHA-256 `87547EC0E4475A01FA31FE3141CB65469DF63276BA3866530958EDF1E36DFB20`.
- The PDS label confirms the Mastcam-Z Left product LID, sol 466, timestamp 2022-06-12T12:47:07.279Z, raw science imaging, and one 1648x1200 UnsignedByte array in DN. Rasterio opened the image as one uint8 band with no CRS, consistent with the label; this is expected for an unreferenced rover-frame image.
- HiRISE IRB is tracked in this branch; P1 independently verified its JP2 size (19,743,927 bytes), SHA-256 (`FDFB9618C18240CAA1718081B3E06246400373B942DD9BCCA5F43215AE03EE80`), PDS product identity, readability, 7514x15967x3 dimensions, CRS, and 1.0097038146737 m/pixel resolution. The PDS3 label is 5,485 bytes with SHA-256 `9BCA377B5133065CE160F6676E17B3D43AABB6BE7A281A23360A354EF328BBCA`.
- HiRISE RED and stereo DTM hashes/sizes are P2-reported only. P1 did not access or recompute them.
- The MEDA sol-1 sample is on Saniya's current branch (`3d1d27c`), not in P1. P1 independently computed the CSV SHA-256 (`600D8D11B26B2127BA66F90889E7BA5621A0B8B788146BF5BF72A02BE2E0A16C`, 125,877 bytes) and confirmed the PDS XML label's MD5 (`ec537dbac49f78beb648de1d12ec7333`) and product LID. The detached label is 9,326 bytes with SHA-256 `BF91828374F61D9267BAF2F35B2784E50FFD44EA4B3559E023295FF075068C91`. It remains an external single-sample reference, not a complete environmental archive.

## Manifest and project checks

The validation environment is Python 3.10+ with `rasterio==1.5.2` from [requirements-p1.txt](../requirements-p1.txt). The validation command, run from the repository root, is:

```text
python scripts/validate_p1_metadata.py
```

The script checks file existence according to each manifest status, non-empty files, configured checksums and sizes, raster readability/dimensions, and required spatial metadata. `VERIFIED_EXTERNAL` records are optional in a clean clone but are hashed when their external files are present. The PDS Mastcam-Z image is permitted to have no CRS because its paired PDS4 label identifies it as unreferenced rover-frame data.

The inventory and source manifests contain the same 17 dataset IDs; the product-validation manifest adds one SIM metadata XML record (18 rows). The validator also rejects CSV rows with more or fewer fields than their header. SIM raster and geodatabase paths resolve to Git-tracked products; `VERIFIED_EXTERNAL` distinguishes the raw source archive, sibling metadata copy, and external MEDA sample. HiRISE rows distinguish the tracked IRB product from P2-local products.

Final run on 2026-11-14: inventory 17 rows, source manifest 17 rows, product validation 18 rows; 0 validator errors. Cross-manifest ID, status, uniqueness, and field-count checks passed. `npm run build`, `npm run lint`, `git diff --check`, and `git lfs fsck` passed. Rasterio emitted an expected `NotGeoreferencedWarning` for the unreferenced rover-frame Mastcam-Z image; the PDS label confirms it has no map CRS. The project has no `test` script or matching test files.

## Limitations

- The raw SIM 3464 ZIP and its source-workspace metadata copy are not in Git; the extracted rasters and geodatabase are tracked. Git LFS must be enabled to retrieve tracked rasters in a fresh clone.
- Individual raster CRSs and extents differ. DTM units and vertical references are marked unknown where not explicit in source metadata; do not assume one CRS or vertical datum for the full package.
- P2's RED/DTM payload hashes are not independent P1 checks.
- The Mastcam-Z frame has no geodetic coordinates or image footprint; it cannot be spatially registered to SIM 3464 based on this product alone.
- SIM 3464 retains the documented 100–200 m positional uncertainty relative to later Mars 2020 operational products.
- No complete MEDA archive or broader rover observation set is claimed. The task requirements do not specify an environmental sol range or additional required rover product IDs.
- NASA's public Mastcam-Z panorama is an aggregate; no evidence ties this PDS frame to a particular panorama frame.
- RIMFAX was not acquired because no unconditional requirement was identified.
