# P1 NASA Data Inventory

## Repository and branch
- Repository: https://github.com/spacecodehub/MarsWalk
- Branch: person1-data-acquisition
- Commit inspected: 5f4b3fa
- Working tree: clean at the start of the P1 implementation work

## Verified inventory
The following products were present in the repository and validated from the local files:

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

## Product summary
- Source: USGS SIM 3464, https://doi.org/10.3133/sim3464
- Coverage: 76.8°–77.8°E; 17.7°–18.7°N
- CRS: Mars Transverse Mercator, Mars_2000_(Sphere)
- Units: meters; pixel scales recorded as ~6 m, 20 m, 75 m, 100 m depending on product
- Documentation: Metadata XML and ArcGIS project are present in the extracted package
- Limitation: USGS metadata records 100–200 m random positional offsets relative to later Mars 2020 surface-operation products

## Pending product categories
The following categories remain unacquired or not downloaded in this repository:
- HiRISE products: ESP_022680_1985_RED_A_01_ORTHO, ESP_022746_1985_IRB_C_01_ORTHO
- MEDA environmental archives
- Perseverance rover observation archives
- Additional CTX source products beyond the already included SIM 3464 package
- RIMFAX products not verified in-scope for this repo

## File locations
- Source archive: data/raw/geology/sim3464_database.zip
- Extracted package: data/raw/geology/extracted/sim3464_database/sim3464_JezeroNili_FINAL/
- Metadata: data/raw/geology/extracted/sim3464_database/sim3464_JezeroNili_FINAL/Metadata/SIM3464_metadata.xml
- Manifest: data/metadata/dataset_inventory.csv
- Validation manifest: data/metadata/product_validation.csv

## Status
- Verified products: 10 entries in the current local inventory
- Pending product IDs: 2 HiRISE IDs explicitly called out in project brief; no local files obtained
- No large scientific downloads were committed without a confirmed storage plan
