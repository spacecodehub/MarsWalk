"""Adapter for the unmerged P6 science-target catalogue contract."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
from rasterio.warp import transform


P6_WEIGHTS = {
    "scientific_significance": 0.25,
    "evidence_strength": 0.25,
    "observation_availability": 0.15,
    "geological_diversity": 0.15,
    "investigation_value": 0.20,
}


class ScienceDataError(ValueError):
    """Raised when P6 target metadata is malformed."""


@dataclass(frozen=True)
class ScienceTarget:
    target_id: str
    name: str
    category: str
    x: float
    y: float
    priority: float
    provenance: tuple[str, ...]
    evidence: tuple[str, ...]


def _score(target: dict[str, Any]) -> float | None:
    inputs = target.get("priority_inputs")
    if not isinstance(inputs, dict) or set(inputs) != set(P6_WEIGHTS):
        return None
    try:
        values = {key: float(inputs[key]) for key in P6_WEIGHTS}
    except (TypeError, ValueError) as exc:
        raise ScienceDataError(f"Target {target.get('target_id')} has invalid priority inputs") from exc
    if any(not np.isfinite(value) or not 0 <= value <= 4 for value in values.values()):
        raise ScienceDataError("P6 priority inputs must be finite values on the documented 0–4 rubric")
    return round(100 * sum(values[key] * weight for key, weight in P6_WEIGHTS.items()) / 4, 1)


class P6ScienceAdapter:
    """Read P6 targets and associate only georeferenced targets with a grid.

    The current P6 PR contains one real target whose coordinates and CRS are
    null. That record remains visible in ``unlocated`` and earns no route
    reward until provenance-backed coordinates are supplied.
    """

    def __init__(self, catalogue_path: str | Path):
        self.path = Path(catalogue_path)

    def load(self, grid_crs: Any) -> tuple[list[ScienceTarget], list[dict[str, Any]]]:
        if not self.path.is_file():
            return [], [{"reason": "P6 catalogue is not present in this checkout", "path": str(self.path)}]
        try:
            payload = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise ScienceDataError(f"Cannot read P6 target catalogue: {exc}") from exc
        if not isinstance(payload, dict) or payload.get("schema_version") != "1.0":
            raise ScienceDataError("P6 target catalogue must declare schema_version 1.0")
        rows = payload.get("targets")
        if not isinstance(rows, list):
            raise ScienceDataError("P6 target catalogue must contain a targets list")
        located: list[ScienceTarget] = []
        unlocated: list[dict[str, Any]] = []
        seen: set[str] = set()
        for target in rows:
            if not isinstance(target, dict):
                raise ScienceDataError("Each P6 target must be an object")
            target_id = target.get("target_id")
            if not isinstance(target_id, str) or not target_id or target_id in seen:
                raise ScienceDataError(f"Missing or duplicate P6 target_id: {target_id!r}")
            seen.add(target_id)
            evidence = target.get("evidence_sources")
            if not isinstance(evidence, list) or not evidence:
                raise ScienceDataError(f"Target {target_id} has no evidence_sources")
            priority = _score(target)
            if priority is None:
                # Incomplete P6 score inputs cannot be replaced with invented weights.
                unlocated.append({"target_id": target_id, "name": target.get("name"), "reason": "incomplete documented priority inputs"})
                continue
            coords = target.get("coordinates")
            source_crs = target.get("crs")
            if coords is None or source_crs is None:
                unlocated.append({
                    "target_id": target_id, "name": target.get("name"),
                    "reason": "P6 target has no coordinates or CRS",
                    "provenance": [item.get("url", "") for item in evidence if isinstance(item, dict)],
                })
                continue
            try:
                lat = float(coords["latitude_deg"])
                lon = float(coords["longitude_east_deg"])
                if not np.isfinite(lat) or not np.isfinite(lon) or not -90 <= lat <= 90:
                    raise ValueError
                xs, ys = transform(source_crs, grid_crs, [lon], [lat])
            except Exception as exc:
                raise ScienceDataError(f"Target {target_id} has invalid coordinates or CRS: {exc}") from exc
            located.append(ScienceTarget(
                target_id=target_id, name=str(target.get("name") or target_id),
                category=str(target.get("geological_category") or "unspecified"),
                x=float(xs[0]), y=float(ys[0]), priority=priority,
                provenance=tuple(str(item.get("url", "")) for item in evidence if isinstance(item, dict)),
                evidence=tuple(str(item.get("supports", "")) for item in evidence if isinstance(item, dict)),
            ))
        return located, unlocated


def science_interest_grid(
    targets: list[ScienceTarget], shape: tuple[int, int], transform_affine: Any,
    valid: np.ndarray, *, influence_radius_m: float = 250.0,
) -> np.ndarray:
    """Create deterministic, bounded spatial interest around located targets."""
    if influence_radius_m <= 0:
        raise ValueError("science influence radius must be positive")
    rows, cols = np.indices(shape)
    # Cell-center map coordinates work with rotated and sheared affine grids.
    xs = transform_affine.c + (cols + 0.5) * transform_affine.a + (rows + 0.5) * transform_affine.b
    ys = transform_affine.f + (cols + 0.5) * transform_affine.d + (rows + 0.5) * transform_affine.e
    interest = np.zeros(shape, dtype=np.float32)
    for target in targets:
        distance = np.hypot(xs - target.x, ys - target.y)
        within = distance <= influence_radius_m
        contribution = target.priority * np.clip(1 - distance / influence_radius_m, 0, 1)
        interest = np.maximum(interest, np.where(within, contribution, 0).astype(np.float32))
    interest[~valid] = 0
    return interest


def target_contributions(targets: list[ScienceTarget], route_xy: list[list[float]], radius_m: float) -> list[dict[str, Any]]:
    """Report located P6 targets approached by a returned route."""
    if not targets or not route_xy:
        return []
    route = np.asarray(route_xy, dtype=float)
    result = []
    for target in targets:
        distance = float(np.min(np.hypot(route[:, 0] - target.x, route[:, 1] - target.y)))
        if distance <= radius_m:
            result.append({
                "target_id": target.target_id, "name": target.name,
                "category": target.category, "priority": target.priority,
                "distance_to_route_m": distance,
                "provenance": list(target.provenance), "evidence": list(target.evidence),
            })
    return result
