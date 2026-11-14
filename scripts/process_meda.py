"""Process the checked-in sample PDS MEDA derived pressure product."""

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from science_engine.meda_processor import process_pressure_product

RAW = ROOT / "data/science/meda/raw"


if __name__ == "__main__":
    result = process_pressure_product(
        RAW / "WE__0001___________DER_PS__________________P02.CSV",
        RAW / "WE__0001___________DER_PS__________________P02.xml",
        ROOT / "data/science/meda/processed",
        ROOT / "data/science/meda/reports",
    )
    print(f"Valid readings: {result['valid_row_count']} / {result['row_count']}")
    print(f"Mean pressure: {result['measurement']['mean']:.2f} Pa")
    print(f"Summary: {result['summary_json']}")
    print(f"Plot: {result['plot_png']}")
