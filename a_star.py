"""Deterministic, hard-constrained A* route planning on aligned Mars rasters."""

from __future__ import annotations

import heapq
import math
from dataclasses import dataclass
from typing import Any

import numpy as np
from pyproj import CRS as PyprojCRS, Transformer
from rasterio.features import rasterize
from rasterio.warp import transform, transform_geom

from science_adapter import ScienceTarget, science_interest_grid, target_contributions
from terrain_adapter import TerrainLayers


class RouteError(ValueError):
    """Input is invalid or no safe route exists."""


@dataclass(frozen=True)
class SafetyConstraints:
    """Demonstration thresholds; these values are not NASA-certified limits."""

    max_slope_deg: float | None = 25.0
    max_roughness_m: float | None = 10.0
    min_elevation_m: float | None = None
    max_elevation_m: float | None = None

    def __post_init__(self) -> None:
        for name in ("max_slope_deg", "max_roughness_m", "min_elevation_m", "max_elevation_m"):
            value = getattr(self, name)
            if value is not None and not math.isfinite(value):
                raise ValueError(f"{name} must be finite when supplied")
        if self.max_slope_deg is not None and self.max_slope_deg < 0:
            raise ValueError("max_slope_deg cannot be negative")
        if self.max_roughness_m is not None and self.max_roughness_m < 0:
            raise ValueError("max_roughness_m cannot be negative")
        if (self.min_elevation_m is not None and self.max_elevation_m is not None
                and self.min_elevation_m > self.max_elevation_m):
            raise ValueError("minimum elevation must not exceed maximum elevation")


class MarsRoutePlanner:
    MODES = ("shortest", "safest", "science-aware")

    def __init__(
        self,
        layers: TerrainLayers,
        *,
        safety: SafetyConstraints | None = None,
        hazard_features: list[dict[str, Any]] | None = None,
        hazard_crs: str | None = None,
        science_targets: list[ScienceTarget] | None = None,
        science_influence_radius_m: float = 250.0,
        risk_weight: float = 4.0,
        science_weight: float = 0.5,
    ):
        self.layers = layers
        self.crs, self.transform = layers.crs, layers.transform
        self.height, self.width = layers.dem.shape
        self.safety = safety or SafetyConstraints()
        if risk_weight < 0 or not math.isfinite(risk_weight):
            raise ValueError("risk_weight must be finite and non-negative")
        if not 0 <= science_weight < 0.95:
            raise ValueError("science_weight must be in [0, 0.95)")
        self.risk_weight = float(risk_weight)
        self.science_weight = float(science_weight)
        self.science_targets = list(science_targets or [])
        self.science_influence_radius_m = float(science_influence_radius_m)
        if self.science_influence_radius_m <= 0:
            raise ValueError("science_influence_radius_m must be positive")

        self.cell_col = (self.transform.a, self.transform.d)
        self.cell_row = (self.transform.b, self.transform.e)
        self.pixel_width = math.hypot(*self.cell_col)
        self.pixel_height = math.hypot(*self.cell_row)
        if self.pixel_width <= 0 or self.pixel_height <= 0 or not self.crs.is_projected:
            raise ValueError("A non-degenerate projected Mars CRS is required")
        if self.crs.linear_units_factor[0] != "metre":
            raise ValueError("Navigation grid coordinates must be metres")

        arrays = (layers.dem, layers.slope, layers.roughness)
        self.base_valid = np.asarray(layers.valid, dtype=bool).copy()
        for array in arrays:
            self.base_valid &= np.isfinite(array)
        self.reasons: dict[str, np.ndarray] = {
            "nodata_or_uncovered": ~self.base_valid,
            "slope_exceeds_limit": np.zeros(self.base_valid.shape, dtype=bool),
            "roughness_exceeds_limit": np.zeros(self.base_valid.shape, dtype=bool),
            "elevation_out_of_range": np.zeros(self.base_valid.shape, dtype=bool),
            "hazard": np.zeros(self.base_valid.shape, dtype=bool),
        }
        self.reasons["slope_exceeds_limit"] = (
            self.base_valid & (layers.slope > self.safety.max_slope_deg)
            if self.safety.max_slope_deg is not None else self.reasons["slope_exceeds_limit"]
        )
        self.reasons["roughness_exceeds_limit"] = (
            self.base_valid & (layers.roughness > self.safety.max_roughness_m)
            if self.safety.max_roughness_m is not None else self.reasons["roughness_exceeds_limit"]
        )
        elevation_bad = np.zeros(self.base_valid.shape, dtype=bool)
        if self.safety.min_elevation_m is not None:
            elevation_bad |= layers.dem < self.safety.min_elevation_m
        if self.safety.max_elevation_m is not None:
            elevation_bad |= layers.dem > self.safety.max_elevation_m
        self.reasons["elevation_out_of_range"] = self.base_valid & elevation_bad
        if hazard_features:
            self.reasons["hazard"] = self._rasterize_hazards(hazard_features, hazard_crs)

        self.valid = self.base_valid.copy()
        for name, mask in self.reasons.items():
            if name != "nodata_or_uncovered":
                self.valid &= ~mask
        if not np.any(self.valid):
            raise RouteError("No traversable cells remain after hard terrain constraints")

        # Experimental penalty, distinct from the hard slope/roughness masks.
        slope_norm = np.clip(layers.slope / 34.723 * 100.0, 0.0, 100.0)
        rough_norm = np.clip(layers.roughness / 13.039 * 100.0, 0.0, 100.0)
        self.risk = (0.4 * slope_norm + 0.35 * rough_norm) / 0.75
        self.risk[~self.base_valid] = 0.0
        self.science = science_interest_grid(
            self.science_targets, self.base_valid.shape, self.transform,
            self.valid, influence_radius_m=self.science_influence_radius_m,
        )
        self.excluded_counts = {name: int(np.count_nonzero(mask)) for name, mask in self.reasons.items()}

    def _rasterize_hazards(self, features: list[dict[str, Any]], source_crs: str | None) -> np.ndarray:
        geometries = []
        for value in features:
            geometry = value.get("geometry", value) if isinstance(value, dict) else None
            if not isinstance(geometry, dict) or geometry.get("type") not in {"Polygon", "MultiPolygon"}:
                raise RouteError("Hazards must be GeoJSON Polygon or MultiPolygon geometries")
            try:
                if source_crs and str(source_crs) != self.crs.to_string():
                    geometry = transform_geom(source_crs, self.crs, geometry, precision=-1)
                geometries.append((geometry, 1))
            except Exception as exc:
                raise RouteError(f"Could not transform hazard geometry: {exc}") from exc
        return rasterize(
            geometries, out_shape=self.base_valid.shape, transform=self.transform,
            fill=0, all_touched=True, dtype="uint8",
        ).astype(bool)

    def to_map_coordinates(self, point: tuple[float, float] | list[float], input_crs: str | None = None) -> tuple[float, float]:
        if len(point) != 2 or not all(math.isfinite(float(v)) for v in point):
            raise RouteError("Coordinates must be a finite [x, y] pair")
        x, y = float(point[0]), float(point[1])
        if input_crs:
            try:
                xs, ys = transform(input_crs, self.crs, [x], [y])
            except Exception as exc:
                raise RouteError(f"Could not transform coordinates into the terrain CRS: {exc}") from exc
            x, y = float(xs[0]), float(ys[0])
        return x, y

    def coordinate_to_cell(self, x: float, y: float) -> tuple[int, int]:
        colf, rowf = (~self.transform) @ (float(x), float(y))
        row, col = math.floor(rowf), math.floor(colf)
        if not (0 <= row < self.height and 0 <= col < self.width):
            raise RouteError(f"Coordinate ({x}, {y}) is outside covered terrain")
        if not self.valid[row, col]:
            reasons = [name for name, mask in self.reasons.items() if mask[row, col]]
            raise RouteError(f"Coordinate ({x}, {y}) is unsafe or uncovered: {', '.join(reasons)}")
        return row, col

    def cell_to_coordinate(self, row: int, col: int) -> list[float]:
        x = self.transform.c + (col + 0.5) * self.transform.a + (row + 0.5) * self.transform.b
        y = self.transform.f + (col + 0.5) * self.transform.d + (row + 0.5) * self.transform.e
        return [float(x), float(y)]

    def cell_to_mars_geographic(self, row: int, col: int) -> list[float]:
        x, y = self.cell_to_coordinate(row, col)
        try:
            projected = PyprojCRS.from_wkt(self.crs.to_wkt())
            geodetic = projected.geodetic_crs
            lon, lat = Transformer.from_crs(projected, geodetic, always_xy=True).transform(x, y)
        except Exception as exc:
            raise RouteError(f"Could not transform route geometry to Mars geographic coordinates: {exc}") from exc
        return [float(lon), float(lat)]

    def heuristic(self, cell: tuple[int, int], goal: tuple[int, int], mode: str) -> float:
        if mode == "science-aware":
            return 0.0  # Dijkstra: science rewards vary spatially.
        a, b = self.cell_to_coordinate(*cell), self.cell_to_coordinate(*goal)
        return math.hypot(a[0] - b[0], a[1] - b[1])

    def neighbors(self, row: int, col: int):
        for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)):
            nr, nc = row + dr, col + dc
            if not (0 <= nr < self.height and 0 <= nc < self.width and self.valid[nr, nc]):
                continue
            if dr and dc and not (self.valid[row + dr, col] and self.valid[row, col + dc]):
                continue
            dx = dc * self.transform.a + dr * self.transform.b
            dy = dc * self.transform.d + dr * self.transform.e
            yield nr, nc, math.hypot(dx, dy)

    def movement_cost(self, current: tuple[int, int], neighbor: tuple[int, int], distance: float, mode: str) -> float:
        if mode == "shortest":
            return distance
        r1, c1 = current
        r2, c2 = neighbor
        avg_risk = (self.risk[r1, c1] + self.risk[r2, c2]) / 2.0
        multiplier = 1.0 + self.risk_weight * avg_risk / 100.0
        if mode == "science-aware":
            avg_interest = (self.science[r1, c1] + self.science[r2, c2]) / 2.0
            multiplier -= self.science_weight * avg_interest / 100.0
        return distance * max(0.05, float(multiplier))

    def find_path(
        self, start_xy: tuple[float, float] | list[float], goal_xy: tuple[float, float] | list[float],
        mode: str = "safest", *, input_crs: str | None = None,
    ) -> list[tuple[int, int]]:
        if mode == "science":
            mode = "science-aware"  # Compatibility with the original P4 CLI.
        if mode not in self.MODES:
            raise RouteError(f"Unknown route mode {mode!r}; choose from {', '.join(self.MODES)}")
        if mode == "science-aware" and not self.science_targets:
            raise RouteError("Science-aware routing is unavailable: no located, evidence-backed P6 targets")
        start_xy_map = self.to_map_coordinates(start_xy, input_crs)
        goal_xy_map = self.to_map_coordinates(goal_xy, input_crs)
        start = self.coordinate_to_cell(*start_xy_map)
        goal = self.coordinate_to_cell(*goal_xy_map)
        open_heap: list[tuple[float, float, int, int, int]] = []
        serial = 0
        heapq.heappush(open_heap, (self.heuristic(start, goal, mode), 0.0, start[0], start[1], serial))
        g_score = {start: 0.0}
        came_from: dict[tuple[int, int], tuple[int, int]] = {}
        closed: set[tuple[int, int]] = set()
        while open_heap:
            _, popped_g, row, col, _ = heapq.heappop(open_heap)
            current = (row, col)
            if popped_g > g_score.get(current, math.inf) + 1e-10 or current in closed:
                continue
            if current == goal:
                return self.reconstruct_path(came_from, goal)
            closed.add(current)
            for nr, nc, distance in self.neighbors(row, col):
                neighbor = (nr, nc)
                if neighbor in closed:
                    continue
                candidate = popped_g + self.movement_cost(current, neighbor, distance, mode)
                if candidate + 1e-10 < g_score.get(neighbor, math.inf):
                    came_from[neighbor] = current
                    g_score[neighbor] = candidate
                    serial += 1
                    score = candidate + self.heuristic(neighbor, goal, mode)
                    heapq.heappush(open_heap, (score, candidate, nr, nc, serial))
        raise RouteError("No safe route exists between these coordinates under the configured hard constraints")

    @staticmethod
    def reconstruct_path(came_from: dict[tuple[int, int], tuple[int, int]], current: tuple[int, int]) -> list[tuple[int, int]]:
        path = [current]
        while current in came_from:
            current = came_from[current]
            path.append(current)
        path.reverse()
        return path

    def analyze_route(self, path: list[tuple[int, int]], mode: str) -> dict[str, Any]:
        if not path or any(not self.valid[row, col] for row, col in path):
            raise RouteError("Route contains no cells or violates a hard terrain constraint")
        projected = [self.cell_to_coordinate(row, col) for row, col in path]
        geometry = [self.cell_to_mars_geographic(row, col) for row, col in path]
        distance = sum(math.dist(projected[i - 1], projected[i]) for i in range(1, len(projected)))
        rows, cols = zip(*path)
        risks = self.risk[rows, cols]
        slopes = self.layers.slope[rows, cols]
        roughness = self.layers.roughness[rows, cols]
        elevation = self.layers.dem[rows, cols]
        aspect_metrics = {"mean_degrees_clockwise_from_north": None, "valid_cells": 0}
        if self.layers.aspect is not None:
            aspects = self.layers.aspect[rows, cols]
            aspect_meta = self.layers.metadata.get("aspect")
            aspect_valid = np.isfinite(aspects)
            if aspect_meta is not None and aspect_meta.nodata is not None:
                aspect_valid &= aspects != float(aspect_meta.nodata)
            if np.any(aspect_valid):
                radians = np.deg2rad(np.mod(aspects[aspect_valid], 360.0))
                mean_angle = math.degrees(math.atan2(float(np.mean(np.sin(radians))), float(np.mean(np.cos(radians))))) % 360.0
                aspect_metrics = {
                    "mean_degrees_clockwise_from_north": float(mean_angle),
                    "valid_cells": int(np.count_nonzero(aspect_valid)),
                }
        explanations = {
            "shortest": "Minimum-distance path over cells satisfying all configured hard constraints.",
            "safest": "Minimum experimental terrain-cost path over cells satisfying all configured hard constraints.",
            "science-aware": "Risk-weighted path with a bounded evidence-backed science preference; science does not change hard constraints.",
        }
        return {
            "mode": mode, "feasible": True, "distance_m": float(distance),
            "explanation": explanations[mode],
            "average_risk": float(np.mean(risks)), "maximum_risk": float(np.max(risks)),
            "elevation_m": {"minimum": float(np.min(elevation)), "maximum": float(np.max(elevation)), "mean": float(np.mean(elevation))},
            "slope_deg": {"maximum": float(np.max(slopes)), "mean": float(np.mean(slopes))},
            "roughness_m": {"maximum": float(np.max(roughness)), "mean": float(np.mean(roughness))},
            "aspect_deg": aspect_metrics,
            "cells": len(path), "coordinates_projected_m": projected,
            "geometry": {"type": "LineString", "coordinates": geometry},
            "scientific_contribution": target_contributions(
                self.science_targets, projected, self.science_influence_radius_m,
            ) if mode == "science-aware" else [],
            "excluded_cells": self.excluded_counts,
        }

    def plan(self, start_xy, goal_xy, mode: str = "safest", *, input_crs: str | None = None) -> dict[str, Any]:
        if mode == "science":
            mode = "science-aware"
        path = self.find_path(start_xy, goal_xy, mode, input_crs=input_crs)
        result = self.analyze_route(path, mode)
        result["geojson"] = {
            "type": "FeatureCollection",
            "mars_crs_wkt": self.crs.to_wkt(),
            "coordinate_convention": "Mars east-positive longitude, planetocentric latitude; [longitude, latitude]",
            "features": [{
                "type": "Feature",
                "properties": {
                    "route_mode": mode, "distance_m": result["distance_m"],
                    "average_risk": result["average_risk"], "maximum_risk": result["maximum_risk"],
                },
                "geometry": result["geometry"],
            }],
        }
        return result
