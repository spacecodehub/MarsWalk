"""Shared paths and product provenance for MarsWalk GIS utilities."""

import os
import shutil
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
SIM_ROOT = (
    REPOSITORY_ROOT
    / "Datasetmars"
    / "data"
    / "raw"
    / "geology"
    / "extracted"
    / "sim3464_database"
    / "sim3464_JezeroNili_FINAL"
)
SIM_DOI = "https://doi.org/10.3133/sim3464"
MOLA_SOURCE = (
    "https://pds-geosciences.wustl.edu/mgs/"
    "urn-nasa-pds-mgs_mola_topography_derived/meg016/"
)
HIRISE_SOURCE = (
    "https://hirise-pds.lpl.arizona.edu/PDS/DTM/ESP/ORB_022600_022699/"
    "ESP_022680_1985_ESP_022746_1985/"
)


def raster_corners(transform, width, height):
    x0, dx, rx, y0, ry, dy = transform
    return [
        (x0, y0),
        (x0 + width * dx, y0 + width * ry),
        (x0 + width * dx + height * rx, y0 + width * ry + height * dy),
        (x0 + height * rx, y0 + height * dy),
    ]


def find_git_executable():
    configured = os.environ.get("MARSWALK_GIT_EXECUTABLE")
    if configured:
        candidate = Path(configured)
        if candidate.is_file():
            return str(candidate)
        raise FileNotFoundError(
            f"MARSWALK_GIT_EXECUTABLE does not point to a file: {candidate}"
        )

    executable = shutil.which("git")
    if executable:
        return executable
    if os.name == "nt":
        local_app_data = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData/Local"))
        candidates = sorted(
            (local_app_data / "GitHubDesktop").glob(
                "app-*/resources/app/git/cmd/git.exe"
            ),
            reverse=True,
        )
        for candidate in candidates:
            if candidate.is_file():
                return str(candidate)
    raise FileNotFoundError(
        "Git was not found. Add Git to PATH or set MARSWALK_GIT_EXECUTABLE."
    )


PRODUCTS = [
    {
        "key": "sim3464_geodatabase",
        "name": "SIM 3464 Jezero-Nili File Geodatabase",
        "path": SIM_ROOT / "Geodatabase" / "Nili.gdb",
        "product_id": "USGS SIM 3464 Nili.gdb",
        "instrument": "CTX, HRSC, THEMIS, HiRISE (map compilation)",
        "mission": "Mars Reconnaissance Orbiter; Mars Express",
        "organization": "U.S. Geological Survey",
        "url": SIM_DOI,
        "product_type": "Geologic vector database",
        "processing_level": "Published geologic map database",
        "label": SIM_ROOT / "Metadata" / "SIM3464_metadata.xml",
        "label_url": SIM_DOI,
        "horizontal_units": "metres",
        "vertical_units": "not applicable",
        "vertical_reference": "not applicable",
        "limitations": (
            "Map scale 1:75,000; source notes possible 100-200 m offsets "
            "relative to later Mars 2020 operational products."
        ),
    },
    {
        "key": "ctx_mosaic",
        "name": "Nili CTX Mosaic Beta01 February 2018",
        "path": SIM_ROOT / "Rasters" / "Caltech_CTX_mosaic_feb2018" / "Nili_CTX_Mosaic_Beta01_Feb2018_MTM.tif",
        "product_id": "Nili_CTX_Mosaic_Beta01_Feb2018_MTM",
        "instrument": "CTX",
        "mission": "Mars Reconnaissance Orbiter",
        "organization": "U.S. Geological Survey / Caltech mosaic as distributed with SIM 3464",
        "url": SIM_DOI,
        "product_type": "Grayscale orthomosaic",
        "processing_level": "Regional mosaic",
        "label": None,
        "label_url": "not supplied separately",
        "horizontal_units": "metres",
        "vertical_units": "not applicable",
        "vertical_reference": "not applicable",
        "limitations": (
            "Embedded raster reports 5 m pixels; SIM metadata describes its "
            "primary map base as 6 m/pixel. Positional uncertainty is not quantified."
        ),
    },
    {
        "key": "hrsc_source_dtm",
        "name": "HRSC source DTM h0988_0000.da4.53",
        "path": SIM_ROOT / "Rasters" / "HRSC" / "h0988_0000.da4.53.tif",
        "product_id": "h0988_0000.da4.53",
        "instrument": "HRSC",
        "mission": "Mars Express",
        "organization": "U.S. Geological Survey / HRSC product as distributed with SIM 3464",
        "url": SIM_DOI,
        "product_type": "Elevation raster",
        "processing_level": "Source raster included in map package",
        "label": None,
        "label_url": "not supplied separately",
        "horizontal_units": "metres (projected CRS)",
        "vertical_units": "not specified in raster metadata",
        "vertical_reference": "not verified",
        "limitations": "Uses a sinusoidal Mars CRS with a 3,396,000 m sphere; no product label accompanies the TIFF.",
    },
    {
        "key": "hrsc_clipped_dtm",
        "name": "HRSC clipped Nili DTM",
        "path": SIM_ROOT / "Rasters" / "HRSC" / "nili_h0988_0000_da4_clip.tif",
        "product_id": "nili_h0988_0000_da4_clip",
        "instrument": "HRSC",
        "mission": "Mars Express",
        "organization": "U.S. Geological Survey / HRSC product as distributed with SIM 3464",
        "url": SIM_DOI,
        "product_type": "Clipped elevation raster",
        "processing_level": "Clipped regional raster",
        "label": None,
        "label_url": "not supplied separately",
        "horizontal_units": "metres",
        "vertical_units": "not specified in raster metadata",
        "vertical_reference": "not verified",
        "limitations": "75 m pixels; projected to Mars 2000 Sphere local TM. Vertical units/reference require source documentation.",
    },
    {
        "key": "hrsc_hillshade",
        "name": "HRSC Nili hillshade",
        "path": SIM_ROOT / "Rasters" / "HRSC" / "nili_h0988_0000_hillshade_clip.tif",
        "product_id": "nili_h0988_0000_hillshade_clip",
        "instrument": "HRSC",
        "mission": "Mars Express",
        "organization": "U.S. Geological Survey / HRSC product as distributed with SIM 3464",
        "url": SIM_DOI,
        "product_type": "Hillshade visualization",
        "processing_level": "Derived hillshade supplied with map package",
        "label": SIM_ROOT / "Rasters" / "HRSC" / "nili_h0988_0000_hillshade_clip.tif.xml",
        "label_url": SIM_DOI,
        "horizontal_units": "metres",
        "vertical_units": "not applicable (display intensity)",
        "vertical_reference": "not applicable",
        "limitations": "Sidecar records ArcGIS HillShade parameters: azimuth 315°, altitude 45°, NO_SHADOWS, z-factor 1.",
    },
    {
        "key": "ctx_b17_ortho",
        "name": "CTX B17 6 m orthophoto",
        "path": SIM_ROOT / "Rasters" / "USGS_CTX_Stereo_DTMs" / "B17_016219_1978_XN_17N282W_6m_ORTHO.tif",
        "product_id": "B17_016219_1978_XN_17N282W_6m_ORTHO",
        "instrument": "CTX",
        "mission": "Mars Reconnaissance Orbiter",
        "organization": "U.S. Geological Survey / product as distributed with SIM 3464",
        "url": SIM_DOI,
        "product_type": "Stereo orthophoto",
        "processing_level": "Orthorectified image",
        "label": None,
        "label_url": "not supplied separately",
        "horizontal_units": "metres",
        "vertical_units": "not applicable",
        "vertical_reference": "not applicable",
        "limitations": "Embedded CRS is equirectangular Mars; stated product scale is inferred from filename, actual pixel size is recorded separately.",
    },
    {
        "key": "ctx_b18_dtm",
        "name": "CTX B18/B17 20 m DTM",
        "path": SIM_ROOT / "Rasters" / "USGS_CTX_Stereo_DTMs" / "B18_016575_1978_B17_016219_1978_20m_DTM.tif",
        "product_id": "B18_016575_1978_B17_016219_1978_20m_DTM",
        "instrument": "CTX stereo",
        "mission": "Mars Reconnaissance Orbiter",
        "organization": "U.S. Geological Survey / product as distributed with SIM 3464",
        "url": SIM_DOI,
        "product_type": "Stereo digital terrain model",
        "processing_level": "Stereo DTM",
        "label": None,
        "label_url": "not supplied separately",
        "horizontal_units": "metres",
        "vertical_units": "not specified in raster metadata",
        "vertical_reference": "not verified",
        "limitations": "Float32 elevation values; vertical units/reference and accuracy not specified in the delivered GeoTIFF.",
    },
    {
        "key": "ctx_j03_dtm",
        "name": "CTX J03 20 m DTM",
        "path": SIM_ROOT / "Rasters" / "USGS_CTX_Stereo_DTMs" / "J03_045994_1986_J03_046060_1986_20m_DTM.tif",
        "product_id": "J03_045994_1986_J03_046060_1986_20m_DTM",
        "instrument": "CTX stereo",
        "mission": "Mars Reconnaissance Orbiter",
        "organization": "U.S. Geological Survey / product as distributed with SIM 3464",
        "url": SIM_DOI,
        "product_type": "Stereo digital terrain model",
        "processing_level": "Stereo DTM",
        "label": None,
        "label_url": "not supplied separately",
        "horizontal_units": "metres",
        "vertical_units": "not specified in raster metadata",
        "vertical_reference": "not verified",
        "limitations": "Float32 elevation values; vertical units/reference and accuracy not specified in the delivered GeoTIFF.",
    },
    {
        "key": "ctx_j03_ortho",
        "name": "CTX J03 6 m orthophoto",
        "path": SIM_ROOT / "Rasters" / "USGS_CTX_Stereo_DTMs" / "J03_045994_1986_XN_18N282W_6m_ORTHO.tif",
        "product_id": "J03_045994_1986_XN_18N282W_6m_ORTHO",
        "instrument": "CTX stereo",
        "mission": "Mars Reconnaissance Orbiter",
        "organization": "U.S. Geological Survey / product as distributed with SIM 3464",
        "url": SIM_DOI,
        "product_type": "Stereo orthophoto",
        "processing_level": "Orthorectified image",
        "label": None,
        "label_url": "not supplied separately",
        "horizontal_units": "metres",
        "vertical_units": "not applicable",
        "vertical_reference": "not applicable",
        "limitations": "Embedded CRS is equirectangular Mars; does not share the SIM geodatabase's local TM projection.",
    },
    {
        "key": "themis_day",
        "name": "THEMIS day IR controlled mosaic",
        "path": SIM_ROOT / "Rasters" / "USGS_THEMIS_IR_controlled_mosaic_oct2018" / "nili_THEMIS_DayIR_Controlled_oct2018.tif",
        "product_id": "nili_THEMIS_DayIR_Controlled_oct2018",
        "instrument": "THEMIS",
        "mission": "Mars Odyssey",
        "organization": "U.S. Geological Survey / THEMIS product as distributed with SIM 3464",
        "url": SIM_DOI,
        "product_type": "Day infrared mosaic",
        "processing_level": "Controlled regional mosaic",
        "label": None,
        "label_url": "not supplied separately",
        "horizontal_units": "metres",
        "vertical_units": "not applicable",
        "vertical_reference": "not applicable",
        "limitations": "Byte samples; calibration/temperature interpretation is not established by this raster alone.",
    },
    {
        "key": "themis_night",
        "name": "THEMIS night IR controlled mosaic",
        "path": SIM_ROOT / "Rasters" / "USGS_THEMIS_IR_controlled_mosaic_oct2018" / "nili_THEMIS_NightIR_Controlled_oct2018.tif",
        "product_id": "nili_THEMIS_NightIR_Controlled_oct2018",
        "instrument": "THEMIS",
        "mission": "Mars Odyssey",
        "organization": "U.S. Geological Survey / THEMIS product as distributed with SIM 3464",
        "url": SIM_DOI,
        "product_type": "Night infrared mosaic",
        "processing_level": "Controlled regional mosaic",
        "label": None,
        "label_url": "not supplied separately",
        "horizontal_units": "metres",
        "vertical_units": "not applicable",
        "vertical_reference": "not applicable",
        "limitations": "Byte samples; do not treat as calibrated physical temperatures without calibration documentation.",
    },
    {
        "key": "mola_topography",
        "name": "MOLA MEGDR 16 pixels per degree topography",
        "path": REPOSITORY_ROOT / "GIS" / "raw_data" / "MOLA_MEgdr16ppd" / "megt90n000eb.img",
        "product_id": "MEGT90N000EB.IMG",
        "instrument": "MOLA",
        "mission": "Mars Global Surveyor",
        "organization": "NASA PDS Geosciences Node",
        "url": MOLA_SOURCE + "megt90n000eb.img",
        "product_type": "Global topography raster",
        "processing_level": "MEGDR L3",
        "label": REPOSITORY_ROOT / "GIS" / "raw_data" / "MOLA_MEgdr16ppd" / "megt90n000eb.lbl",
        "label_url": MOLA_SOURCE + "megt90n000eb.lbl",
        "horizontal_units": "metres in embedded equirectangular projection",
        "vertical_units": "metres",
        "vertical_reference": "MOLA areoid",
        "limitations": "About 3.705 km/pixel at equator; global context only, not rover-scale terrain analysis.",
    },
    {
        "key": "mola_areoid",
        "name": "MOLA MEGDR areoid reference surface",
        "path": REPOSITORY_ROOT / "GIS" / "raw_data" / "MOLA_Areoid_16ppd" / "mega90n000eb.img",
        "product_id": "MEGA90N000EB.IMG",
        "instrument": "MOLA",
        "mission": "Mars Global Surveyor",
        "organization": "NASA PDS Geosciences Node",
        "url": MOLA_SOURCE + "mega90n000eb.img",
        "product_type": "Global areoid reference raster",
        "processing_level": "MEGDR L3 reference surface",
        "label": REPOSITORY_ROOT / "GIS" / "raw_data" / "MOLA_Areoid_16ppd" / "mega90n000eb.lbl",
        "label_url": MOLA_SOURCE + "mega90n000eb.lbl",
        "horizontal_units": "metres in embedded equirectangular projection",
        "vertical_units": "metres after label scale and offset",
        "vertical_reference": "Areoid radius/reference, not elevation above areoid",
        "limitations": "Do not interpret the stored values as topographic elevation.",
    },
    {
        "key": "hirise_irb",
        "name": "HiRISE IRB orthorectified image",
        "path": REPOSITORY_ROOT / "GIS" / "raw_data" / "ESP_022746_1985_IRB_C_01_ORTHO.JP2",
        "product_id": "ESP_022746_1985_IRB_C_01_ORTHO",
        "instrument": "HiRISE",
        "mission": "Mars Reconnaissance Orbiter",
        "organization": "University of Arizona HiRISE PDS",
        "url": HIRISE_SOURCE + "ESP_022746_1985_IRB_C_01_ORTHO.JP2",
        "product_type": "IRB orthorectified image",
        "processing_level": "Orthorectified image",
        "label": REPOSITORY_ROOT / "GIS" / "raw_data" / "ESP_022746_1985_IRB_C_01_ORTHO.LBL",
        "label_url": HIRISE_SOURCE + "ESP_022746_1985_IRB_C_01_ORTHO.LBL",
        "horizontal_units": "metres in map projection",
        "vertical_units": "not applicable",
        "vertical_reference": "not applicable",
        "limitations": "Local footprint about 77.3709-77.5035 E, 18.0965-18.3686 N; product is remotely tracked.",
    },
    {
        "key": "hirise_dtm",
        "name": "HiRISE stereo DTM",
        "path": REPOSITORY_ROOT / "GIS" / "raw_data" / "DTEEC_022680_1985_022746_1985_A01.IMG",
        "product_id": "DTEEC_022680_1985_022746_1985_A01",
        "instrument": "HiRISE stereo",
        "mission": "Mars Reconnaissance Orbiter",
        "organization": "University of Arizona HiRISE PDS",
        "url": HIRISE_SOURCE + "DTEEC_022680_1985_022746_1985_A01.IMG",
        "product_type": "Digital terrain model",
        "processing_level": "Stereo DTM",
        "label": REPOSITORY_ROOT / "GIS" / "raw_data" / "DTEEC_022680_1985_022746_1985_A01.IMG",
        "label_embedded": True,
        "label_url": HIRISE_SOURCE + "DTEEC_022680_1985_022746_1985_A01.IMG",
        "horizontal_units": "metres in map projection",
        "vertical_units": "metres",
        "vertical_reference": "Mars 2000 equipotential surface (from embedded PDS label)",
        "limitations": "About 1.0097 m/pixel; local-only and not available from remote main; accuracy is distinct from pixel spacing.",
    },
    {
        "key": "hirise_red",
        "name": "HiRISE RED orthorectified image",
        "path": REPOSITORY_ROOT / "GIS" / "raw_data" / "ESP_022680_1985_RED_A_01_ORTHO.JP2",
        "product_id": "ESP_022680_1985_RED_A_01_ORTHO",
        "instrument": "HiRISE RED",
        "mission": "Mars Reconnaissance Orbiter",
        "organization": "University of Arizona HiRISE PDS",
        "url": HIRISE_SOURCE + "ESP_022680_1985_RED_A_01_ORTHO.JP2",
        "product_type": "RED orthorectified image",
        "processing_level": "Orthorectified image",
        "label": REPOSITORY_ROOT / "GIS" / "documentation" / "source_labels" / "ESP_022680_1985_RED_A_01_ORTHO.LBL",
        "label_url": HIRISE_SOURCE + "ESP_022680_1985_RED_A_01_ORTHO.LBL",
        "horizontal_units": "metres in map projection",
        "vertical_units": "not applicable",
        "vertical_reference": "not applicable",
        "limitations": "About 0.2524 m/pixel; local-only; display DN to I/F conversion and label must be preserved.",
    },
]


def relative_path(path):
    try:
        return Path(path).resolve().relative_to(REPOSITORY_ROOT).as_posix()
    except ValueError:
        return Path(path).as_posix()
