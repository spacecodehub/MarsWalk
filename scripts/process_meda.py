"""Process the checked-in sample PDS MEDA derived pressure product."""

import argparse
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from science_engine.meda_processor import process_pressure_product

RAW = ROOT / "data/science/meda/raw"


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Process the checked-in MEDA sol-1 pressure product.")
    parser.add_argument(
        "--output-dir", type=Path, default=ROOT / "data/science/meda/processed",
        help="directory for the cleaned CSV and summary JSON (default: data/science/meda/processed)",
    )
    parser.add_argument(
        "--report-dir", type=Path, default=ROOT / "data/science/meda/reports",
        help="directory for the pressure plot (default: data/science/meda/reports)",
    )
    parser.add_argument(
        "--overwrite", action="store_true",
        help="replace generated outputs with matching names; raw inputs are never overwritten",
    )
    args = parser.parse_args()
    result = process_pressure_product(
        RAW / "WE__0001___________DER_PS__________________P02.CSV",
        RAW / "WE__0001___________DER_PS__________________P02.xml",
        args.output_dir,
        args.report_dir,
        overwrite=args.overwrite,
    )
    print(f"Valid readings: {result['valid_row_count']} / {result['row_count']}")
    print(f"Mean pressure: {result['measurement']['mean']:.2f} Pa")
    print(f"Summary: {result['summary_json']}")
    print(f"Plot: {result['plot_png']}")
