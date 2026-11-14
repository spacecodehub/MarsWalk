"""Read-only validation of the MarsWalk GIS source products."""

import csv
import hashlib
import subprocess
from pathlib import Path

from osgeo import gdal, ogr, osr

from gis_common import (
    PRODUCTS,
    REPOSITORY_ROOT,
    SIM_ROOT,
    find_git_executable,
    raster_corners,
    relative_path,
)

gdal.DontUseExceptions()
ogr.DontUseExceptions()


DOCUMENTATION = REPOSITORY_ROOT / "GIS" / "documentation"
GIT_EXECUTABLE = find_git_executable()
REGIONAL_RASTERS = [product for product in PRODUCTS if product["path"].suffix.lower() in (".tif", ".img", ".jp2")]
VALIDATION_FIELDS = [
    "product_id",
    "path",
    "exists",
    "gdal_open",
    "driver",
    "dimensions",
    "bands",
    "data_type",
    "pixel_spacing",
    "nodata",
    "native_crs",
    "native_extent",
    "vertical_units",
    "vertical_reference",
    "source_label",
    "sha256",
    "tracked",
    "remote_main",
    "validation_result",
    "limitations",
]
OVERLAP_FIELDS = [
    "raster_product_id",
    "study_boundary_layer",
    "same_native_crs",
    "intersection",
    "intersection_area_fraction",
    "transformation",
    "notes",
]
VECTOR_FIELDS = [
    "layer",
    "geometry_type",
    "feature_count",
    "crs",
    "extent",
    "fields",
    "invalid_geometry_count",
    "geometry_validation",
]


def git(*args):
    return subprocess.run(
        [GIT_EXECUTABLE, "-C", str(REPOSITORY_ROOT), *args],
        capture_output=True,
        check=False,
        text=True,
    )


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def relative_tracking(path):
    relative = relative_path(path)
    tracked = git("ls-files", "--error-unmatch", relative)
    if tracked.returncode != 0:
        return "no", "no"
    remote = git("cat-file", "-e", f"origin/main:{relative}")
    return "yes", "yes" if remote.returncode == 0 else "no"


def native_extent(dataset):
    transform = dataset.GetGeoTransform(can_return_null=True)
    if transform is None:
        return "not georeferenced"
    corners = raster_corners(
        transform, dataset.RasterXSize, dataset.RasterYSize
    )
    xs, ys = zip(*corners)
    return f"{min(xs):.3f},{min(ys):.3f},{max(xs):.3f},{max(ys):.3f}"


def raster_record(product):
    path = product["path"]
    record = {
        "product_id": product["product_id"],
        "path": relative_path(path),
        "exists": path.exists(),
        "gdal_open": "no",
        "driver": "not available",
        "dimensions": "not available",
        "bands": "not available",
        "data_type": "not available",
        "pixel_spacing": "not available",
        "nodata": "not available",
        "native_crs": "not available",
        "native_extent": "not available",
        "vertical_units": product["vertical_units"],
        "vertical_reference": product["vertical_reference"],
        "source_label": (
            f"embedded in {relative_path(product['label'])}"
            if product.get("label_embedded")
            else relative_path(product["label"])
            if product["label"] and product["label"].exists()
            else "not locally available"
        ),
        "sha256": sha256(path) if path.is_file() else "not available",
        "tracked": "no",
        "remote_main": "no",
        "validation_result": "FAIL: missing source file",
        "limitations": product["limitations"],
    }
    if not path.exists():
        return record, None

    record["tracked"], record["remote_main"] = relative_tracking(path)
    dataset = gdal.Open(str(path), gdal.GA_ReadOnly)
    if dataset is None:
        record["validation_result"] = "FAIL: GDAL could not open source"
        return record, None

    record.update(
        {
            "gdal_open": "yes",
            "driver": dataset.GetDriver().ShortName,
            "dimensions": f"{dataset.RasterXSize}x{dataset.RasterYSize}",
            "bands": str(dataset.RasterCount),
            "data_type": ";".join(
                gdal.GetDataTypeName(dataset.GetRasterBand(index).DataType)
                for index in range(1, dataset.RasterCount + 1)
            ),
            "native_extent": native_extent(dataset),
        }
    )
    transform = dataset.GetGeoTransform(can_return_null=True)
    if transform:
        record["pixel_spacing"] = f"{transform[1]:.6f},{transform[5]:.6f}"
    record["native_crs"] = (
        " ".join(dataset.GetProjectionRef().splitlines())
        if dataset.GetProjectionRef()
        else "not embedded; see source label"
    )
    record["nodata"] = ";".join(
        "not set"
        if dataset.GetRasterBand(index).GetNoDataValue() is None
        else str(dataset.GetRasterBand(index).GetNoDataValue())
        for index in range(1, dataset.RasterCount + 1)
    )
    record["validation_result"] = "PASS: opened by GDAL"
    if record["remote_main"] != "yes":
        record["validation_result"] += "; local-only"
    if "not specified in raster metadata" in product["vertical_units"]:
        record["validation_result"] += "; vertical units/reference not verified"
    return record, dataset


def vector_records():
    path = SIM_ROOT / "Geodatabase" / "Nili.gdb"
    dataset = ogr.Open(str(path), 0)
    if dataset is None:
        raise RuntimeError(f"OGR could not open the FileGDB: {path}")
    rows = []
    map_boundary = dataset.GetLayerByName("MapBoundary")
    if map_boundary is None:
        raise RuntimeError("The SIM 3464 FileGDB has no MapBoundary layer.")
    boundary_feature = map_boundary.GetNextFeature()
    if boundary_feature is None:
        raise RuntimeError("The SIM 3464 MapBoundary layer is empty.")
    boundary_geometry = boundary_feature.GetGeometryRef().Clone()
    boundary_srs = map_boundary.GetSpatialRef().Clone()
    boundary_srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)

    for index in range(dataset.GetLayerCount()):
        layer = dataset.GetLayerByIndex(index)
        geometry_type = layer.GetGeomType()
        spatial_reference = layer.GetSpatialRef()
        fields = [field.GetNameRef() for field in layer.schema]
        invalid_count = "not applicable"
        geometry_status = "non-spatial table"
        if geometry_type != ogr.wkbNone:
            invalid_count = 0
            geometry_status = "all features checked"
            layer.ResetReading()
            for feature in layer:
                geometry = feature.GetGeometryRef()
                if geometry is not None and not geometry.IsValid():
                    invalid_count += 1
            if invalid_count:
                geometry_status = "invalid geometries found"

        extent = layer.GetExtent(force=1) if geometry_type != ogr.wkbNone else None
        rows.append(
            {
                "layer": layer.GetName(),
                "geometry_type": ogr.GeometryTypeToName(geometry_type),
                "feature_count": layer.GetFeatureCount(),
                "crs": (
                    " ".join(spatial_reference.ExportToWkt().splitlines())
                    if spatial_reference
                    else "not defined"
                ),
                "extent": (
                    ",".join(f"{value:.3f}" for value in extent)
                    if extent
                    else "not spatial"
                ),
                "fields": ";".join(fields),
                "invalid_geometry_count": invalid_count,
                "geometry_validation": geometry_status,
            }
        )
    return rows, boundary_geometry, boundary_srs


def overlap_records(rasters, boundary_geometry, boundary_srs):
    rows = []
    for product, dataset in rasters:
        if dataset is None:
            continue
        source_wkt = dataset.GetProjectionRef()
        source_path = product["path"]
        record = {
            "raster_product_id": product["product_id"],
            "study_boundary_layer": "MapBoundary (SIM 3464)",
            "same_native_crs": "no",
            "intersection": "not tested",
            "intersection_area_fraction": "not calculated",
            "transformation": "not run",
            "notes": "",
        }
        if not source_wkt:
            record["notes"] = (
                "Raster has no embedded CRS; transformation is not guessed. "
                "Use the product label to construct a documented Mars CRS."
            )
            rows.append(record)
            continue
        source_srs = osr.SpatialReference()
        if source_srs.ImportFromWkt(source_wkt) != 0:
            record["notes"] = "GDAL could not parse the raster CRS."
            rows.append(record)
            continue
        source_srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
        record["same_native_crs"] = (
            "yes" if source_srs.IsSame(boundary_srs) else "no"
        )
        transform = osr.CoordinateTransformation(boundary_srs, source_srs)
        points = raster_corners(
            dataset.GetGeoTransform(),
            dataset.RasterXSize,
            dataset.RasterYSize,
        )
        points.append(points[0])
        ring = ogr.Geometry(ogr.wkbLinearRing)
        for x, y in points:
            ring.AddPoint_2D(x, y)
        raster_footprint = ogr.Geometry(ogr.wkbPolygon)
        raster_footprint.AddGeometry(ring)
        boundary_in_raster_crs = boundary_geometry.Clone()
        transform_status = boundary_in_raster_crs.Transform(transform)
        if transform_status != ogr.OGRERR_NONE:
            record["intersection"] = "not calculated"
            record["transformation"] = "failed"
            record["notes"] = (
                "Could not transform the SIM 3464 study boundary into the "
                "raster CRS; no overlap result was inferred."
            )
            rows.append(record)
            continue
        if source_srs.IsGeographic():
            boundary_in_raster_crs.Segmentize(0.1)
        intersection = raster_footprint.Intersection(boundary_in_raster_crs)
        record["intersection"] = "yes" if not intersection.IsEmpty() else "no"
        transformed_boundary_area = boundary_in_raster_crs.GetArea()
        if not intersection.IsEmpty() and transformed_boundary_area:
            record["intersection_area_fraction"] = (
                f"{intersection.GetArea() / transformed_boundary_area:.6f}"
            )
        record["transformation"] = (
            "none (same CRS)"
            if record["same_native_crs"] == "yes"
            else "SIM 3464 boundary transformed to raster CRS "
            "(extent-overlap check only)"
        )
        record["notes"] = (
            "Approximate raster-footprint coverage of the study boundary; "
            "not a registration or positional-accuracy test. "
            f"Native raster: {relative_path(source_path)}."
        )
        rows.append(record)
    return rows


def write_csv(path, fields, records):
    with path.open("w", newline="", encoding="utf-8-sig") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(records)


def main():
    DOCUMENTATION.mkdir(parents=True, exist_ok=True)
    raster_rows = []
    opened_rasters = []
    for product in REGIONAL_RASTERS:
        record, dataset = raster_record(product)
        raster_rows.append(record)
        opened_rasters.append((product, dataset))

    vector_rows, boundary_geometry, boundary_srs = vector_records()
    for record in raster_rows:
        record["vertical_units"] = record["vertical_units"]
    write_csv(DOCUMENTATION / "product_validation.csv", VALIDATION_FIELDS, raster_rows)
    write_csv(DOCUMENTATION / "vector_validation.csv", VECTOR_FIELDS, vector_rows)
    overlap_rows = overlap_records(
        opened_rasters, boundary_geometry, boundary_srs
    )
    write_csv(DOCUMENTATION / "spatial_overlap.csv", OVERLAP_FIELDS, overlap_rows)

    invalid = [
        row for row in vector_rows
        if row["invalid_geometry_count"] not in (0, "not applicable")
    ]
    failed_rasters = [row for row in raster_rows if row["gdal_open"] != "yes"]
    print(f"Raster products: {len(raster_rows)}; GDAL-open failures: {len(failed_rasters)}")
    print(f"Vector layers: {len(vector_rows)}; layers with invalid geometry: {len(invalid)}")
    print(f"Raster extent overlap checks: {len(overlap_rows)}")
    if failed_rasters or invalid:
        raise SystemExit(1)
    print("Source validation completed without modifying source products.")


if __name__ == "__main__":
    main()
