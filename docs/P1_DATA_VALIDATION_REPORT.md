# P1 Data Validation Report

## Validation scope
Validation was applied to the local SIM 3464 package, the downloaded PDS rover image and label, and the metadata records generated in this work.

The raw SIM package validated by this checkout resides at `..\data\raw\geology\`, outside the Git repository. The validator's sibling-data fallback resolves these files only in this workspace; a fresh clone does not contain them.

## Verified checks
The following checks were performed on the files currently present in the repository:

- Product files exist on disk
- Files are non-zero in size
- Local file hashes were captured for selected datasets
- Source metadata file exists and is readable
- Product IDs are consistent with the dataset naming found in the extracted archive
- File paths match the repository structure
- The known 100–200 m geolocation caveat from the USGS documentation was retained

## File integrity results
Examples of captured SHA256 values:

- sim3464_database.zip: A88BD53A5573743CC4A20036C10E585106D08A433AD2F34AF269E9CEA1529F87
- SIM3464_metadata.xml: 5F686FBCF1D0D90E0D106BFAFEA28F950095B7564E580A85119D46B29842F078
- Nili_CTX_Mosaic_Beta01_Feb2018_MTM.tif: 0101EC220797C25E8F663B43B9F30B5BF5B0A093294CCCCC867A9044DBF78A96
- h0988_0000.da4.53.tif: 619C2D5B43051762DB0F1FD70CB1B8F8ED9D6916669B31D7D35A1E31B467AF06
- nili_h0988_0000_hillshade_clip.tif: 16360BC34D81032D9D36FF075D490456027AC378D942DAE6B44719CE2C33C295
- J03_045994_1986_XN_18N282W_6m_ORTHO.tif: 9023D5AB9094F2F39AB442485FEF4E87A636EE25FB4D0B7AE9C9F51503FF6516
- nili_THEMIS_DayIR_Controlled_oct2018.tif: 81DB7210842DCD6E8049787B9EA20967C5EE9EFF4984AEFE6A13A70BD7BEDBE9
- nili_THEMIS_NightIR_Controlled_oct2018.tif: 1B59C64019C74A1255FB3EE233439B7790D980773EBE9A798752B99425F7B50F

## Product-level validation status
- Verified and present: SIM 3464 archive and extracted geologic map package
- Verified and present: CTX mosaic
- Verified and present: HRSC DTM and hillshade
- Verified and present: CTX stereo orthophoto and DTM
- Verified and present: THEMIS day and night rasters
- Verified and present: geodatabase directory and metadata
- Pending: HiRISE product IDs from project brief, not downloaded locally

## Validation limitations
- The repo does not include independent checksum files from the original USGS archive for every raster file.
- Local metadata is sufficient to validate file presence and internal consistency but not to certify external NASA archive completeness beyond the source package captured here.
- The five HiRISE files found in the sibling workspace are different products from the requested ESP_022680/ESP_022746 pair. The available PDS label confirms `ESP_025436_1990_RED`; the embedded DTM header confirms `DTEEC_048842_1985_048908_1985_U01`; two orthophoto IDs are known from their exact filenames only because no labels were present. None was copied into the repository.
- P2's RED/DTM hashes and sizes and main's IRB tracking state are documented as external handoff evidence, not P1-local raster validation. P1 did not download or recompute those checksums.
- Saniya's branch contains one PDS MEDA sol-1 pressure sample with a PDS-label-reported MD5; it is not in this P1 checkout and was not rehashed by P1. It is not a complete environmental archive.
- NASA's public Mastcam-Z panorama page identifies an aggregate and acquisition sols but does not publish per-frame product IDs or coordinates; P1 does not claim that its separately acquired image is one of those frames.
- Acquired PDS Mastcam-Z image and XML label: the label LID matches the inventory; IMG length 2,022,096 bytes and local SHA-256 `6C679BD74D17C0748D510474C0D0ED88563589BB5DA79E06EBB9961D6F639871`; label length 79,543 bytes and SHA-256 `87547EC0E4475A01FA31FE3141CB65469DF63276BA3866530958EDF1E36DFB20`. Rasterio opened the image as 1648x1200x1 uint8 with no CRS, consistent with the label's unreferenced rover-frame data. The PDS XML label provides no published file checksum; local hashes verify the downloaded copies.
- No RIMFAX product was acquired because the original P1 prompt makes this conditional on verifying a relevant Jezero product.
