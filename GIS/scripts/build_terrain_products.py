"""Build reproducible HiRISE terrain derivatives and a relative-path QGIS project."""

import hashlib
import json
import re
from pathlib import Path

from osgeo import gdal, ogr

from gis_common import REPOSITORY_ROOT, SIM_ROOT, relative_path


gdal.DontUseExceptions()
ogr.DontUseExceptions()

SOURCE_DTM = REPOSITORY_ROOT / "GIS" / "raw_data" / (
    "DTEEC_022680_1985_022746_1985_A01.IMG"
)
OUTPUT_DIRECTORY = REPOSITORY_ROOT / "GIS" / "processed" / "hirise_terrain"
ANALYSIS_DEM_PATH = OUTPUT_DIRECTORY / "DTEEC_022680_1985_022746_1985_A01_dem_5m.tif"
PROJECT_PATH = REPOSITORY_ROOT / "GIS" / "projects" / "MarsWalk_Jezero.qgz"
REPORT_PATH = REPOSITORY_ROOT / "GIS" / "documentation" / "terrain_processing.json"
HIRISE_BASE_URL = (
    "https://hirise-pds.lpl.arizona.edu/PDS/DTM/ESP/ORB_022600_022699/"
    "ESP_022680_1985_ESP_022746_1985/"
)
OUTPUTS = {
    "slope": ("DTEEC_022680_1985_022746_1985_A01_slope_deg.tif", "slope"),
    "aspect": ("DTEEC_022680_1985_022746_1985_A01_aspect_deg.tif", "aspect"),
    "roughness": (
        "DTEEC_022680_1985_022746_1985_A01_roughness_3x3_m.tif",
        "Roughness",
    ),
}
ANALYSIS_RESOLUTION_M = 5.0


def sha256(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def raster_statistics(dataset):
    import numpy

    band = dataset.GetRasterBand(1)
    nodata = band.GetNoDataValue()
    minimum = None
    maximum = None
    total = 0.0
    count = 0
    block_rows = 256
    for row in range(0, dataset.RasterYSize, block_rows):
        height = min(block_rows, dataset.RasterYSize - row)
        values = band.ReadAsArray(0, row, dataset.RasterXSize, height)
        valid = numpy.isfinite(values)
        if nodata is not None:
            valid &= values != nodata
        if not numpy.any(valid):
            continue
        selected = values[valid]
        low = float(selected.min())
        high = float(selected.max())
        minimum = low if minimum is None else min(minimum, low)
        maximum = high if maximum is None else max(maximum, high)
        total += float(selected.sum(dtype=numpy.float64))
        count += int(selected.size)
    if not count:
        raise RuntimeError("The derived raster contains no valid cells.")
    return {
        "valid_min": minimum,
        "valid_max": maximum,
        "valid_mean": total / count,
        "valid_cells": count,
    }


def verify_source():
    if not SOURCE_DTM.is_file():
        raise FileNotFoundError(
            f"HiRISE DTM is missing: {SOURCE_DTM}\n"
            f"Download {HIRISE_BASE_URL}{SOURCE_DTM.name} and place it there."
        )
    dataset = gdal.Open(str(SOURCE_DTM), gdal.GA_ReadOnly)
    if dataset is None:
        raise RuntimeError(f"GDAL cannot open the source DTM: {SOURCE_DTM}")
    pds_domains = dataset.GetMetadata("json:PDS") or []
    if not pds_domains:
        raise RuntimeError("The HiRISE DTM has no readable embedded PDS label.")
    label = re.sub(r"\\+[RN]", " ", "\n".join(pds_domains).upper())
    label = re.sub(r"\s+", " ", label)
    required = (
        "DTEEC_022680_1985_022746_1985_A01",
        "METERS ABOVE THE MARTIAN EQUIPOTENTIAL SURFACE",
        "MARS 2000 DATUM",
    )
    missing = [value for value in required if value not in label]
    if missing:
        raise RuntimeError(
            "The embedded PDS label does not verify expected product/vertical "
            f"reference fields: {', '.join(missing)}"
        )
    if dataset.RasterCount != 1 or dataset.GetGeoTransform(can_return_null=True) is None:
        raise RuntimeError("The source DTM must be a single georeferenced raster band.")
    if not dataset.GetProjectionRef():
        raise RuntimeError("The source DTM has no embedded horizontal CRS.")
    band = dataset.GetRasterBand(1)
    if band.GetNoDataValue() is None:
        raise RuntimeError("The source DTM has no declared NoData value.")
    if band.GetUnitType() not in ("", "m", "metre", "meter", "meters"):
        raise RuntimeError(
            f"Unexpected raster band unit: {band.GetUnitType()!r}"
        )
    return dataset, pds_domains


def build_derivatives(source):
    OUTPUT_DIRECTORY.mkdir(parents=True, exist_ok=True)
    transform = source.GetGeoTransform()
    bounds = (
        transform[0],
        transform[3] + source.RasterYSize * transform[5],
        transform[0] + source.RasterXSize * transform[1],
        transform[3],
    )
    source_nodata = source.GetRasterBand(1).GetNoDataValue()
    aligned = gdal.Warp(
        str(ANALYSIS_DEM_PATH),
        source,
        format="GTiff",
        outputBounds=bounds,
        xRes=ANALYSIS_RESOLUTION_M,
        yRes=ANALYSIS_RESOLUTION_M,
        resampleAlg="average",
        outputType=gdal.GDT_Float32,
        srcNodata=source_nodata,
        dstNodata=source_nodata,
        creationOptions=[
            "COMPRESS=DEFLATE",
            "PREDICTOR=3",
            "TILED=YES",
            "BIGTIFF=IF_SAFER",
        ],
    )
    if aligned is None:
        raise RuntimeError(f"Could not create analysis DEM: {ANALYSIS_DEM_PATH}")
    aligned.GetRasterBand(1).SetUnitType("m")
    aligned.SetMetadata(
        {
            "SOURCE_PRODUCT_ID": "DTEEC_022680_1985_022746_1985_A01",
            "VERTICAL_REFERENCE": "Meters above Mars 2000 equipotential surface",
            "RESAMPLING": "Average to 5 m grid",
        }
    )
    aligned.FlushCache()
    aligned = None
    source = gdal.Open(str(ANALYSIS_DEM_PATH), gdal.GA_ReadOnly)
    if source is None:
        raise RuntimeError("The 5 m analysis DEM could not be reopened.")

    analysis_band = source.GetRasterBand(1)
    analysis_dem = {
        "path": relative_path(ANALYSIS_DEM_PATH),
        "file_size_bytes": ANALYSIS_DEM_PATH.stat().st_size,
        "sha256": sha256(ANALYSIS_DEM_PATH),
        "dimensions": f"{source.RasterXSize}x{source.RasterYSize}",
        "pixel_spacing_m": [
            abs(source.GetGeoTransform()[1]),
            abs(source.GetGeoTransform()[5]),
        ],
        "crs_wkt": source.GetProjectionRef(),
        "nodata": analysis_band.GetNoDataValue(),
        "resampling": "GDAL Warp average from source 1.0097 m grid to 5 m grid.",
    }
    common = {
        "format": "GTiff",
        "creationOptions": [
            "COMPRESS=DEFLATE",
            "PREDICTOR=3",
            "TILED=YES",
            "BIGTIFF=IF_SAFER",
        ],
        "computeEdges": False,
        "scale": 1.0,
    }
    results = {"analysis_dem": analysis_dem}
    for key, (filename, algorithm) in OUTPUTS.items():
        destination = OUTPUT_DIRECTORY / filename
        options = dict(common)
        if key in ("slope", "aspect"):
            options["alg"] = "Horn"
        if key == "slope":
            options["slopeFormat"] = "degree"
        elif key == "aspect":
            options["zeroForFlat"] = False
        result = gdal.DEMProcessing(
            str(destination),
            source,
            algorithm,
            options=gdal.DEMProcessingOptions(**options),
        )
        if result is None:
            raise RuntimeError(f"GDAL failed to create {destination}")
        units = "degree" if key in ("slope", "aspect") else "m"
        result.GetRasterBand(1).SetUnitType(units)
        result.SetMetadata(
            {
                "SOURCE_PRODUCT_ID": "DTEEC_022680_1985_022746_1985_A01",
                "VERTICAL_REFERENCE": "Mars 2000 equipotential surface",
                "PROCESSING": algorithm,
                "OUTPUT_UNITS": units,
                "RESOLUTION_M": str(ANALYSIS_RESOLUTION_M),
            }
        )
        result.FlushCache()
        result = None
        product = gdal.Open(str(destination), gdal.GA_ReadOnly)
        if product is None or product.RasterCount != 1:
            raise RuntimeError(f"Generated output could not be reopened: {destination}")
        if (
            product.RasterXSize != source.RasterXSize
            or product.RasterYSize != source.RasterYSize
            or product.GetGeoTransform() != source.GetGeoTransform()
            or product.GetProjectionRef() != source.GetProjectionRef()
        ):
            raise RuntimeError(f"Output grid differs from source DTM: {destination}")
        band = product.GetRasterBand(1)
        if band.GetNoDataValue() is None:
            raise RuntimeError(f"Output has no NoData value: {destination}")
        stats = raster_statistics(product)
        results[key] = {
            "path": relative_path(destination),
            "file_size_bytes": destination.stat().st_size,
            "sha256": sha256(destination),
            "dimensions": f"{product.RasterXSize}x{product.RasterYSize}",
            "pixel_spacing_m": [
                abs(product.GetGeoTransform()[1]),
                abs(product.GetGeoTransform()[5]),
            ],
            "crs_wkt": product.GetProjectionRef(),
            "nodata": band.GetNoDataValue(),
            **stats,
        }
    return results


def build_project(derivatives):
    from qgis.core import (
        Qgis,
        QgsApplication,
        QgsProject,
        QgsReferencedRectangle,
        QgsRasterLayer,
        QgsVectorLayer,
    )

    app = QgsApplication.instance()
    if app is None:
        app = QgsApplication([], False)
        app.initQgis()

    project = QgsProject.instance()
    project.clear()
    PROJECT_PATH.parent.mkdir(parents=True, exist_ok=True)
    project.setFileName(str(PROJECT_PATH))
    project.setFilePathStorage(Qgis.FilePathType.Relative)
    project.setTitle("MarsWalk Jezero terrain and geology")
    root = project.layerTreeRoot()
    geology_group = root.addGroup("SIM 3464 geology")
    terrain_group = root.addGroup("HiRISE terrain (limited footprint)")
    imagery_group = root.addGroup("Regional imagery")
    source_group = root.addGroup("Regional elevation sources")
    terrain_group.setItemVisibilityChecked(False)
    source_group.setItemVisibilityChecked(False)
    imagery_group.setItemVisibilityChecked(True)
    geology_group.setItemVisibilityChecked(True)

    regional_rasters = [
        (
            SIM_ROOT
            / "Rasters"
            / "Caltech_CTX_mosaic_feb2018"
            / "Nili_CTX_Mosaic_Beta01_Feb2018_MTM.tif",
            "SIM 3464 CTX mosaic (5 m pixel grid)",
            imagery_group,
        ),
        (
            SIM_ROOT / "Rasters" / "HRSC" / "nili_h0988_0000_hillshade_clip.tif",
            "SIM 3464 HRSC hillshade (provided source)",
            imagery_group,
        ),
        (
            REPOSITORY_ROOT
            / "GIS"
            / "raw_data"
            / "ESP_022680_1985_RED_A_01_ORTHO.JP2",
            "HiRISE RED orthophoto (download required if absent)",
            imagery_group,
        ),
        (
            REPOSITORY_ROOT
            / "GIS"
            / "raw_data"
            / "DTEEC_022680_1985_022746_1985_A01.IMG",
            "HiRISE stereo DTM (download required if absent)",
            terrain_group,
        ),
    ]
    for key in ("slope", "aspect", "roughness"):
        regional_rasters.append(
            (
                REPOSITORY_ROOT / derivatives[key]["path"],
                f"HiRISE {key} (5 m)",
                terrain_group,
            )
        )
    regional_rasters.append(
        (
            REPOSITORY_ROOT / derivatives["analysis_dem"]["path"],
            "HiRISE DTM resampled to 5 m (analysis surface)",
            terrain_group,
        )
    )
    regional_rasters.extend(
        [
            (
                SIM_ROOT / "Rasters" / "HRSC" / "nili_h0988_0000_da4_clip.tif",
                "SIM 3464 HRSC clipped DTM (vertical reference unverified)",
                source_group,
            ),
            (
                SIM_ROOT
                / "Rasters"
                / "USGS_CTX_Stereo_DTMs"
                / "B18_016575_1978_B17_016219_1978_20m_DTM.tif",
                "SIM 3464 CTX B18/B17 DTM (vertical reference unverified)",
                source_group,
            ),
            (
                SIM_ROOT
                / "Rasters"
                / "USGS_CTX_Stereo_DTMs"
                / "J03_045994_1986_J03_046060_1986_20m_DTM.tif",
                "SIM 3464 CTX J03 DTM (vertical reference unverified)",
                source_group,
            ),
        ]
    )

    for path, name, group in regional_rasters:
        layer = QgsRasterLayer(str(path), name, "gdal")
        if not layer.isValid():
            raise RuntimeError(f"QGIS could not load raster layer {name}: {path}")
        project.addMapLayer(layer, False)
        node = group.addLayer(layer)
        if name == "SIM 3464 CTX mosaic (5 m pixel grid)":
            project.setCrs(layer.crs())
            project.viewSettings().setDefaultViewExtent(
                QgsReferencedRectangle(layer.extent(), layer.crs())
            )
        elif group is imagery_group:
            node.setItemVisibilityChecked(False)

    geodatabase = SIM_ROOT / "Geodatabase" / "Nili.gdb"
    source = ogr.Open(str(geodatabase), 0)
    if source is None:
        raise RuntimeError(f"OGR could not open the SIM 3464 geodatabase: {geodatabase}")
    for index in range(source.GetLayerCount()):
        source_layer = source.GetLayerByIndex(index)
        if source_layer.GetGeomType() == ogr.wkbNone:
            continue
        uri = f"{geodatabase}|layername={source_layer.GetName()}"
        layer = QgsVectorLayer(uri, source_layer.GetName(), "ogr")
        if not layer.isValid():
            raise RuntimeError(
                f"QGIS could not load SIM 3464 layer {source_layer.GetName()}"
            )
        project.addMapLayer(layer, False)
        geology_group.addLayer(layer)

    if not project.write():
        raise RuntimeError(f"Could not write QGIS project: {PROJECT_PATH}")
    if not project.read(str(PROJECT_PATH)):
        raise RuntimeError("Written QGIS project could not be reopened.")
    invalid = [layer.name() for layer in project.mapLayers().values() if not layer.isValid()]
    if invalid:
        raise RuntimeError(f"Project contains invalid layers after reopen: {invalid}")
    count = len(project.mapLayers())
    source_layer = None
    source = None
    app.processEvents()
    app.exitQgis()
    return count


def main():
    source, pds_label = verify_source()
    source_info = {
        "product_id": "DTEEC_022680_1985_022746_1985_A01",
        "source_url": HIRISE_BASE_URL + SOURCE_DTM.name,
        "path": relative_path(SOURCE_DTM),
        "sha256": sha256(SOURCE_DTM),
        "file_size_bytes": SOURCE_DTM.stat().st_size,
        "dimensions": f"{source.RasterXSize}x{source.RasterYSize}",
        "crs_wkt": source.GetProjectionRef(),
        "pixel_spacing_m": [
            abs(source.GetGeoTransform()[1]),
            abs(source.GetGeoTransform()[5]),
        ],
        "vertical_reference": (
            "Meters above the martian equipotential surface (Mars 2000 Datum), "
            "verified in the embedded PDS3 IMAGE.NOTE."
        ),
        "label": "Embedded PDS3 label; raw parsed label retained below.",
        "nodata": source.GetRasterBand(1).GetNoDataValue(),
        "valid_elevation": raster_statistics(source),
    }
    derivatives = build_derivatives(source)
    source = None
    OUTPUT_DIRECTORY.mkdir(parents=True, exist_ok=True)
    project_layers = build_project(derivatives)
    report = {
        "source": source_info,
        "processing": {
            "software": f"GDAL {gdal.VersionInfo('--version')}",
            "slope": (
                "GDAL DEMProcessing slope; Horn 3x3 derivative; degrees; "
                "z/horizontal scale 1.0."
            ),
            "aspect": (
                "GDAL DEMProcessing aspect; Horn 3x3 derivative; clockwise "
                "azimuth degrees from north; flat-cell aspect is NoData."
            ),
            "roughness": (
                "GDAL DEMProcessing Roughness; 3x3 neighborhood maximum minus "
                "minimum elevation; metres."
            ),
            "nodata": (
                "Input PDS missing constant is honored. Edge computation is "
                "disabled, leaving a NoData border; neighborhoods containing "
                "NoData are not filled or interpolated."
            ),
            "resampling": (
                "GDAL Warp average from the 1.0097 m source DTM to the 5 m "
                "analysis DEM; terrain derivatives share its grid."
            ),
            "output_creation": (
                "Cloud-independent GeoTIFF, DEFLATE compression, floating-point "
                "predictor, tiled; no source DTM modifications."
            ),
            "project": relative_path(PROJECT_PATH),
        },
        "outputs": derivatives,
        "qgis_project_layer_count": project_layers,
        "limits": [
            "The HiRISE DTM footprint covers only a small portion of the SIM 3464 region.",
            "The derivatives are local terrain descriptors, not a rover safety or route product.",
            "The vertical reference is verified for the HiRISE DTM only; other SIM DEM vertical references remain unverified.",
        ],
        "pds_label_json": json.loads(pds_label[0]),
    }
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
    for path in [ANALYSIS_DEM_PATH] + [
        OUTPUT_DIRECTORY / filename for filename, _ in OUTPUTS.values()
    ]:
        auxiliary = Path(str(path) + ".aux.xml")
        if auxiliary.exists():
            auxiliary.unlink()
    print(f"Created QGIS project: {PROJECT_PATH}")
    print(f"Created terrain products in: {OUTPUT_DIRECTORY}")
    for key, product in derivatives.items():
        print(
            f"{key}: {product['path']} ({product['file_size_bytes']} bytes; "
            f"SHA-256 {product['sha256']})"
        )
    print(f"Project layers: {project_layers}")
    print(f"Processing report: {REPORT_PATH}")


if __name__ == "__main__":
    main()
