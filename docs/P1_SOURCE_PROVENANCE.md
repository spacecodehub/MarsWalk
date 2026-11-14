# P1 Source Provenance

## Verified source dataset
The primary source package is the USGS SIM 3464 release for the Jezero/Nili geologic map.

- DOI: https://doi.org/10.3133/sim3464
- USGS index: https://pubs.usgs.gov/sim/3464/
- Metadata URL: https://pubs.usgs.gov/sim/3464/sim3464_metadata.txt
- Readme URL: https://pubs.usgs.gov/sim/3464/sim3464_readme.txt

## Local package provenance
The extracted package is available in the local workspace's sibling `data` directory, not committed to this repository:

- `..\data\raw\geology\extracted\sim3464_database\sim3464_JezeroNili_FINAL\`
- The archive is `..\data\raw\geology\sim3464_database.zip`.

The P1 validator resolves `../data/raw/...` against this sibling directory when present. A clean clone does not include these large scientific files; coordinate their storage/distribution separately.

In the CSV manifests, `VERIFIED` means that the file at the recorded path was checked in the available workspace; it does not mean that the file is Git-tracked. The SIM 3464 paths resolve to the sibling workspace. `AVAILABLE_NOT_DOWNLOADED` and `PENDING_DISTRIBUTION` identify external products that were not acquired by P1.

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

## P2 and team-held data findings (checked 2026-11-14)

P2 PR #5 (current head `335412b`) provides the HiRISE source records and a `GIS/raw_data/` placement contract; the source details first appeared in `70d661c`. The two requested originals are not both in this P1 checkout:

- RED `ESP_022680_1985_RED_A_01_ORTHO.JP2`: [official PDS file](https://hirise-pds.lpl.arizona.edu/PDS/DTM/ESP/ORB_022600_022699/ESP_022680_1985_ESP_022746_1985/ESP_022680_1985_RED_A_01_ORTHO.JP2); paired [PDS3 label](https://hirise-pds.lpl.arizona.edu/PDS/DTM/ESP/ORB_022600_022699/ESP_022680_1985_ESP_022746_1985/ESP_022680_1985_RED_A_01_ORTHO.LBL). P2 reports 518,407,009 bytes and SHA-256 `2fcbb2488242f28ae3b8e8d5c9afbe16850e01bc363eca1b52205df977d67b82`; it is local-only in P2, not accessible in the P1 workspace, and not independently verified by P1. The P2-reported label metadata gives 0.2524259537 m/pixel, planetocentric equirectangular coordinates, 77.37089912–77.50346219°E / 18.09654380–18.36864001°N, and DN-to-I/F calibration. P2 stores its label under `GIS/documentation/source_labels/`.
- IRB `ESP_022746_1985_IRB_C_01_ORTHO.JP2`: [official PDS file](https://hirise-pds.lpl.arizona.edu/PDS/DTM/ESP/ORB_022600_022699/ESP_022680_1985_ESP_022746_1985/ESP_022746_1985_IRB_C_01_ORTHO.JP2); paired [PDS3 label](https://hirise-pds.lpl.arizona.edu/PDS/DTM/ESP/ORB_022600_022699/ESP_022680_1985_ESP_022746_1985/ESP_022746_1985_IRB_C_01_ORTHO.LBL). P2 reports 19,743,927 bytes and SHA-256 `fdfb9618c18240caa1718081b3e06246400373b942dd9bcca5f43215ae03ee80`; the image and label are tracked on `origin/main` at `666e512`, but absent from this P1 checkout. P1 did not fetch or independently checksum the payload. P2-reported label metadata gives a 1.0097038147 m/pixel stereo ortho grid and the same footprint as the RED.
- P2's paired stereo DTM is `DTEEC_022680_1985_022746_1985_A01.IMG`, not a requested P1 image product. P2 reports 479,934,208 bytes and SHA-256 `b88dac5862f64769a1dae0ad55271952b184f4529aa09980c13a149a0a628add`; its PDS label is embedded in the IMG. It is local-only in P2 and not copied by P1.

The official PDS directory was reachable on 2026-11-14 and listed both requested image filenames and their labels. P2 reports that no product-specific redistribution permission was found for the RED/DTM originals; the P1 contribution therefore does not rehost or duplicate these files. The P2 hashes and sizes are P2-reported, not P1-recomputed. Confirm redistribution terms with the archive/producer before copying.

## MEDA and rover observations

- MEDA's official bundle is DOI [10.17189/1522849](https://doi.org/10.17189/1522849). Saniya's remote branch (`saniya/science-environmental-intelligence`, commit `b6a4f29`) contains the PDS sol-1 derived pressure product `urn:nasa:pds:mars2020_meda:data_derived_env:we__0001___________der_ps__________________p`, its CSV and detached XML label. The source is the [PDS Atmospheres CSV](https://atmos.nmsu.edu/PDS/data/PDS4/Mars2020/mars2020_meda/data_derived_env/sol_0000_0089/sol_0001/WE__0001___________DER_PS__________________P02.CSV) and [label](https://atmos.nmsu.edu/PDS/data/PDS4/Mars2020/mars2020_meda/data_derived_env/sol_0000_0089/sol_0001/WE__0001___________DER_PS__________________P02.xml). The label-reported MD5 is `ec537dbac49f78beb648de1d12ec7333` per Saniya; P1 did not rehash this branch file. It is one 54-minute sol-1 pressure sample (Pa), with no rover coordinates or row-level UTC; it is not the complete MEDA environmental archive. The supplied P1 requirements identify relevant MEDA observations but do not define sols/time bounds or require a mission-wide full archive; additional products therefore remain unresolved pending a project interval.
- NASA's [Jezero delta panorama resource](https://science.nasa.gov/resource/perseverance-explores-the-jezero-crater-delta/) describes a 1,118-image Mastcam-Z aggregate from sols 466, 467, 470, 471 and 474. The page supplies no individual PDS product IDs or coordinates. The PDS image below is from sol 466, but no evidence links it to the panorama; further rover observation products remain unacquired pending product-level selection.
- P1 acquired `ZL0_0466_0708309593_769ECM_N0260756ZCAM08486_1100LMJ01.IMG` from the official [PDS Mastcam-Z operations raw archive](https://pds-imaging.jpl.nasa.gov/volumes/mars2020.html), with its detached XML label. PDS LID: `urn:nasa:pds:mars2020_mastcamz_ops_raw:data:zl0_0466_0708309593_769ecm_n0260756zcam08486_1100lmj`. The label reports sol 466, 2022-06-12 12:47:07.279–.280 UTC, Mastcam-Z Left, raw science imaging, and a 1648x1200 one-band UnsignedByte array in DN. It includes rover-frame/pointing telemetry but no geodetic coordinates, CRS or image footprint; do not spatially join it to SIM 3464. Collection DOI: [10.17189/twxd-mb70](https://doi.org/10.17189/twxd-mb70).
- NASA's [media-use guidance](https://www.nasa.gov/nasa-brand-center/images-and-media/) says NASA content is generally not subject to U.S. copyright and asks users to acknowledge the source. The product label has no specific license statement or third-party rights notice; cite NASA PDS/Mastcam-Z and confirm current terms for commercial or third-party use.
- RIMFAX was conditional in the supplied P1 scope; no explicit requirement was found, so no RIMFAX product was pursued.

Five HiRISE files found elsewhere under `Datasetmars/data/raw/hirise/` have different product IDs from the two requested records. They are not P1 repo assets and were not copied.
