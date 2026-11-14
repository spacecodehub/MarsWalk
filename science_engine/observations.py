"""Load and validate provenance-bearing observation catalogue records."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Iterable


class CatalogueError(ValueError):
    """Raised when catalogue records are incomplete or internally inconsistent."""


REQUIRED_FIELDS = ("record_id", "mission", "instrument", "source_url", "description")


def validate_observations(records: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    rows = list(records)
    seen: set[str] = set()
    for index, row in enumerate(rows):
        missing = [field for field in REQUIRED_FIELDS if not row.get(field)]
        if missing:
            raise CatalogueError(f"Observation at index {index} is missing: {', '.join(missing)}")
        record_id = row["record_id"]
        if record_id in seen:
            raise CatalogueError(f"Duplicate observation record_id: {record_id}")
        seen.add(record_id)

        sols = row.get("sols", [])
        if not isinstance(sols, list) or any(not isinstance(sol, int) or sol < 0 for sol in sols):
            raise CatalogueError(f"Observation {record_id} has invalid sols")
        coordinates = row.get("coordinates")
        if coordinates is not None:
            lat, lon = coordinates.get("latitude_deg"), coordinates.get("longitude_east_deg")
            if lat is None or lon is None or not -90 <= lat <= 90 or not 0 <= lon <= 360:
                raise CatalogueError(f"Observation {record_id} has invalid Mars coordinates")
            if not row.get("crs"):
                raise CatalogueError(f"Observation {record_id} has coordinates without a CRS")
    return rows


def load_observations(path: str | Path) -> list[dict[str, Any]]:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(payload, dict) or payload.get("schema_version") != "1.0":
        raise CatalogueError("Observation catalogue must declare schema_version 1.0")
    return validate_observations(payload.get("observations", []))


def get_observation(records: Iterable[dict[str, Any]], record_id: str) -> dict[str, Any] | None:
    return next((row for row in records if row["record_id"] == record_id), None)


def filter_observations(
    records: Iterable[dict[str, Any]], *, instrument: str | None = None, sol: int | None = None
) -> list[dict[str, Any]]:
    rows = list(records)
    if instrument is not None:
        rows = [row for row in rows if row["instrument"].casefold() == instrument.casefold()]
    if sol is not None:
        rows = [row for row in rows if sol in row.get("sols", [])]
    return rows
