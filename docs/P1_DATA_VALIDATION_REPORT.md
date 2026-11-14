# P1 Data Validation Report

## Validation scope

The P1 validator checks the three CSV manifests and files reachable from this checkout. The SIM 3464 source package is resolved from the sibling workspace directory `..\data\raw\geology\`; it is not tracked by Git. A clean clone therefore needs that package distributed separately before the same local-file validation can pass.

The sol-466 Mastcam-Z PDS image and detached XML label are tracked in this P1 branch and validated locally. P2's HiRISE payloads and Saniya's MEDA sample are external references, not P1-local files; their reported checksums are not treated as P1 validation.

## Product validation results

- Ten SIM 3464 inventory entries are locally validated in the sibling workspace, not Git-tracked. The archive and file products with configured checksums were hashed; the geodatabase directory was checked for presence and non-empty contents.
- Mastcam-Z sol-466 image: 2,022,096 bytes; SHA-256 `6C679BD74D17C0748D510474C0D0ED88563589BB5DA79E06EBB9961D6F639871`.
- Mastcam-Z XML label: 79,543 bytes; SHA-256 `87547EC0E4475A01FA31FE3141CB65469DF63276BA3866530958EDF1E36DFB20`.
- The PDS label confirms the Mastcam-Z Left product LID, sol 466, timestamp 2022-06-12T12:47:07.279Z, raw science imaging, and one 1648x1200 UnsignedByte array in DN. Rasterio opened the image as one uint8 band with no CRS, consistent with the label; this is expected for an unreferenced rover-frame image.
- HiRISE RED and stereo DTM hashes/sizes are P2-reported only. P1 did not access or recompute them. The IRB image and label are tracked on `origin/main`, but are absent from this branch checkout; their P2-reported checksum was not recomputed by P1.
- The MEDA sol-1 sample is on Saniya's branch. Its checksum is reported from the PDS label by that contributor and was not recomputed by P1. It is not a complete environmental archive.

## Manifest and project checks

The validation command is:

```text
python scripts/validate_p1_metadata.py
```

The script checks file existence according to each manifest status, non-empty files, configured checksums and sizes, raster readability/dimensions, and required spatial metadata. The PDS image is permitted to have no CRS because its paired PDS4 label identifies it as unreferenced rover-frame data.

The inventory and source manifests contain the same 15 dataset IDs; the product-validation manifest adds one SIM metadata XML record (16 rows). The validator also rejects CSV rows with more or fewer fields than their header. `VERIFIED` on SIM rows means the files were checked in the sibling workspace, not that they are Git-tracked. HiRISE and MEDA records distinguish main/P2/Saniya references from files acquired in this P1 branch.

Final run on 2026-11-14: inventory 15 rows, source manifest 15 rows, product validation 16 rows; 0 validator errors. Cross-manifest ID, status, and field-count checks passed. `npm run build`, `npm run lint`, and `git diff --check` passed. The project has no `test` script or matching test files.

## Limitations

- The P1 manifests point to SIM 3464 files outside the repository. Local validation in this workspace does not make those files available to a clean clone.
- P2's RED/DTM payload hashes, the IRB payload hash, and Saniya's MEDA sample hash are not independent P1 checks.
- The Mastcam-Z frame has no geodetic coordinates or image footprint; it cannot be spatially registered to SIM 3464 based on this product alone.
- SIM 3464 retains the documented 100–200 m positional uncertainty relative to later Mars 2020 operational products.
- No complete MEDA archive or broader rover observation set is claimed. The task requirements do not specify an environmental sol range or additional required rover product IDs.
- NASA's public Mastcam-Z panorama is an aggregate; no evidence ties this PDS frame to a particular panorama frame.
- RIMFAX was not acquired because no unconditional requirement was identified.
