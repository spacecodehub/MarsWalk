"""Versioned science-target payloads for navigation and map consumers."""

from __future__ import annotations

from collections.abc import Callable, Iterable, Mapping
from math import isfinite
from typing import Any

from .observations import CatalogueError
from .targets import score_target


CoordinateTransform = Callable[[float, float, str, str], tuple[float, float]]


def _number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and isfinite(value)


def _location(
    target: Mapping[str, Any],
    *,
    target_crs: str | None,
    target_units: str | None,
    coordinate_transform: CoordinateTransform | None,
) -> dict[str, Any] | None:
    coords = target.get("coordinates")
    if coords is None:
        return None
    if not isinstance(coords, Mapping):
        raise CatalogueError(f"Target {target.get('target_id')} has malformed coordinates")

    if {"longitude_east_deg", "latitude_deg"}.issubset(coords):
        x, y = coords["longitude_east_deg"], coords["latitude_deg"]
        units = "degrees"
        input_axis_order = ["longitude_east_deg", "latitude_deg"]
        geographic = True
    elif {"x", "y"}.issubset(coords):
        x, y = coords["x"], coords["y"]
        units = target.get("coordinate_units")
        input_axis_order = ["x", "y"]
        geographic = False
        if not isinstance(units, str) or not units.strip():
            raise CatalogueError(f"Target {target.get('target_id')} projected coordinates need units")
    else:
        raise CatalogueError(f"Target {target.get('target_id')} has an unsupported coordinate shape")

    source_crs = target.get("crs")
    if not _number(x) or not _number(y) or not isinstance(source_crs, str) or not source_crs.strip():
        raise CatalogueError(f"Target {target.get('target_id')} coordinates need finite values and a CRS")
    if geographic and (not 0 <= x <= 360 or not -90 <= y <= 90):
        raise CatalogueError(f"Target {target.get('target_id')} has invalid geographic coordinates")

    transformed = False
    out_x, out_y, out_crs, out_units = float(x), float(y), source_crs, units
    if target_crs and target_crs.casefold() != source_crs.casefold():
        if coordinate_transform is None:
            raise CatalogueError(
                f"Target {target.get('target_id')} needs a coordinate transform from {source_crs} to {target_crs}"
            )
        if not isinstance(target_units, str) or not target_units.strip():
            raise CatalogueError("target_units is required when transforming coordinates")
        result = coordinate_transform(float(x), float(y), source_crs, target_crs)
        if not isinstance(result, (tuple, list)) or len(result) != 2 or not all(_number(v) for v in result):
            raise CatalogueError("Coordinate transform must return two finite numeric values")
        out_x, out_y = float(result[0]), float(result[1])
        out_crs, out_units = target_crs, target_units
        transformed = True
    elif target_units and target_units != units:
        raise CatalogueError("Changing coordinate units requires an explicit coordinate transform")

    return {
        "coordinates": {"x": out_x, "y": out_y},
        "crs": out_crs,
        "units": out_units,
        "axis_order": ["x", "y"],
        "source_crs": source_crs,
        "source_axis_order": input_axis_order,
        "transformation": (
            {"source_crs": source_crs, "target_crs": out_crs, "method": "caller_supplied_adapter"}
            if transformed else None
        ),
    }


def serialize_science_targets(
    targets: Iterable[Mapping[str, Any]],
    observations: Iterable[Mapping[str, Any]] = (),
    *,
    consumer: str,
    target_crs: str | None = None,
    target_units: str | None = None,
    coordinate_transform: CoordinateTransform | None = None,
) -> dict[str, Any]:
    """Build the shared P4/P5 payload without filling in absent science data.

    Transform adapters must be supplied by the consumer's authoritative GIS
    stack; this module does not assume a Mars projection or perform a CRS guess.
    """
    if consumer not in {"p4_route_planning", "p5_map_visualization"}:
        raise ValueError("consumer must be p4_route_planning or p5_map_visualization")
    if target_crs is not None and (not isinstance(target_crs, str) or not target_crs.strip()):
        raise ValueError("target_crs must be a nonempty CRS identifier")
    if coordinate_transform is not None and target_crs is None:
        raise ValueError("target_crs is required when a coordinate transform is supplied")

    observation_index = {row["record_id"]: row for row in observations if row.get("record_id")}
    output_targets = []
    for target in targets:
        target_id = target.get("target_id")
        if not target_id or not target.get("name"):
            raise CatalogueError("Science target payload requires target_id and name")

        priority = target.get("scientific_priority")
        if priority is None:
            priority = score_target(dict(target))
        score = priority.get("score") if priority else None
        observation_ids = list(target.get("supporting_observation_ids", []))
        linked_observations = []
        for record_id in observation_ids:
            record = observation_index.get(record_id)
            if record:
                linked_observations.append({
                    "observation_id": record_id,
                    "record_kind": record.get("record_kind"),
                    "instrument": record.get("instrument"),
                    "sols": record.get("sols"),
                    "source_url": record.get("source_url"),
                    "source_product_ref": record.get("source_product_ref"),
                    "source_dataset_id": record.get("source_dataset_id"),
                    "processing_level": record.get("processing_level"),
                    "measurement_units": record.get("measurement_units"),
                    "historical_measurements": record.get("historical_measurements"),
                })

        location = _location(
            target,
            target_crs=target_crs,
            target_units=target_units,
            coordinate_transform=coordinate_transform,
        )
        output_targets.append({
            "target_id": target_id,
            "name": target["name"],
            "science_category": target.get("geological_category"),
            "location": location,
            "priority_score": score,
            "priority": {
                "scale": priority.get("scale") if priority else "0-100",
                "method": priority.get("method") if priority else None,
                "role": "advisory_only",
                "inputs": priority.get("inputs") if priority else None,
                "weights": priority.get("weights") if priority else None,
                "excludes": priority.get("excludes", []) if priority else [],
                "input_rationale": target.get("priority_input_rationale", {}),
            },
            "scientific_justification": {
                "objective": target.get("scientific_objective"),
                "rationale": target.get("scientific_significance"),
                "recommended_investigations": target.get("recommended_investigations", []),
            },
            "provenance": {
                "supporting_observation_ids": observation_ids,
                "observations": linked_observations,
                "sources": target.get("evidence_sources", []),
            },
            "data_quality": {
                "confidence": target.get("confidence", "unknown"),
                "confidence_rationale": target.get("confidence_rationale"),
                "uncertainty": {
                    "status": "not_quantified",
                    "description": "No numeric target-location or science-score uncertainty is supplied.",
                },
                "limitations": target.get("limitations", []),
            },
            "availability": {
                "location": "available" if location else "unavailable",
                "display_policy": "map_feature" if location else "list_only_unlocated",
            },
        })

    payload: dict[str, Any] = {
        "schema_version": "1.0",
        "consumer": consumer,
        "coordinate_reference": {
            "requested_crs": target_crs,
            "coordinate_order": ["x", "y"],
            "transform_policy": "never_relabel_or_guess_crs; transform only with a caller-supplied adapter",
        },
        "targets": output_targets,
    }
    if consumer == "p4_route_planning":
        payload["route_planning_policy"] = {
            "science_priority_role": "soft_preference_only",
            "hard_safety_constraints_are_mandatory": True,
            "science_priority_may_override_hard_safety_constraints": False,
        }
    else:
        payload["map_display_policy"] = {
            "plot_only_targets_with_location": True,
            "unlocated_target_display": "list_only_unlocated",
            "transform_to_map_crs_when_needed": True,
        }
    return payload
