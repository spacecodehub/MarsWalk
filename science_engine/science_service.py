"""Small backend-neutral facade for science catalogue and MEDA summaries."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .meda_processor import process_pressure_product
from .observations import filter_observations, get_observation, load_observations
from .target_integration import CoordinateTransform, serialize_science_targets
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

    def targets_for_p4_route_planning(
        self,
        *,
        target_crs: str | None = None,
        target_units: str | None = None,
        coordinate_transform: CoordinateTransform | None = None,
    ) -> dict[str, Any]:
        """Return science advisory targets; P4 remains responsible for route safety."""
        return serialize_science_targets(
            self.list_targets(), self.observations,
            consumer="p4_route_planning",
            target_crs=target_crs,
            target_units=target_units,
            coordinate_transform=coordinate_transform,
        )

    def targets_for_p5_map(
        self,
        *,
        target_crs: str | None = None,
        target_units: str | None = None,
        coordinate_transform: CoordinateTransform | None = None,
    ) -> dict[str, Any]:
        """Return source-linked targets; P5 should list targets without locations."""
        return serialize_science_targets(
            self.list_targets(), self.observations,
            consumer="p5_map_visualization",
            target_crs=target_crs,
            target_units=target_units,
            coordinate_transform=coordinate_transform,
        )

    def meda_pressure_summary(
        self,
        product_path: str | Path,
        label_path: str | Path,
        *,
        output_dir: str | Path,
        report_dir: str | Path,
        overwrite: bool = False,
    ) -> dict[str, Any]:
        """Summarize an explicit product into caller-selected output directories.

        Existing generated files are preserved unless ``overwrite=True`` is
        explicitly requested. The selected CSV and label are never output paths.
        """
        summary = process_pressure_product(
            product_path, label_path,
            output_dir,
            report_dir,
            overwrite=overwrite,
        )
        summary_path = Path(output_dir) / summary["summary_json"]
        return json.loads(summary_path.read_text(encoding="utf-8"))
