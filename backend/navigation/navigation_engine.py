"""Stable application-facing navigation helpers."""

from __future__ import annotations

from typing import Any

from .a_star import MarsRoutePlanner, RouteError, SafetyConstraints
from .terrain_adapter import P2TerrainAdapter, load_aligned_terrain


def build_planner(
    *,
    terrain_dir: str | None = None,
    dem_path: str | None = None,
    slope_path: str | None = None,
    roughness_path: str | None = None,
    aspect_path: str | None = None,
    safety: SafetyConstraints | None = None,
    hazard_features: list[dict[str, Any]] | None = None,
    hazard_crs: str | None = None,
    science_targets=None,
    risk_weight: float = 4.0,
    science_weight: float = 0.5,
) -> MarsRoutePlanner:
    if terrain_dir:
        layers = P2TerrainAdapter(terrain_dir).load()
    elif dem_path and slope_path and roughness_path:
        layers = load_aligned_terrain(dem_path, slope_path, roughness_path, aspect_path)
    else:
        raise RouteError("Configure a terrain directory or aligned DEM, slope, and roughness rasters")
    return MarsRoutePlanner(
        layers, safety=safety, hazard_features=hazard_features, hazard_crs=hazard_crs,
        science_targets=science_targets, risk_weight=risk_weight, science_weight=science_weight,
    )


def navigate(
    start: tuple[float, float] | list[float],
    end: tuple[float, float] | list[float],
    mode: str = "safest",
    *,
    planner: MarsRoutePlanner | None = None,
    input_crs: str | None = None,
    **planner_options: Any,
) -> dict[str, Any]:
    """Plan one route and return metrics plus GeoJSON.

    A caller may pass a preloaded planner or its aligned raster configuration.
    Errors are explicit exceptions so API/CLI clients can report them without
    silently substituting a fallback route.
    """
    try:
        active = planner or build_planner(**planner_options)
        result = active.plan(start, end, mode, input_crs=input_crs)
        return {
            **result, "success": True, "coordinates": result["geometry"]["coordinates"],
            "geojson_path": None, "error": None,
        }
    except (RouteError, OSError) as exc:
        return {
            "success": False, "feasible": False, "mode": mode,
            "start": list(start), "destination": list(end), "error": str(exc),
        }
