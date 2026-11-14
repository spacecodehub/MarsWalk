# Saniya — Science data sources

## Perseverance Jezero delta panorama

- Publisher: NASA Science / Mars 2020 Perseverance mission.
- Page: <https://science.nasa.gov/resource/perseverance-explores-the-jezero-crater-delta/>
- Instrument: Mastcam-Z.
- Mission-reported acquisition sols: 466, 467, 470, 471 and 474 (2022-06-12, 13, 16, 17 and 20 UTC dates).
- Product described by NASA: a color-enhanced 2.5-billion-pixel panorama assembled from 1,118 Mastcam-Z images.
- Original PDS identifiers: not listed in the cited resource. The catalogue uses a clearly labelled local resource-record ID and does not claim it is an individual NASA product ID.
- Coordinates/CRS: not supplied by that resource; left null.
- Use: broad geological context for the Jezero western delta target only. Do not treat the enhanced panorama as calibrated spectral data.

## MEDA sol 1 derived pressure

- Archive: NASA Planetary Data System, Atmospheres Node, Mars 2020 MEDA bundle.
- Bundle DOI: <https://doi.org/10.17189/1522849>.
- PDS bundle: <https://pds.nasa.gov/ds-view/pds/viewBundle.jsp?identifier=urn%3Anasa%3Apds%3Amars2020_meda&version=1.0>.
- Product LID: `urn:nasa:pds:mars2020_meda:data_derived_env:we__0001___________der_ps__________________p`.
- Raw CSV: <https://atmos.nmsu.edu/PDS/data/PDS4/Mars2020/mars2020_meda/data_derived_env/sol_0000_0089/sol_0001/WE__0001___________DER_PS__________________P02.CSV>.
- Detached PDS4 label: <https://atmos.nmsu.edu/PDS/data/PDS4/Mars2020/mars2020_meda/data_derived_env/sol_0000_0089/sol_0001/WE__0001___________DER_PS__________________P02.xml>.
- Product version: P02 / label version 2.0; label says it was reprocessed for barocap drift compensation.
- Processing level: Derived.
- Product-level UTC span: 2021-02-19T21:35:54.970Z to 2021-02-19T22:29:54.996Z; sol 1.
- Columns: `SCLK` (s), `LMST`, `LTST`, `PRESSURE` (Pa), `PRESSURE_UNCERTAINTY`, and `TRANSDUCER`.
- Quality information: no quality-flag field in this product. Missing values and PDS sentinel `999999999` are excluded from summaries; non-finite/nonpositive pressure and rows without LTST are excluded. All 2,330 rows in the current product passed these rules.
- Limitation: pressure uncertainty is blank in the supplied table; the detached label describes that field with a `kelvin` unit. The analysis does not use it.
- Location and time limitations: no row-level UTC or rover coordinates in this table; those are not inferred.

## MEDA field documentation

- PDS MEDA overview and retrieval: <https://pds-atmospheres.nmsu.edu/data_and_services/atmospheres_data/PERSEVERANCE/meda.html>.
- MEDA Environmental RDR Software Interface Specification: <https://atmos.nmsu.edu/PDS/data/PDS4/Mars2020/mars2020_meda/document/meda_env_rdr_sis.pdf>.
- Relevant SIS conventions: derived records can use assumptions/models; flag fields, when present, use `1` for good and `0` for bad; `999999999` denotes a calibrated value that could not be computed.

## Other primary references

- Mars 2020 PDS Geosciences Node archive index: <https://pds-geosciences.wustl.edu/missions/mars2020/>.
- NASA Perseverance science instruments: <https://science.nasa.gov/mission/mars-2020-perseverance/science-instruments/>.
