import argparse
import array
import json
import re
import struct
import sys
import zlib
from bisect import bisect_right
from pathlib import Path


WIDTH = 5760
HEIGHT = 2880
SAMPLE_STEP = 4
COLOR_STOPS = [
    (-8177, "170f23"),
    (-6000, "211e3d"),
    (-4000, "303252"),
    (-2000, "465064"),
    (-1000, "69665e"),
    (0, "978068"),
    (1000, "b18f6d"),
    (3000, "c6a377"),
    (6000, "d9bf91"),
    (10000, "e7d5aa"),
    (15000, "f1e4c4"),
    (21171, "fff2df"),
]
COLOR_THRESHOLDS = [stop[0] for stop in COLOR_STOPS]
SOURCE_URL = (
    "https://pds-geosciences.wustl.edu/mgs/"
    "urn-nasa-pds-mgs_mola_topography_derived/meg016/"
)


def parse_args():
    root = Path(__file__).resolve().parents[2]
    parser = argparse.ArgumentParser(
        description="Render a lightweight global PNG from the MOLA MEGDR raster."
    )
    parser.add_argument(
        "--source",
        type=Path,
        default=root / "GIS" / "raw_data" / "MOLA_MEgdr16ppd" / "megt90n000eb.img",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=root / "public" / "mars-mola-elevation.png",
    )
    return parser.parse_args()


def parse_envi_header(header_path):
    if not header_path.is_file():
        raise FileNotFoundError(f"ENVI header not found: {header_path}")

    fields = {}
    for line in header_path.read_text(encoding="utf-8").splitlines():
        match = re.match(r"\s*([^=]+?)\s*=\s*(.*?)\s*$", line)
        if match:
            fields[match.group(1).strip().lower()] = match.group(2).strip()

    expected = {
        "samples": str(WIDTH),
        "lines": str(HEIGHT),
        "bands": "1",
        "data type": "2",
        "byte order": "1",
    }
    for key, value in expected.items():
        if fields.get(key) != value:
            raise ValueError(
                f"Unexpected ENVI header value for {key!r}: "
                f"{fields.get(key)!r} (expected {value!r})"
            )

    try:
        nodata = int(fields["data ignore value"])
    except (KeyError, ValueError) as error:
        raise ValueError("ENVI header must specify an integer data ignore value.") from error
    return nodata


def png_chunk(chunk_type, data):
    checksum = zlib.crc32(chunk_type + data) & 0xFFFFFFFF
    return struct.pack(">I", len(data)) + chunk_type + data + struct.pack(">I", checksum)


def color_for(value):
    upper = bisect_right(COLOR_THRESHOLDS, value)
    if upper == 0:
        return bytes.fromhex(COLOR_STOPS[0][1])
    if upper == len(COLOR_STOPS):
        return bytes.fromhex(COLOR_STOPS[-1][1])

    low_value, low_hex = COLOR_STOPS[upper - 1]
    high_value, high_hex = COLOR_STOPS[upper]
    fraction = (value - low_value) / (high_value - low_value)
    low_rgb = bytes.fromhex(low_hex)
    high_rgb = bytes.fromhex(high_hex)
    return bytes(
        round(low + (high - low) * fraction)
        for low, high in zip(low_rgb, high_rgb)
    )


COLOR_LUT = tuple(color_for(value) for value in range(-32768, 32768))


def render(source, output, nodata):
    expected_size = WIDTH * HEIGHT * 2
    raw = source.read_bytes()
    if len(raw) != expected_size:
        raise ValueError(
            f"Expected {expected_size:,} raster bytes, found {len(raw):,}: {source}"
        )

    elevations = array.array("h")
    if elevations.itemsize != 2:
        raise RuntimeError("This platform does not provide 16-bit signed integers.")
    elevations.frombytes(raw)
    if sys.byteorder == "little":
        elevations.byteswap()

    actual_min = min(elevations)
    actual_max = max(elevations)
    output_width = WIDTH // SAMPLE_STEP
    output_height = HEIGHT // SAMPLE_STEP
    compressed_rows = zlib.compressobj(level=9)
    compressed_data = bytearray()

    for output_y in range(output_height):
        source_y = output_y * SAMPLE_STEP + SAMPLE_STEP // 2
        row = bytearray([0])
        for output_x in range(output_width):
            source_x = (
                (output_x + output_width // 2) % output_width
            ) * SAMPLE_STEP + SAMPLE_STEP // 2
            value = elevations[source_y * WIDTH + source_x]
            if value == nodata:
                row.extend((17, 21, 18, 0))
            else:
                row.extend(COLOR_LUT[value + 32768])
                row.append(255)
        compressed_data.extend(compressed_rows.compress(row))

    compressed_data.extend(compressed_rows.flush())
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("wb") as png:
        png.write(b"\x89PNG\r\n\x1a\n")
        png.write(
            png_chunk(
                b"IHDR",
                struct.pack(">IIBBBBB", output_width, output_height, 8, 6, 0, 0, 0),
            )
        )
        png.write(png_chunk(b"IDAT", compressed_data))
        png.write(png_chunk(b"IEND", b""))

    metadata = {
        "product_id": "MEGT90N000EB.IMG",
        "dataset_id": "MGS-M-MOLA-5-MEGDR-L3-V1.0",
        "source_url": SOURCE_URL,
        "elevation_reference": "MOLA areoid; values are in meters above the areoid",
        "input_dimensions": [WIDTH, HEIGHT],
        "output_dimensions": [output_width, output_height],
        "sample_step": SAMPLE_STEP,
        "rendered_elevation_range_m": [actual_min, actual_max],
        "no_data_value": nodata,
        "projection": "Simple cylindrical (equirectangular), planetocentric",
        "longitude_direction": "east-positive",
        "display_only": True,
        "limitations": [
            "The rendered PNG is a visualization, not an analysis raster.",
            "MOLA's nominal equatorial pixel scale is about 3.705 km.",
            "Not suitable for rover-scale terrain or route-safety assessment.",
        ],
    }
    output.with_suffix(".json").write_text(
        json.dumps(metadata, indent=2) + "\n", encoding="utf-8"
    )
    print(
        f"Rendered {output_width}x{output_height} PNG from "
        f"{source.name} (elevation {actual_min} to {actual_max} m)."
    )


def main():
    args = parse_args()
    if not args.source.is_file():
        raise FileNotFoundError(f"MOLA topography raster not found: {args.source}")
    nodata = parse_envi_header(args.source.with_suffix(".hdr"))
    render(args.source, args.output, nodata)


if __name__ == "__main__":
    main()
