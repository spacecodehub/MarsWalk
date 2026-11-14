# Saniya — Science Intelligence and Environmental Analysis

## Repository audit

At the start of this audit, the repository contained a placeholder README and generic `.gitignore` only; there was no backend, frontend, API schema, database model, tests, dataset, GIS layer, documented team contract or assigned-member code. Since then, `main` has received a Vite/React starter scaffold. Its current `src/App.jsx` is still the Vite counter/logo screen and has no Mars data provider, science data mode, or P1/P2 integration. This branch leaves that application scaffold unchanged.

P1/P2 data and P3/P4/P5 contracts were not present, and no team coordination channel was provided. This work therefore adds a backend-neutral library and provisional data contracts only. It does not create FastAPI endpoints, a database, route planner, GIS workflow or React components. P3, P4 and P5 still need to review and approve any shared contract before integration.

## Implemented

- Traceable JSON catalogue with one NASA-published Mastcam-Z delta panorama aggregate and one actual PDS MEDA environmental product. Individual image product IDs not exposed by NASA's panorama page are not fabricated.
- A Jezero western-delta science target, with unknown point coordinates/CRS kept null, supporting evidence, confidence rationale and practical field investigation questions.
- Reusable observation loading, duplicate and coordinate validation, lookup and instrument/sol filtering.
- Reusable target validation, evidence-link validation, recommendations and a configurable 0–100 scientific priority heuristic separated from safety/accessibility.
- MEDA PDS4 label parsing, checksum/row-count/schema verification, explicit quality filtering, descriptive pressure summary and historical-measurement plot.
- A backend-neutral `ScienceService` facade for P3 to wrap after contract review; callers explicitly select the MEDA product and label and provide output/report directories, with no implicit source/default/fallback.

## Data and processing

The raw MEDA sol-1 derived pressure CSV (125,877 bytes) and detached PDS4 XML label (9,326 bytes) are in `data/science/meda/raw/`. The PDS label's MD5 (`ec537dbac49f78beb648de1d12ec7333`) was verified against the raw CSV. The label identifies the product as derived pressure data, sol 1, UTC bounds 2021-02-19T21:35:54.970Z–2021-02-19T22:29:54.996Z, 2,330 data rows and `PRESSURE` in Pa. The processed output contains 2,330 valid rows, with mean 715.002 Pa, median 715.03 Pa, and range 713.91–716.12 Pa. These are descriptive statistics of this historical rover-local sample only.

The processor excludes missing pressure, the PDS sentinel, non-finite/nonpositive pressure and missing LTST. There is no quality-flag column. All 2,330 rows passed those rules. It preserves SCLK/LMST/LTST and does not invent per-row UTC or location. The pressure-uncertainty values are blank; its PDS label unit is anomalously `kelvin`, so it is excluded. See [DATA_SOURCES.md](DATA_SOURCES.md) and [SCIENCE_METHODOLOGY.md](SCIENCE_METHODOLOGY.md).

The panorama evidence comes from NASA Science, which reports a 1,118-image color-enhanced Mastcam-Z panorama acquired on sols 466, 467, 470, 471 and 474. Individual PDS product IDs and coordinates are not present in that NASA resource. The catalogue preserves this as an aggregate resource record with null coordinates, not a fabricated single-frame product.

## Data-mode boundary

This branch adds no application data provider, application default, fallback, or data-mode setting. The current Vite/React starter scaffold has no science integration to wire. The committed runtime catalogue contains only the NASA-published panorama aggregate and the authentic NASA PDS MEDA product; no synthetic/demo records or demo datasets are included. Small synthetic rows exist only inside unit tests for invalid-data handling. The command-line sample processor explicitly names the checked-in real MEDA product, while the reusable service requires callers to pass a product CSV and matching PDS4 label. This science contribution does not claim the complete MarsWalk application uses real data.

## Data contracts and integration status

The JSON catalogues are versioned `1.0` and form the provisional P3 handoff. Records include stable catalogue IDs, NASA/PDS identifiers where supplied, URLs, instrument, mission, sol/time metadata, processing level, units, quality, confidence and limitations. Targets reference catalogue observation IDs. Environmental summaries include unit, historical-data labeling, quality filtering counts and time basis. A sample API payload is produced in `data/science/meda/processed/` by the processing command.

Example provisional response shapes are the files themselves: `observations.json` (`{schema_version, observations:[...]}`), `targets.json` (`{schema_version, targets:[...]}`), and the generated MEDA summary (`{product_lid, sol, measurement:{name,unit,minimum,maximum,mean,median,...}, filtered_counts, historical_measurements, time_basis}`). These are not approved REST contracts; P3 should map them to its models after review.

No endpoints are proposed as final because no P3 contract was available. The `ScienceService` has methods for listing/filtering observations, fetching a record, ranking/fetching targets and producing the MEDA summary. P3 may wrap these in approved API models. P4 receives scientific priority, evidence and recommendations without route decisions. P5 may display the catalogues and summary, preserving their confidence and historical labels.

## Commands

```powershell
python -m venv .venv-science
.\.venv-science\Scripts\python -m pip install -r requirements-science.txt
.\.venv-science\Scripts\python scripts\process_meda.py --overwrite
.\.venv-science\Scripts\python -m unittest discover -s tests -v
```

The processing command defaults to a cleaned CSV and summary JSON in `data/science/meda/processed/`, plus a PNG in `data/science/meda/reports/`; `--output-dir` and `--report-dir` select other destinations. Existing outputs are preserved unless `--overwrite` is explicitly supplied. The service API likewise requires caller-selected output and report directories and defaults to refusing existing outputs. Raw files are never rewritten. `.venv-science/` is ignored by Git.

## Validation and remaining integration work

Automated tests cover catalogue provenance/duplicates/coordinate ranges, PDS label metadata, checksum and row-count validation, actual MEDA processing outputs, missing/sentinel/nonfinite/invalid-time handling, preservation of existing outputs, protection against raw-input path collisions, target evidence links and ranking separation, recommendations and service loading.

API compatibility and frontend labels cannot be validated until those modules and P3's approved contracts exist. P1 should supply the full observation set and product-to-image metadata; P2 should supply registered GIS layers and agreed CRS; P3/P4/P5 should review the provisional schema and consumer needs. The science priority score is a local heuristic and must not be used for route safety. RIMFAX is not integrated in this slice because no corresponding product or interpretation metadata was supplied for a target.

**Integration status: WAITING FOR P1/P2 DATASETS.** The latest shared-repository check found `main` at `c4c7153b7e98d898b60be8564d68f896945207e7`, with only the merged setup and README branches in addition to `main` and Saniya's branch. No P1/P2 branches or data pull requests were present. `main` now contains a Vite/React starter screen but no Mars data provider, science data mode, observation products or GIS layers. The independent sol-1 MEDA sample and NASA panorama resource already used by this module do not substitute for P1's mission dataset or P2's registered layers. See [P1_P2_DATA_INTEGRATION_STATUS.md](P1_P2_DATA_INTEGRATION_STATUS.md) for the precise missing inputs and proposed handoff paths.

No provider has been activated or replaced and no application data mode exists to change in this repository. Any future real-data-provider activation or data-mode change requires Saniya's explicit approval. Integration and a migration report are deferred until P1/P2 data are pushed and validated.

## Test results

Executed in `.venv-science` with Python 3.10.11, Pandas 2.3.3, NumPy 2.2.6 and Matplotlib 3.10.9:

- `python -m unittest discover -s tests -v` — 11 tests passed, including output-path safety cases.
- `python scripts/process_meda.py` with temporary `--output-dir` and `--report-dir` destinations — processed 2,330 of 2,330 rows and generated the cleaned CSV, summary JSON and pressure PNG without replacing repository artifacts.
- Raw CSV/XML hashes and observation/target catalogue hashes were unchanged by validation; pressure statistics still match the checked-in summary.

## Delivery status

Branch: `saniya/science-environmental-intelligence`; pushed to GitHub. The science implementation, P1/P2 wait-state, and explicit MEDA input selection are in the branch history. No application/demo-data configuration is included. PR creation through the connected GitHub integration returned 403 (`Resource not accessible by integration`); the GitHub CLI is not installed. Do not merge without explicit approval.
