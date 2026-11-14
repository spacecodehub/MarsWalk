# MEDA sample data

The raw CSV and detached PDS4 label in `raw/` are an unchanged, 123 KB sample
from NASA PDS Mars 2020 MEDA Derived Pressure Sensor data, sol 1. The product
is version P02 / label version 2.0. The label reports 2,330 table rows and
MD5 `ec537dbac49f78beb648de1d12ec7333`; the downloaded file matches it.

The direct source URL and PDS logical identifier are recorded in
`data/science/observations/observations.json`. The XML label is required to
read the product bounds, processing level, row count, checksum and schema.
Processed CSV, summary JSON and plot outputs go to separate directories and
can be regenerated with `python scripts/process_meda.py` after installing
`requirements-science.txt`.

The derived pressure field is in pascals. The product has SCLK, LMST and LTST
per row but only product-level UTC bounds. It has no quality-flag column.
Pressure uncertainty is blank in this product; the detached label declares
`kelvin` for that uncertainty field, so the implementation deliberately does
not calculate or display uncertainty. Historical rover measurements are not
live weather or an astronaut forecast.
