# P6 science-target interface for P4 and P5

## Integration status

This is a provisional, versioned handoff. The repository currently contains no
P4 navigation/route-planning module or P5 map visualization module, and no
P4/P5 branches or approved consumer contracts were available during this work.
The interfaces below are implemented by `ScienceService` and can be reviewed
by those contributors before they bind to an application API. The test fixture
at `tests/fixtures/mock_science_targets.json` is explicitly mock-only and is not
runtime science data.

## Actual available target and evidence

The target catalogue currently contains one target:

| Target | Category | Location | Science priority | Supporting evidence |
| --- | --- | --- | ---: | --- |
| `jezero-western-delta` — Jezero western delta panorama area | Deltaic sedimentary landform | Not located; coordinates and CRS are null | 86.3/100, local P6 heuristic | NASA-published Mastcam-Z panorama aggregate, acquired on sols 466, 467, 470, 471 and 474 |

The source is the NASA panorama resource recorded in
`data/science/observations/observations.json`. It does not provide individual
PDS image IDs or target coordinates. The target must therefore remain unlocated
until P1/P2 provide source-linked products and registered location data.

The checked-in sol-1 MEDA pressure product is authentic environmental data, but
it is not evidence for the delta target's location and does not supply target
coordinates. It is not attached to the target's provenance list. No additional
targets or findings are inferred from it.

## Payload schema

The JSON Schema is
[`schemas/p6_science_targets.schema.json`](schemas/p6_science_targets.schema.json).
The top-level `schema_version` is `1.0`. Both consumers receive target ID and
name, science category, location (or `null`), priority score and role,
scientific objective/rationale, source-linked provenance, confidence,
limitations, uncertainty status and availability.

The P4 route-planning response also includes `route_planning_policy`. The score
is advisory and can be used only as a soft science preference. Hard safety
constraints remain mandatory and cannot be overridden by science priority.
P4 remains responsible for route feasibility and safety decisions.

The P5 map response includes `map_display_policy`. It instructs a map client to
plot only targets with a location and retain unlocated targets in a list or
other non-map view. The payload is CRS-aware JSON, not GeoJSON, because Mars
CRS semantics must not be silently coerced to Earth's GeoJSON coordinate
assumptions.

Example service calls:

```python
from science_engine.science_service import ScienceService

science = ScienceService(repository_root)
p4_targets = science.targets_for_p4_route_planning()
p5_targets = science.targets_for_p5_map()
```

When a consumer requests a different CRS, it must provide the target CRS,
target coordinate units and an adapter from its authoritative GIS stack:

```python
p5_targets = science.targets_for_p5_map(
    target_crs=map_crs,
    target_units=map_units,
    coordinate_transform=gis_transform_xy,
)
```

The adapter contract is `(x, y, source_crs, target_crs) -> (x, y)`. The
serializer checks that transformed coordinates are finite and records both
source and target CRS plus `caller_supplied_adapter` provenance. It never
guesses a projection or relabels unchanged values. If a target has no
coordinates, its `location` stays `null` and no transform is attempted even
when the consumer requests a CRS.

## Coordinate reference systems

- Geographic catalogue coordinates, if later supplied, use explicit
  `longitude_east_deg` and `latitude_deg` fields plus the source-declared CRS.
  Serialization uses `x = east longitude`, `y = latitude`, in degrees.
- Projected coordinates use numeric `x` and `y`, with both a CRS identifier
  and `coordinate_units` required by target validation.
- A reprojection requires an explicit transformer supplied by the consumer.
  The returned location keeps the original CRS and records the requested CRS,
  units and transformation marker. No transform occurs when CRS definitions
  are equal.
- The current real target has no coordinates, CRS or positional uncertainty.
  These values remain unavailable rather than being inferred from the
  panorama, rover position or MEDA product.

## Test coverage and limits

Tests exercise the emitted schema fields, real-target missing-location
handling, source provenance, the P4 safety policy, P5's unlocated display
policy, projected-coordinate validation, and an explicit mock coordinate
transform. The mock fixture uses a labelled mock local grid and a simple
metres-to-kilometres adapter solely to test the interface; it is not a Mars
coordinate system or a scientific location.

Because P4/P5 modules and P2 registered coordinates are not present, this is
an interface-level integration test, not an end-to-end route or rendered-map
test. The actual Jezero target has no coordinates, so no real Mars CRS
transformation can be validated until P2's data and CRS metadata are delivered.
