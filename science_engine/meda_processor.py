"""Reproducible processing for NASA PDS4 MEDA environmental RDR products."""

from __future__ import annotations

import hashlib
import json
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd


PDS_NS = "{http://pds.nasa.gov/pds4/pds/v1}"
MARS2020_NS = "{http://pds.nasa.gov/pds4/mission/mars2020/v1}"
MISSING_SENTINEL = 999999999


def _text(root: ET.Element, path: str, default: str | None = None) -> str | None:
    item = root.find(path)
    return item.text.strip() if item is not None and item.text else default


def read_product_metadata(label_path: str | Path) -> dict[str, Any]:
    root = ET.parse(label_path).getroot()

    def pds(path: str, default: str | None = None) -> str | None:
        return _text(root, "/".join(PDS_NS + part for part in path.split("/")), default)

    sol_base = (
        f"{PDS_NS}Observation_Area/{PDS_NS}Mission_Area/"
        f"{MARS2020_NS}Mars2020_Parameters/{MARS2020_NS}Observation_Information/"
    )
    def mars_sol(which: str) -> int:
        value = root.findtext(sol_base + MARS2020_NS + f"{which}_sol_number")
        return int(value or "0")

    return {
        "product_lid": pds("Identification_Area/logical_identifier"),
        "product_version": pds("Identification_Area/version_id"),
        "product_title": pds("Identification_Area/title"),
        "processing_level": pds("Observation_Area/Primary_Result_Summary/processing_level"),
        "start_time_utc": pds("Observation_Area/Time_Coordinates/start_date_time"),
        "stop_time_utc": pds("Observation_Area/Time_Coordinates/stop_date_time"),
        "start_sol": mars_sol("start"),
        "stop_sol": mars_sol("stop"),
        "product_filename": pds("File_Area_Observational/File/file_name"),
        "declared_md5": pds("File_Area_Observational/File/md5_checksum"),
        "declared_records": int(pds("File_Area_Observational/Table_Delimited/records", "0")),
        "fields": [
            {"name": field.findtext(f"{PDS_NS}name"), "unit": field.findtext(f"{PDS_NS}unit")}
            for field in root.findall(f".//{PDS_NS}Field_Delimited")
        ],
    }


def quality_filter(frame: pd.DataFrame) -> tuple[pd.Series, pd.Series, dict[str, int]]:
    """Return pressure values, a keep mask, and independent filter-reason counts."""
    pressure = pd.to_numeric(frame["PRESSURE"], errors="coerce")
    sentinel = pressure.eq(MISSING_SENTINEL)
    missing = pressure.isna()
    finite = pd.Series(np.isfinite(pressure.to_numpy(dtype=float, na_value=np.nan)), index=frame.index)
    nonfinite = ~finite & ~missing & ~sentinel
    nonpositive = pressure.le(0) & ~missing & ~sentinel
    invalid_time = frame["LTST"].astype(str).str.strip().eq("")
    valid = ~missing & ~sentinel & finite & ~nonpositive & ~invalid_time
    counts = {
        "missing_pressure": int(missing.sum()),
        "sentinel_pressure": int(sentinel.sum()),
        "nonfinite_pressure": int(nonfinite.sum()),
        "nonpositive_pressure": int(nonpositive.sum()),
        "missing_local_time": int(invalid_time.sum()),
    }
    return pressure, valid, counts


def process_pressure_product(
    csv_path: str | Path,
    label_path: str | Path,
    output_dir: str | Path,
    report_dir: str | Path,
) -> dict[str, Any]:
    """Clean a single PDS MEDA derived pressure product without changing raw files."""
    csv_path, label_path = Path(csv_path), Path(label_path)
    output_dir, report_dir = Path(output_dir), Path(report_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    report_dir.mkdir(parents=True, exist_ok=True)

    metadata = read_product_metadata(label_path)
    if not metadata["product_lid"] or metadata["processing_level"] != "Derived":
        raise ValueError("Expected a labelled PDS MEDA derived product")
    if csv_path.name != metadata["product_filename"]:
        raise ValueError("CSV filename does not match its detached PDS4 label")

    raw_bytes = csv_path.read_bytes()
    actual_md5 = hashlib.md5(raw_bytes).hexdigest()
    if metadata["declared_md5"] and actual_md5.lower() != metadata["declared_md5"].lower():
        raise ValueError("PDS4 label checksum does not match the raw CSV")

    frame = pd.read_csv(csv_path, keep_default_na=False)
    expected_columns = ["SCLK", "LMST", "LTST", "PRESSURE", "PRESSURE_UNCERTAINTY", "TRANSDUCER"]
    label_columns = [str(field["name"]).upper().replace(" ", "_") for field in metadata["fields"]]
    if list(frame.columns) != expected_columns or label_columns != expected_columns:
        raise ValueError(f"Unexpected MEDA pressure columns: {list(frame.columns)}")
    label_units = {
        str(field["name"]).upper().replace(" ", "_"): field["unit"]
        for field in metadata["fields"]
    }
    if label_units.get("PRESSURE", "").lower() not in {"pascal", "pa"}:
        raise ValueError("PDS4 label does not declare pressure in pascals")
    if metadata["declared_records"] and len(frame) != metadata["declared_records"]:
        raise ValueError("CSV row count does not match the PDS4 label")

    pressure, valid, filtered_counts = quality_filter(frame)

    clean = pd.DataFrame(
        {
            "sol": metadata["start_sol"],
            "sclk_seconds": pd.to_numeric(frame.loc[valid, "SCLK"], errors="coerce").to_numpy(),
            "lmst": frame.loc[valid, "LMST"].astype(str).to_numpy(),
            "ltst": frame.loc[valid, "LTST"].astype(str).to_numpy(),
            "pressure_pa": pressure.loc[valid].astype(float).to_numpy(),
            "transducer": pd.to_numeric(frame.loc[valid, "TRANSDUCER"], errors="coerce").to_numpy(),
        }
    )
    if clean.empty:
        raise ValueError("No valid pressure records remain after documented quality filtering")

    product_stem = csv_path.stem
    clean_path = output_dir / f"{product_stem}_clean.csv"
    clean.to_csv(clean_path, index=False)
    pressure_np = clean["pressure_pa"].to_numpy(dtype=float)
    summary = {
        "dataset": metadata["product_title"],
        "product_lid": metadata["product_lid"],
        "source_filename": csv_path.name,
        "processing_level": metadata["processing_level"],
        "historical_measurements": True,
        "rover_local_measurements_not_forecast": True,
        "sol": metadata["start_sol"],
        "product_start_time_utc": metadata["start_time_utc"],
        "product_stop_time_utc": metadata["stop_time_utc"],
        "row_count": int(len(frame)),
        "valid_row_count": int(valid.sum()),
        "filtered_counts": filtered_counts,
        "quality_flags_present": False,
        "quality_rule": "Keep finite positive PRESSURE values; drop PDS missing sentinel 999999999, missing pressure, and rows without LTST. This product has no quality-flag column.",
        "measurement": {
            "name": "atmospheric pressure",
            "unit": "Pa",
            "minimum": float(np.min(pressure_np)),
            "maximum": float(np.max(pressure_np)),
            "mean": float(np.mean(pressure_np)),
            "median": float(np.median(pressure_np)),
            "standard_deviation_population": float(np.std(pressure_np, ddof=0)),
        },
        "time_basis": "SCLK, LMST and LTST are retained from the PDS table. Per-row UTC is not present in this product; only product-level UTC bounds are supplied by its label.",
        "raw_file_sha256": hashlib.sha256(raw_bytes).hexdigest(),
        "raw_file_md5_verified": actual_md5,
        "clean_csv": clean_path.name,
    }

    summary_path = output_dir / f"{product_stem}_summary.json"
    plot_path = report_dir / f"{product_stem}_pressure.png"
    elapsed = clean["sclk_seconds"].to_numpy(dtype=float) - float(clean["sclk_seconds"].iloc[0])
    fig, ax = plt.subplots(figsize=(10, 4.6), constrained_layout=True)
    ax.scatter(elapsed, pressure_np, s=7, color="#c44e35", linewidths=0)
    ax.set(title=f"Perseverance MEDA pressure — Sol {metadata['start_sol']} (historical)",
           xlabel="Elapsed time from first retained reading (s)", ylabel="Pressure (Pa)")
    ax.grid(True, alpha=0.25)
    ax.text(0.01, 0.02, "PDS derived data · rover-local historical measurement · not a forecast",
            transform=ax.transAxes, fontsize=8, color="#444444")
    fig.savefig(plot_path, dpi=150)
    plt.close(fig)

    summary["summary_json"] = summary_path.name
    summary["plot_png"] = plot_path.name
    summary_path.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    return summary
