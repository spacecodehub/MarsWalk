"""Raster loading and validation for MarsWalk navigation inputs.

The P2 adapter deliberately reads the documented 5 m HiRISE analysis grid.
It never resamples safety layers: a mismatch is an error, since interpolation
could conceal uncovered or unsafe terrain.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.transform import Affine


P2_BASENAME = "DTEEC_022680_1985_022746_1985_A01"
P2_FILES = {
    "dem": f"{P2_BASENAME}_dem_5m.tif",
    "slope": f"{P2_BASENAME}_slope_deg.tif",
    "aspect": f"{P2_BASENAME}_aspect_deg.tif",
    "roughness": f"{P2_BASENAME}_roughness_3x3_m.tif",
}
P2_EXPECTED_SHAPE = (3224, 1517)
P2_EXPECTED_RESOLUTION_M = (5.0, 5.0)
P2_EXPECTED_ORIGIN = (-3955.009842, 1088362.771)


class TerrainDataError(ValueError):
    """Raised when input rasters cannot safely be combined."""


@dataclass(frozen=True)
class RasterMetadata:
    path: str
    width: int
    height: int
    crs_wkt: str
    transform: tuple[float, ...]
    bounds: tuple[float, float, float, float]
    resolution: tuple[float, float]
    dtype: str
    nodata: float | None
    unit: str | None


@dataclass
class TerrainLayers:
    dem: np.ndarray
    slope: np.ndarray
    roughness: np.ndarray
    aspect: np.ndarray | None
    valid: np.ndarray
    crs: CRS
    transform: Affine
    metadata: dict[str, RasterMetadata]


def _read_band(path: Path) -> tuple[np.ndarray, np.ndarray, RasterMetadata, CRS, Affine]:
    if not path.is_file():
        raise TerrainDataError(f"Terrain layer is missing: {path}")
    with rasterio.open(path) as src:
        if src.count != 1:
            raise TerrainDataError(f"Expected one band in {path}")
        if src.crs is None:
            raise TerrainDataError(f"Raster has no CRS: {path}")
        values = src.read(1, masked=True).astype(np.float64)
        raw = np.asarray(values.filled(np.nan), dtype=np.float64)
        valid = ~np.ma.getmaskarray(values) & np.isfinite(raw)
        # Some drivers fail to mask a floating-point NoData sentinel reliably.
        if src.nodata is not None:
            if np.isnan(src.nodata):
                valid &= ~np.isnan(raw)
            else:
                valid &= raw != float(src.nodata)
        meta = RasterMetadata(
            path=str(path), width=src.width, height=src.height,
            crs_wkt=src.crs.to_wkt(), transform=tuple(src.transform),
            bounds=(src.bounds.left, src.bounds.bottom, src.bounds.right, src.bounds.top),
            resolution=(abs(src.transform.a), abs(src.transform.e)),
            dtype=src.dtypes[0], nodata=src.nodata,
            unit=src.units[0] if src.units else None,
        )
        return raw, valid, meta, src.crs, src.transform


class P2TerrainAdapter:
    """Load P2's documented terrain products from a local checkout."""

    def __init__(self, terrain_dir: str | Path, *, validate_documented_grid: bool = True):
        self.root = Path(terrain_dir)
        self.validate_documented_grid = validate_documented_grid

    def paths(self) -> dict[str, Path]:
        return {key: self.root / name for key, name in P2_FILES.items()}

    def available(self) -> bool:
        return all(path.is_file() for path in self.paths().values())

    def inspect(self) -> dict[str, Any]:
        result: dict[str, Any] = {"available": self.available(), "source": "P2 HiRISE stereo footprint"}
        result["layers"] = {}
        for key, path in self.paths().items():
            if not path.is_file():
                result["layers"][key] = {"available": False, "path": str(path)}
                continue
            _, _, metadata, _, _ = _read_band(path)
            result["layers"][key] = {"available": True, **metadata.__dict__}
        if not result["available"]:
            result["limitation"] = "P2 terrain products are not present in this checkout; they are on open PR #5."
        return result

    def load(self) -> TerrainLayers:
        if not self.available():
            missing = [str(p) for p in self.paths().values() if not p.is_file()]
            raise TerrainDataError("P2 terrain layers are unavailable: " + ", ".join(missing))
        arrays: dict[str, np.ndarray] = {}
        masks: list[np.ndarray] = []
        metadata: dict[str, RasterMetadata] = {}
        grid_crs: CRS | None = None
        grid_transform: Affine | None = None
        grid_shape: tuple[int, int] | None = None
        for key, path in self.paths().items():
            values, valid, meta, crs, transform = _read_band(path)
            shape = values.shape
            if grid_crs is None:
                grid_crs, grid_transform, grid_shape = crs, transform, shape
            elif crs != grid_crs or transform != grid_transform or shape != grid_shape:
                raise TerrainDataError(f"P2 {key} raster is not aligned to the common analysis grid")
            arrays[key], metadata[key] = values, meta
            if key != "aspect":
                masks.append(valid)
        assert grid_crs is not None and grid_transform is not None
        if self.validate_documented_grid:
            self._validate_documented_grid(grid_shape, grid_transform, metadata)
        valid = np.logical_and.reduce(masks)
        valid &= arrays["slope"] >= 0
        valid &= arrays["roughness"] >= 0
        if not np.any(valid):
            raise TerrainDataError("P2 rasters have no common valid terrain cells")
        return TerrainLayers(
            dem=arrays["dem"], slope=arrays["slope"], roughness=arrays["roughness"],
            aspect=arrays["aspect"], valid=valid, crs=grid_crs,
            transform=grid_transform, metadata=metadata,
        )

    @staticmethod
    def _validate_documented_grid(
        shape: tuple[int, int] | None, transform: Affine,
        metadata: dict[str, RasterMetadata],
    ) -> None:
        if shape != P2_EXPECTED_SHAPE:
            raise TerrainDataError(f"P2 grid dimensions must be {P2_EXPECTED_SHAPE}, got {shape}")
        if not np.allclose((abs(transform.a), abs(transform.e)), P2_EXPECTED_RESOLUTION_M, atol=1e-6):
            raise TerrainDataError("P2 grid resolution must be 5 metres")
        if not np.allclose((transform.b, transform.d), (0.0, 0.0), atol=1e-9):
            raise TerrainDataError("P2 analysis grid must be north-up")
        if not np.allclose((transform.c, transform.f), P2_EXPECTED_ORIGIN, atol=0.01):
            raise TerrainDataError("P2 grid origin does not match the documented HiRISE footprint")
        dem, slope, aspect, rough = (metadata[k] for k in ("dem", "slope", "aspect", "roughness"))
        wkt = dem.crs_wkt.lower()
        if "equirectangular" not in wkt or "77.44" not in wkt or "3394839.813" not in wkt:
            raise TerrainDataError("P2 CRS must be the documented local Mars Equirectangular CRS")
        if dem.unit and dem.unit.lower() not in {"m", "metre", "meter", "metres", "meters"}:
            raise TerrainDataError(f"P2 DEM units must be metres, got {dem.unit!r}")
        if slope.unit and slope.unit.lower() not in {"degree", "degrees", "deg"}:
            raise TerrainDataError(f"P2 slope units must be degrees, got {slope.unit!r}")
        if rough.unit and rough.unit.lower() not in {"m", "metre", "meter", "metres", "meters"}:
            raise TerrainDataError(f"P2 roughness units must be metres, got {rough.unit!r}")
        if aspect.nodata is None:
            raise TerrainDataError("P2 aspect layer must mark flat cells as NoData")


def load_aligned_terrain(
    dem_path: str | Path, slope_path: str | Path, roughness_path: str | Path,
    aspect_path: str | Path | None = None,
) -> TerrainLayers:
    """Load generic aligned rasters for tests and non-P2 demonstration inputs."""
    paths = {"dem": Path(dem_path), "slope": Path(slope_path), "roughness": Path(roughness_path)}
    if aspect_path is not None:
        paths["aspect"] = Path(aspect_path)
    arrays, masks, metadata = {}, [], {}
    grid_crs = grid_transform = grid_shape = None
    for key, path in paths.items():
        values, valid, meta, crs, transform = _read_band(path)
        if grid_crs is None:
            grid_crs, grid_transform, grid_shape = crs, transform, values.shape
        elif crs != grid_crs or transform != grid_transform or values.shape != grid_shape:
            raise TerrainDataError(f"{key} raster CRS, transform, or dimensions do not match DEM")
        arrays[key], metadata[key] = values, meta
        if key != "aspect":
            masks.append(valid)
    if grid_crs is None or grid_transform is None:
        raise TerrainDataError("No terrain layers were provided")
    valid = np.logical_and.reduce(masks)
    valid &= arrays["slope"] >= 0
    valid &= arrays["roughness"] >= 0
    expected_units = {"dem": {"m", "metre", "meter", "metres", "meters"},
                      "slope": {"degree", "degrees", "deg"},
                      "roughness": {"m", "metre", "meter", "metres", "meters"},
                      "aspect": {"degree", "degrees", "deg"}}
    for key, meta in metadata.items():
        unit = meta.unit.lower() if meta.unit else None
        if unit not in expected_units[key]:
            raise TerrainDataError(f"{key} raster must declare units {sorted(expected_units[key])}; got {meta.unit!r}")
    return TerrainLayers(
        dem=arrays["dem"], slope=arrays["slope"], roughness=arrays["roughness"],
        aspect=arrays.get("aspect"), valid=valid, crs=grid_crs,
        transform=grid_transform, metadata=metadata,
    )
