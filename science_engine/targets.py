"""Evidence-linked science target validation and heuristic ranking."""

from __future__ import annotations

import json
from math import floor
from pathlib import Path
from typing import Any, Iterable

from .observations import CatalogueError


WEIGHTS = {
    "scientific_significance": 0.25,
    "evidence_strength": 0.25,
    "observation_availability": 0.15,
    "geological_diversity": 0.15,
    "investigation_value": 0.20,
}


def load_targets(path: str | Path, observation_ids: set[str]) -> list[dict[str, Any]]:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(payload, dict) or payload.get("schema_version") != "1.0":
        raise CatalogueError("Target catalogue must declare schema_version 1.0")
    rows = payload.get("targets", [])
    seen: set[str] = set()
    for target in rows:
        target_id = target.get("target_id")
        if not target_id or target_id in seen:
            raise CatalogueError(f"Missing or duplicate target_id: {target_id}")
        seen.add(target_id)
        if not target.get("evidence_sources"):
            raise CatalogueError(f"Target {target_id} has no evidence source")
        missing = set(target.get("supporting_observation_ids", [])) - observation_ids
        if missing:
            raise CatalogueError(f"Target {target_id} references unknown observations: {sorted(missing)}")
        coords = target.get("coordinates")
        if coords is not None:
            lat, lon = coords.get("latitude_deg"), coords.get("longitude_east_deg")
            if lat is None or lon is None or not -90 <= lat <= 90 or not 0 <= lon <= 360 or not target.get("crs"):
                raise CatalogueError(f"Target {target_id} has invalid coordinates or missing CRS")
    return rows


def score_target(target: dict[str, Any]) -> dict[str, Any] | None:
    """Return the documented P6 heuristic score, or None if inputs are incomplete."""
    inputs = target.get("priority_inputs", {})
    if set(inputs) != set(WEIGHTS):
        return None
    values = {key: float(value) for key, value in inputs.items()}
    if any(not 0 <= value <= 4 for value in values.values()):
        raise CatalogueError("Priority inputs must be on the documented 0–4 rubric")
    score = 100 * sum(values[key] * weight for key, weight in WEIGHTS.items()) / 4
    return {
        "score": floor(score * 10 + 0.5) / 10,
        "scale": "0-100",
        "method": "Saniya project heuristic v1 (not a NASA standard)",
        "weights": WEIGHTS.copy(),
        "inputs": values,
        "excludes": ["terrain danger", "accessibility", "route distance", "route safety"],
    }


def rank_targets(targets: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    ranked = []
    for target in targets:
        score = score_target(target)
        ranked.append({**target, "scientific_priority": score})
    return sorted(ranked, key=lambda item: (item["scientific_priority"] is None,
                                           -(item["scientific_priority"]["score"] if item["scientific_priority"] else -1)))
