# Saniya — Science methodology

## Environmental processing

The processor verifies that the detached label's product filename, record count and MD5 correspond to the downloaded raw CSV before interpreting it. It requires the MEDA sol-1 derived pressure table's six expected columns. Raw data and labels remain unchanged; cleaned values, summaries and figures are written separately.

The PDS MEDA RDR SIS defines pressure in pascals and describes missing-value and flag conventions. For this product, the quality table has no flag column. The processor keeps finite positive pressure values with a nonempty LTST and excludes missing pressure, the documented `999999999` sentinel, nonpositive values, and missing local time. The conditions are counted in the summary. Filters are applied as independent reason counts; invalid rows are excluded by the combined validity mask.

The product supplies per-row SCLK, LMST and LTST but only product-level UTC bounds. The code does not interpolate UTC. The uncertainty column is entirely blank in the sampled file and has a `kelvin` unit in the label despite describing pressure uncertainty; it is excluded, not repaired. The chart and summary identify the data as historical rover-local measurements, not a live weather feed or future astronaut forecast.

## Target confidence

`moderate` means a NASA-published, direct-imaging context supports the broad target, while the catalogue still lacks individual PDS image IDs, registered coordinates and P2 GIS overlays. It does not mean a probability that life or a specific mineral is present.

The target text separates NASA's observations and interpretations from Saniya's proposed astronaut investigations. The source describes a river/lake delta interpretation, layered sedimentary exposures and fine-grained rocks; this is not a life-detection claim.

## Scientific priority heuristic

The target priority is a configurable Saniya project heuristic, not an official NASA method. Five evidence-based dimensions are rated from 0 to 4 and combined as a weighted average:

| Dimension | Weight | What it measures |
| --- | ---: | --- |
| Scientific significance | 0.25 | Relevance to the documented mission science questions |
| Evidence strength | 0.25 | Directness and corroboration of the cited evidence |
| Observation availability | 0.15 | Amount and retrievability of traceable observations |
| Geological diversity | 0.15 | Variety of described materials or structures to investigate |
| Investigation value | 0.20 | Specific, testable follow-up questions supported by evidence |

`score = 100 × Σ(weight × dimension_rating) / 4`. The initial delta-area inputs are documented alongside the target with a rationale for each rating; this produces 86.3/100. The score describes scientific investigation priority only. Terrain danger, accessibility, route distance and astronaut safety are explicitly excluded and remain P4's domain. Missing dimensions result in an unscored target instead of a guessed score.

The initial ratings are coarse project judgments based on one NASA aggregate resource and should be revisited when P1 provides the underlying products and P2 provides registered geology layers. They must not be used as route costs or safety values.
