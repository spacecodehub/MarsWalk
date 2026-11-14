"""Estimate local relative image offsets between SIM CTX and HiRISE imagery."""

import json
from pathlib import Path

import numpy
from osgeo import gdal
from scipy.ndimage import gaussian_filter, sobel
from scipy.signal import fftconvolve

from gis_common import PRODUCTS, REPOSITORY_ROOT, relative_path
from build_terrain_products import (
    ANALYSIS_DEM_PATH,
    HIRISE_BASE_URL,
    SOURCE_DTM,
)


gdal.DontUseExceptions()

RED_PATH = REPOSITORY_ROOT / "GIS" / "raw_data" / (
    "ESP_022680_1985_RED_A_01_ORTHO.JP2"
)
CTX_PRODUCT = next(product for product in PRODUCTS if product["key"] == "ctx_mosaic")
REPORT_PATH = REPOSITORY_ROOT / "GIS" / "documentation" / "alignment_assessment.json"
TILE_SIZE = 192
SEARCH_RADIUS = 80
TILE_ORIGINS = [
    (x, y)
    for y in (350, 900, 1500, 2200, 2700)
    for x in (300, 700, 1100)
]


def warp_to_analysis_grid(path, bounds, width, height, crs):
    source = gdal.Open(str(path), gdal.GA_ReadOnly)
    if source is None:
        raise RuntimeError(f"Cannot open alignment image: {path}")
    return gdal.Warp(
        "",
        source,
        format="MEM",
        outputBounds=bounds,
        width=width,
        height=height,
        dstSRS=crs,
        resampleAlg="average",
        outputType=gdal.GDT_Float32,
        dstNodata=-9999,
    )


def image_gradients(image):
    smoothed = gaussian_filter(image, sigma=1.2)
    return numpy.hypot(sobel(smoothed, axis=0), sobel(smoothed, axis=1))


def normalized_cross_correlation(search, template):
    template = template.astype(numpy.float32, copy=False)
    search = search.astype(numpy.float32, copy=False)
    count = template.size
    template_mean = float(template.mean())
    template_energy = float((template * template).sum() - count * template_mean**2)
    if template_energy <= 1e-6:
        return None
    ones = numpy.ones(template.shape, dtype=numpy.float32)
    cross = fftconvolve(search, template[::-1, ::-1], mode="valid")
    sums = fftconvolve(search, ones, mode="valid")
    sums_squared = fftconvolve(search * search, ones, mode="valid")
    variance = numpy.maximum(sums_squared - sums * sums / count, 1e-6)
    return (cross - template_mean * sums) / numpy.sqrt(
        template_energy * variance
    )


def correlate_tiles(ctx, red, transform):
    ctx_gradient = image_gradients(ctx)
    red_gradient = image_gradients(red)
    matches = []
    for x, y in TILE_ORIGINS:
        template = red_gradient[y : y + TILE_SIZE, x : x + TILE_SIZE]
        search = ctx_gradient[
            y - SEARCH_RADIUS : y + TILE_SIZE + SEARCH_RADIUS,
            x - SEARCH_RADIUS : x + TILE_SIZE + SEARCH_RADIUS,
        ]
        if template.shape != (TILE_SIZE, TILE_SIZE):
            continue
        scores = normalized_cross_correlation(search, template)
        if scores is None:
            continue
        py, px = numpy.unravel_index(numpy.argmax(scores), scores.shape)
        score = float(scores[py, px])
        if score < 0.3:
            continue
        dx_pixels = float(px - SEARCH_RADIUS)
        dy_pixels = float(py - SEARCH_RADIUS)
        matches.append(
            {
                "template_origin_pixel": [x, y],
                "ncc_score": score,
                "ctx_relative_shift_pixels": [dx_pixels, dy_pixels],
                "ctx_relative_shift_m": [
                    dx_pixels * abs(transform[1]),
                    -dy_pixels * abs(transform[5]),
                ],
            }
        )
    return matches


def main():
    if not ANALYSIS_DEM_PATH.is_file():
        raise FileNotFoundError(
            f"Run build_terrain_products.py first: {ANALYSIS_DEM_PATH}"
        )
    if not RED_PATH.is_file():
        raise FileNotFoundError(
            f"Download {HIRISE_BASE_URL}{RED_PATH.name} and place it at {RED_PATH}"
        )
    grid = gdal.Open(str(ANALYSIS_DEM_PATH), gdal.GA_ReadOnly)
    if grid is None:
        raise RuntimeError("Cannot open the 5 m analysis grid.")
    transform = grid.GetGeoTransform()
    bounds = (
        transform[0],
        transform[3] + grid.RasterYSize * transform[5],
        transform[0] + grid.RasterXSize * transform[1],
        transform[3],
    )
    common = {
        "bounds": bounds,
        "width": grid.RasterXSize,
        "height": grid.RasterYSize,
        "crs": grid.GetProjectionRef(),
    }
    ctx_ds = warp_to_analysis_grid(CTX_PRODUCT["path"], **common)
    red_ds = warp_to_analysis_grid(RED_PATH, **common)
    if ctx_ds is None or red_ds is None:
        raise RuntimeError("Could not warp both images to the common analysis grid.")
    ctx = ctx_ds.ReadAsArray().astype(numpy.float32)
    red = red_ds.ReadAsArray().astype(numpy.float32)
    valid = (ctx != -9999) & (red != -9999)
    if float(valid.mean()) < 0.95:
        raise RuntimeError("The imagery overlap is insufficient for registration.")
    ctx = numpy.where(valid, ctx, 0)
    red = numpy.where(valid, red, 0)
    matches = correlate_tiles(ctx, red, transform)
    if len(matches) < 8:
        raise RuntimeError(
            f"Only {len(matches)} reliable image ties found; registration is inconclusive."
        )
    shifts = numpy.array(
        [match["ctx_relative_shift_m"] for match in matches], dtype=numpy.float64
    )
    medians = numpy.median(shifts, axis=0)
    deviations = numpy.median(numpy.abs(shifts - medians), axis=0)
    report = {
        "status": "relative-image-registration-estimate",
        "inputs": {
            "sim_ctx_mosaic": {
                "path": relative_path(CTX_PRODUCT["path"]),
                "product_id": CTX_PRODUCT["product_id"],
            },
            "hirise_red": {
                "path": relative_path(RED_PATH),
                "source_url": CTX_PRODUCT.get("red_url", HIRISE_BASE_URL + RED_PATH.name),
                "product_id": "ESP_022680_1985_RED_A_01_ORTHO",
            },
        },
        "method": (
            "Warp both rasters to the HiRISE DTM-derived 5 m Mars equirectangular "
            "grid; Gaussian-smoothed Sobel gradient magnitude; 192x192-pixel "
            "tiles; normalized cross-correlation searched within +/-80 pixels; "
            "retain NCC >= 0.3."
        ),
        "common_grid": {
            "crs_wkt": grid.GetProjectionRef(),
            "pixel_spacing_m": [abs(transform[1]), abs(transform[5])],
            "dimensions": [grid.RasterXSize, grid.RasterYSize],
            "overlap_fraction": float(valid.mean()),
        },
        "result": {
            "tie_count": len(matches),
            "median_ctx_relative_shift_m": medians.tolist(),
            "median_absolute_deviation_m": deviations.tolist(),
            "tie_matches": matches,
            "interpretation": (
                "Relative apparent image displacement only: the matched CTX "
                "features lie at these offsets from the HiRISE RED features "
                "under the products' delivered map georeferencing."
            ),
        },
        "limitations": [
            "This is not an absolute control-point survey or a positional-accuracy estimate.",
            "The HiRISE orthophoto is not a Mars 2020 operational control dataset.",
            "The estimate covers only the shared HiRISE footprint and cannot establish the offset elsewhere in SIM 3464.",
            "A dedicated, published Mars 2020 operational basemap or control-point set is required to resolve the reported 100-200 m concern.",
        ],
    }
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(
        f"Relative CTX-to-HiRISE shift: {medians[0]:.1f} m east, "
        f"{medians[1]:.1f} m north (n={len(matches)} ties)"
    )
    print(f"Assessment: {REPORT_PATH}")


if __name__ == "__main__":
    main()
