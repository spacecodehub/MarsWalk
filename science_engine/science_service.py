"""Small backend-neutral facade for science catalogue and MEDA summaries."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .meda_processor import process_pressure_product
from .observations import filter_observations, get_observation, load_observations
from .targets import load_targets, rank_targets


class ScienceService:
    def __init__(self, repository_root: str | Path):
        self.root = Path(repository_root)
        self.observations = load_observations(self.root / "data/science/observations/observations.json")
        self.targets = load_targets(
            self.root / "data/science/targets/targets.json",
            {row["record_id"] for row in self.observations},
        )

    def list_observations(self, *, instrument: str | None = None, sol: int | None = None) -> list[dict[str, Any]]:
        return filter_observations(self.observations, instrument=instrument, sol=sol)

    def observation(self, record_id: str) -> dict[str, Any] | None:
        return get_observation(self.observations, record_id)

    def list_targets(self) -> list[dict[str, Any]]:
        return rank_targets(self.targets)

    def target(self, target_id: str) -> dict[str, Any] | None:
        return next((row for row in self.list_targets() if row["target_id"] == target_id), None)

    def meda_pressure_summary(
        self, product_path: str | Path, label_path: str | Path
    ) -> dict[str, Any]:
        """Summarize an explicitly selected PDS product; no implicit data source is configured."""
        summary = process_pressure_product(
            product_path, label_path,
            self.root / "data/science/meda/processed",
            self.root / "data/science/meda/reports",
        )
        summary_path = self.root / "data/science/meda/processed" / summary["summary_json"]
        return json.loads(summary_path.read_text(encoding="utf-8"))
