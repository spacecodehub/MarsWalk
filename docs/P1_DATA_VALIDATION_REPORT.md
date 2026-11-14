# P1 Data Validation Report

## Validation scope
Validation was applied to the local SIM 3464 package and the metadata records generated in this work.

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
- HiRISE and MEDA families remain outstanding and were recorded as unavailable in the local workspace rather than as downloaded or verified assets.
