"""FastAPI endpoints for MarsWalk terrain-aware route planning."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Literal

from fastapi import APIRouter, FastAPI, HTTPException
from pydantic import BaseModel, Field

from .a_star import MarsRoutePlanner, RouteError, SafetyConstraints
from .compare_routes import compare_routes
from .science_adapter import P6ScienceAdapter, ScienceDataError
from .terrain_adapter import P2TerrainAdapter, TerrainDataError


ROOT = Path(__file__).resolve().parent
DEFAULT_TERRAIN_DIR = ROOT / "GIS" / "processed" / "hirise_terrain"
DEFAULT_TARGETS = ROOT / "data" / "science" / "targets" / "targets.json"
router = APIRouter(tags=["navigation"])


class SafetyRequest(BaseModel):
    max_slope_deg: float | None = Field(default=25.0, ge=0)
    max_roughness_m: float | None = Field(default=10.0, ge=0)
    min_elevation_m: float | None = None
    max_elevation_m: float | None = None


class RouteRequest(BaseModel):
    start: list[float] = Field(min_length=2, max_length=2)
    destination: list[float] = Field(min_length=2, max_length=2)
    mode: Literal["shortest", "safest", "science-aware"] = "safest"
    coordinates_crs: str | None = None
    safety: SafetyRequest = Field(default_factory=SafetyRequest)
    hazard_geojson: dict[str, Any] | None = None
    hazard_crs: str | None = None


def _terrain_directory() -> Path:
    return Path(os.environ.get("MARSWALK_TERRAIN_DIR", DEFAULT_TERRAIN_DIR))


def _terrain_configuration() -> dict[str, str]:
    env_paths = {
        "dem_path": os.environ.get("MARSWALK_DEM_PATH"),
        "slope_path": os.environ.get("MARSWALK_SLOPE_PATH"),
        "roughness_path": os.environ.get("MARSWALK_ROUGHNESS_PATH"),
        "aspect_path": os.environ.get("MARSWALK_ASPECT_PATH"),
    }
    if all(env_paths.get(key) for key in ("dem_path", "slope_path", "roughness_path")):
        return {key: value for key, value in env_paths.items() if value}
    return {"terrain_dir": str(_terrain_directory())}


def _safety(req: SafetyRequest) -> SafetyConstraints:
    try:
        return SafetyConstraints(
            max_slope_deg=req.max_slope_deg,
            max_roughness_m=req.max_roughness_m,
            min_elevation_m=req.min_elevation_m,
            max_elevation_m=req.max_elevation_m,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


def _hazards(req: RouteRequest) -> tuple[list[dict[str, Any]] | None, str | None]:
    if req.hazard_geojson is None:
        return None, req.hazard_crs
    value = req.hazard_geojson
    if value.get("type") == "FeatureCollection":
        features = value.get("features", [])
        if not isinstance(features, list) or not features:
            raise HTTPException(status_code=422, detail="hazard_geojson FeatureCollection must contain Polygon features")
        geometries = [f.get("geometry") for f in features if isinstance(f, dict)]
    elif value.get("type") == "Feature":
        geometries = [value.get("geometry")]
    else:
        geometries = [value]
    if not geometries or any(geometry is None for geometry in geometries):
        raise HTTPException(status_code=422, detail="Each hazard feature must contain a Polygon or MultiPolygon geometry")
    return geometries, req.hazard_crs


def _planner(req: RouteRequest) -> MarsRoutePlanner:
    target_path = Path(os.environ.get("MARSWALK_P6_TARGETS", DEFAULT_TARGETS))
    hazards, hazard_crs = _hazards(req)
    try:
        layers = _terrain_configuration()
        # Load the terrain once to obtain its CRS for the P6 coordinate adapter.
        from .terrain_adapter import P2TerrainAdapter, load_aligned_terrain
        loaded = P2TerrainAdapter(layers["terrain_dir"]).load() if "terrain_dir" in layers else load_aligned_terrain(
            layers["dem_path"], layers["slope_path"], layers["roughness_path"], layers.get("aspect_path"),
        )
        targets, _ = P6ScienceAdapter(target_path).load(loaded.crs)
        return MarsRoutePlanner(
            loaded, safety=_safety(req.safety), hazard_features=hazards,
            hazard_crs=hazard_crs, science_targets=targets,
        )
    except (TerrainDataError, ScienceDataError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except (RouteError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


def _plan(planner: MarsRoutePlanner, req: RouteRequest) -> dict[str, Any]:
    try:
        return planner.plan(req.start, req.destination, req.mode, input_crs=req.coordinates_crs)
    except RouteError as exc:
        status = 409 if "No safe route" in str(exc) else 422
        raise HTTPException(status_code=status, detail=str(exc)) from exc


@router.get("/health")
def health() -> dict[str, Any]:
    config = _terrain_configuration()
    if "terrain_dir" in config:
        available = P2TerrainAdapter(config["terrain_dir"]).available()
    else:
        available = all(Path(config[key]).is_file() for key in ("dem_path", "slope_path", "roughness_path"))
    targets = Path(os.environ.get("MARSWALK_P6_TARGETS", DEFAULT_TARGETS))
    return {"status": "ok", "terrain_available": available, "science_catalogue_available": targets.is_file()}


@router.get("/navigation/layers")
def layers() -> dict[str, Any]:
    config = _terrain_configuration()
    if "terrain_dir" in config:
        details = P2TerrainAdapter(config["terrain_dir"], validate_documented_grid=False).inspect()
    else:
        details = {"available": True, "source": "configured aligned raster set", "layers": {}}
        from .terrain_adapter import _read_band
        for key, path in config.items():
            try:
                _, _, meta, _, _ = _read_band(Path(path))
                details["layers"][key.removesuffix("_path")] = {"available": True, **meta.__dict__}
            except TerrainDataError as exc:
                details["available"] = False
                details["layers"][key.removesuffix("_path")] = {"available": False, "error": str(exc)}
    details["coverage"] = "P2 data cover only the HiRISE stereo footprint; no routing outside valid raster coverage."
    details["alignment"] = {
        "relative_estimate": "12-tie median CTX-relative displacement: 10 m west, 55 m south; component MAD 5 m",
        "absolute_accuracy": "unverified; possible 100–200 m SIM offset remains unresolved",
    }
    return details


@router.post("/navigation/route")
def route(req: RouteRequest) -> dict[str, Any]:
    return _plan(_planner(req), req)


@router.post("/navigation/compare")
def compare(req: RouteRequest) -> dict[str, Any]:
    planner = _planner(req)
    return compare_routes(planner, req.start, req.destination, input_crs=req.coordinates_crs)


@router.post("/navigation/feasibility")
def feasibility(req: RouteRequest) -> dict[str, Any]:
    planner = _planner(req)
    try:
        start_xy = planner.to_map_coordinates(req.start, req.coordinates_crs)
        end_xy = planner.to_map_coordinates(req.destination, req.coordinates_crs)
        start_cell = planner.coordinate_to_cell(*start_xy)
        end_cell = planner.coordinate_to_cell(*end_xy)
        path = planner.find_path(req.start, req.destination, "shortest", input_crs=req.coordinates_crs)
        return {
            "feasible": True, "start_cell": list(start_cell), "destination_cell": list(end_cell),
            "path_cells": len(path), "excluded_cells": planner.excluded_counts,
            "explanation": "A path exists without relaxing any configured hard terrain constraints.",
        }
    except RouteError as exc:
        return {"feasible": False, "reason": str(exc), "excluded_cells": planner.excluded_counts}


# The P5/backend branch currently places FastAPI resources below /api. Expose
# aliases on that prefix while retaining the standalone route paths requested
# for this service. Both prefixes call the same handlers and schemas.
app = FastAPI(title="MarsWalk Navigation API", version="1.0.0")
app.include_router(router)
app.include_router(router, prefix="/api")
