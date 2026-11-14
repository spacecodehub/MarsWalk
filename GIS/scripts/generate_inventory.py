"""Generate CSV inventories from the checked-out GIS products."""

import csv
import hashlib
import subprocess
import sys
from pathlib import Path

from osgeo import gdal, ogr

from gis_common import (
    PRODUCTS,
    REPOSITORY_ROOT,
    find_git_executable,
    raster_corners,
    relative_path,
)

gdal.DontUseExceptions()
ogr.DontUseExceptions()


DOCUMENTATION = REPOSITORY_ROOT / "GIS" / "documentation"
GIT_EXECUTABLE = find_git_executable()
INVENTORY_FIELDS = [
    "name",
    "product_id",
    "instrument",
    "mission",
    "source_organization",
    "source_url",
    "path",
    "file_size_bytes",
    "format",
    "product_type",
    "processing_level",
    "dimensions",
    "bands",
    "data_type",
    "pixel_spacing",
    "native_crs",
    "native_extent",
    "horizontal_units",
    "vertical_units",
    "vertical_reference",
    "nodata",
    "source_label",
    "sha256",
    "local_availability",
    "git_status",
    "remote_status",
    "validation_status",
    "limitations",
]
SOURCE_FIELDS = [
    "product_id",
    "name",
    "path",
    "file_size_bytes",
    "source_organization",
    "source_url",
    "citation",
    "label_local_path",
    "label_source_url",
    "label_sha256",
    "file_sha256",
    "remote_status",
    "provenance_notes",
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


def dataset_size(path):
    if path.is_file():
        return path.stat().st_size
    if path.is_dir():
        return sum(item.stat().st_size for item in path.rglob("*") if item.is_file())
    return "not available"


def tracking_status(path):
    relative = relative_path(path)
    tracked = git("ls-files", "--error-unmatch", relative)
    if tracked.returncode != 0 and Path(path).is_dir():
        tracked = git(
            "ls-files",
            "--error-unmatch",
            relative + "/a00000001.gdbtable",
        )
    if tracked.returncode != 0:
        return "local-only or untracked", "not present in Git index"

    lfs = git("check-attr", "filter", "--", relative)
    is_lfs = lfs.returncode == 0 and "filter: lfs" in lfs.stdout
    remote_path = relative
    if Path(path).is_dir():
        remote_path += "/a00000001.gdbtable"
    remote = git("cat-file", "-e", f"origin/main:{remote_path}")
    if remote.returncode == 0:
        status = (
            "LFS pointer present on origin/main; remote payload not verified"
            if is_lfs
            else "committed to origin/main"
        )
        return "tracked in current checkout", status

    return "tracked in current checkout", "not found in origin/main"


def raster_details(path):
    dataset = gdal.Open(str(path), gdal.GA_ReadOnly)
    if dataset is None:
        return {}
    transform = dataset.GetGeoTransform(can_return_null=True)
    projection = dataset.GetProjectionRef().strip()
    bands = []
    for index in range(1, dataset.RasterCount + 1):
        band = dataset.GetRasterBand(index)
        bands.append(
            {
                "type": gdal.GetDataTypeName(band.DataType),
                "unit": band.GetUnitType() or "not specified",
                "nodata": band.GetNoDataValue(),
            }
        )

    extent = "unknown"
    pixel_spacing = "unknown"
    if transform:
        x0, dx, rx, y0, ry, dy = transform
        corners = raster_corners(
            transform, dataset.RasterXSize, dataset.RasterYSize
        )
        xs, ys = zip(*corners)
        extent = f"{min(xs):.3f},{min(ys):.3f},{max(xs):.3f},{max(ys):.3f}"
        pixel_spacing = f"{dx:.6f},{dy:.6f}"

    return {
        "format": dataset.GetDriver().ShortName,
        "dimensions": f"{dataset.RasterXSize}x{dataset.RasterYSize}",
        "bands": str(dataset.RasterCount),
        "data_type": ";".join(band["type"] for band in bands),
        "pixel_spacing": pixel_spacing,
        "native_crs": " ".join(projection.splitlines()) or "not embedded",
        "native_extent": extent,
        "nodata": ";".join(
            "not set" if band["nodata"] is None else str(band["nodata"])
            for band in bands
        ),
        "band_units": ";".join(band["unit"] for band in bands),
    }


def vector_details(path):
    dataset = ogr.Open(str(path), 0)
    if dataset is None:
        return {}
    layer = next(
        (
            dataset.GetLayerByIndex(index)
            for index in range(dataset.GetLayerCount())
            if dataset.GetLayerByIndex(index).GetGeomType() != ogr.wkbNone
        ),
        None,
    )
    if layer is None:
        return {}
    spatial_reference = layer.GetSpatialRef()
    crs = spatial_reference.ExportToWkt() if spatial_reference else "not embedded"
    extent = layer.GetExtent()
    return {
        "format": "FileGDB",
        "dimensions": f"{dataset.GetLayerCount()} feature layers",
        "bands": "not applicable",
        "data_type": "vector",
        "pixel_spacing": "not applicable",
        "native_crs": " ".join(crs.splitlines()),
        "native_extent": ",".join(f"{value:.3f}" for value in extent),
        "nodata": "not applicable",
        "band_units": "not applicable",
    }


def inspect_product(product):
    path = product["path"]
    exists = path.exists()
    label = product["label"]
    label_exists = bool(label and label.exists())
    tracked_status, remote_status = tracking_status(path) if exists else ("missing", "missing")

    if not exists:
        detail = {}
        local_availability = "missing"
        checksum = "not available"
    else:
        detail = vector_details(path) if path.is_dir() else raster_details(path)
        if not detail:
            local_availability = "present; format could not be opened"
        else:
            local_availability = "present"
        checksum = sha256(path) if path.is_file() else "not applicable (directory dataset)"

    band_units = detail.get("band_units", "not specified")
    vertical_units = product["vertical_units"]
    if vertical_units == "not specified in raster metadata" and band_units not in (
        "",
        "not specified",
        "not applicable",
    ):
        vertical_units = band_units

    status = "AVAILABLE_AND_OPENED"
    if local_availability == "missing":
        status = "MISSING"
    elif local_availability != "present":
        status = "AVAILABLE_NOT_VALIDATED"
    elif remote_status in ("not found in origin/main", "not present in Git index"):
        status = "LOCAL_ONLY"
    elif "not specified in raster metadata" in vertical_units:
        status = "VERTICAL_METADATA_INCOMPLETE"
    elif "LFS pointer" in remote_status:
        status = "REMOTE_LFS_PAYLOAD_UNVERIFIED"

    return {
        **product,
        **detail,
        "path": relative_path(path),
        "file_size_bytes": (
            dataset_size(path) if exists else "not available"
        ),
        "source_url": product["url"],
        "source_organization": product["organization"],
        "source_label": (
            f"embedded in {relative_path(label)}"
            if label and product.get("label_embedded")
            else relative_path(label) if label else "not supplied"
        ),
        "sha256": checksum,
        "local_availability": local_availability,
        "git_status": tracked_status,
        "remote_status": remote_status,
        "validation_status": status,
        "limitations": product["limitations"],
        "vertical_units": vertical_units,
        "label_exists": label_exists,
        "label_sha256": (
            "embedded in product; not separately hashed"
            if product.get("label_embedded")
            else sha256(label)
            if label_exists and label.is_file()
            else "not available"
        ),
    }


def write_csv(path, fields, records):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8-sig") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(records)


def main():
    if gdal.VersionInfo() is None:
        raise RuntimeError("GDAL could not be initialized.")

    records = [inspect_product(product) for product in PRODUCTS]
    inventory = []
    sources = []
    for record in records:
        inventory.append(record)
        label = record["label"]
        label_source = record["label_url"]
        notes = record["limitations"]
        if record["key"].startswith(("ctx_", "hrsc_", "themis_")):
            notes += (
                " Individual acquisition-level label and source URL are not "
                "included in the delivered package; SIM 3464 DOI is the package provenance."
            )
        sources.append(
            {
                "product_id": record["product_id"],
                "name": record["name"],
                "path": record["path"],
                "file_size_bytes": record["file_size_bytes"],
                "source_organization": record["source_organization"],
                "source_url": record["url"],
                "citation": (
                    "Sun, V.Z., and Stack, K.M., 2020, Geologic map of Jezero "
                    "crater and the Nili Planum region, Mars: U.S. Geological "
                    "Survey Scientific Investigations Map 3464."
                    if record["url"].endswith("sim3464")
                    else "Product citation and PDS label are linked from the official source URL."
                ),
                "label_local_path": record["source_label"],
                "label_source_url": label_source,
                "label_sha256": record["label_sha256"],
                "file_sha256": record["sha256"],
                "remote_status": record["remote_status"],
                "provenance_notes": notes,
            }
        )

    write_csv(DOCUMENTATION / "dataset_inventory.csv", INVENTORY_FIELDS, inventory)
    write_csv(DOCUMENTATION / "source_manifest.csv", SOURCE_FIELDS, sources)
    print(f"Generated inventories for {len(records)} products.")
    for record in records:
        print(
            f"{record['product_id']}: {record['local_availability']}; "
            f"{record['remote_status']}; {record['validation_status']}"
        )


if __name__ == "__main__":
    main()
