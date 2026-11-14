"""GDAL point-sampling adapter for the local HiRISE terrain bundle."""

import math
from pathlib import Path

from osgeo import gdal, osr

from build_terrain_products import ANALYSIS_DEM_PATH, OUTPUTS, OUTPUT_DIRECTORY


RASTER_PATHS = {
    "elevation_m": ANALYSIS_DEM_PATH,
    "slope_deg": OUTPUT_DIRECTORY / OUTPUTS["slope"][0],
    "aspect_deg": OUTPUT_DIRECTORY / OUTPUTS["aspect"][0],
    "roughness_m": OUTPUT_DIRECTORY / OUTPUTS["roughness"][0],
}
EXPECTED_KEYS = frozenset(RASTER_PATHS)

gdal.DontUseExceptions()


class TerrainSampler:
    """Read aligned terrain rasters and reject unsupported projected points."""

    def __init__(self, raster_paths=None):
        self.raster_paths = raster_paths if raster_paths is not None else RASTER_PATHS
        if set(self.raster_paths) != EXPECTED_KEYS:
            raise ValueError(
                f"Terrain bundle must contain exactly: {sorted(EXPECTED_KEYS)}"
            )
        self.datasets = {}
        self.projection = None
        self.transform = None

        for key, path in self.raster_paths.items():
            path = Path(path)
            if not path.is_file():
                raise FileNotFoundError(f"Terrain raster is missing: {path}")
            dataset = gdal.Open(str(path), gdal.GA_ReadOnly)
            if dataset is None or dataset.RasterCount != 1:
                raise RuntimeError(f"Cannot open single-band terrain raster: {path}")

            band = dataset.GetRasterBand(1)
            if band.GetNoDataValue() is None:
                raise RuntimeError(f"Terrain raster has no NoData value: {path}")

            if self.transform is None:
                self.transform = dataset.GetGeoTransform()
                self.projection = dataset.GetProjectionRef()
                self.width = dataset.RasterXSize
                self.height = dataset.RasterYSize
                if not self.projection:
                    raise ValueError(f"Terrain raster has no projected CRS: {path}")
                spatial_reference = osr.SpatialReference(wkt=self.projection)
                if not spatial_reference.IsProjected():
                    raise ValueError(f"Terrain raster has no projected CRS: {path}")
                if not math.isclose(
                    spatial_reference.GetLinearUnits(), 1.0, rel_tol=0, abs_tol=1e-9
                ):
                    raise ValueError(f"Terrain CRS units are not metres: {path}")
                if not math.isclose(
                    abs(self.transform[1]), 5.0, rel_tol=0, abs_tol=1e-6
                ) or not math.isclose(
                    abs(self.transform[5]), 5.0, rel_tol=0, abs_tol=1e-6
                ):
                    raise ValueError(f"Terrain grid is not 5 m: {path}")
            elif (
                dataset.RasterXSize != self.width
                or dataset.RasterYSize != self.height
                or dataset.GetGeoTransform() != self.transform
                or not osr.SpatialReference(wkt=dataset.GetProjectionRef()).IsSame(
                    osr.SpatialReference(wkt=self.projection)
                )
            ):
                raise ValueError(f"Terrain raster is not aligned with the bundle: {path}")

            expected_unit = "degree" if key.endswith("_deg") else "m"
            if band.GetUnitType() != expected_unit:
                raise ValueError(
                    f"Unexpected unit for {key}: {band.GetUnitType()!r}"
                )
            self.datasets[key] = dataset

        determinant = self.transform[1] * self.transform[5] - (
            self.transform[2] * self.transform[4]
        )
        if determinant == 0:
            raise ValueError("Terrain grid has a non-invertible affine transform.")
        self.determinant = determinant

    def sample(self, easting_m, northing_m):
        """Return metrics only when the projected point is inside valid coverage."""
        column_coordinate = (
            (easting_m - self.transform[0]) * self.transform[5]
            - (northing_m - self.transform[3]) * self.transform[2]
        ) / self.determinant
        row_coordinate = (
            (northing_m - self.transform[3]) * self.transform[1]
            - (easting_m - self.transform[0]) * self.transform[4]
        ) / self.determinant
        column = math.floor(column_coordinate)
        row = math.floor(row_coordinate)

        if column < 0 or row < 0 or column >= self.width or row >= self.height:
            return {"supported": False, "reason": "outside_coverage"}

        values = {}
        for key, dataset in self.datasets.items():
            band = dataset.GetRasterBand(1)
            value = float(band.ReadAsArray(column, row, 1, 1)[0, 0])
            mask = band.GetMaskBand().ReadAsArray(column, row, 1, 1)[0, 0]
            nodata = band.GetNoDataValue()
            if mask == 0 or not math.isfinite(value) or value == nodata:
                return {"supported": False, "reason": "nodata"}
            values[key] = value

        return {
            "supported": True,
            "pixel": {"column": column, "row": row},
            "values": values,
        }
