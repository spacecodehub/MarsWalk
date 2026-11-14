from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from science_engine.meda_processor import process_pressure_product, quality_filter, read_product_metadata
from science_engine.observations import CatalogueError, filter_observations, load_observations, validate_observations
from science_engine.recommendations import recommendations_for_target
from science_engine.science_service import ScienceService
from science_engine.targets import load_targets, rank_targets, score_target


ROOT = Path(__file__).resolve().parents[1]


class ObservationTests(unittest.TestCase):
    def test_catalogue_is_traceable_filterable_and_unique(self):
        rows = load_observations(ROOT / "data/science/observations/observations.json")
        self.assertEqual(len(rows), 2)
        self.assertTrue(all(row["source_url"].startswith("https://") for row in rows))
        self.assertEqual(len(filter_observations(rows, instrument="Mastcam-Z", sol=466)), 1)
        with self.assertRaisesRegex(CatalogueError, "Duplicate"):
            validate_observations([rows[0], rows[0]])

    def test_coordinates_require_valid_ranges_and_crs(self):
        row = {
            "record_id": "test", "mission": "Mars 2020", "instrument": "Navcam",
            "source_url": "https://example.test", "description": "test fixture",
            "sols": [1], "coordinates": {"latitude_deg": 91, "longitude_east_deg": 1}, "crs": "test",
        }
        with self.assertRaisesRegex(CatalogueError, "coordinates"):
            validate_observations([row])


class MedaTests(unittest.TestCase):
    def setUp(self):
        self.raw = ROOT / "data/science/meda/raw"
        self.csv = self.raw / "WE__0001___________DER_PS__________________P02.CSV"
        self.xml = self.raw / "WE__0001___________DER_PS__________________P02.xml"

    def test_pds_label_and_real_product_metadata(self):
        metadata = read_product_metadata(self.xml)
        self.assertEqual(metadata["start_sol"], 1)
        self.assertEqual(metadata["declared_records"], 2330)
        self.assertEqual(metadata["processing_level"], "Derived")
        self.assertEqual(metadata["product_filename"], self.csv.name)

    def test_real_product_processing_preserves_provenance_and_outputs_plot(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "processed"
            reports = Path(temporary) / "reports"
            result = process_pressure_product(self.csv, self.xml, output, reports)
            self.assertEqual(result["row_count"], 2330)
            self.assertEqual(result["valid_row_count"], 2330)
            self.assertTrue(result["historical_measurements"])
            self.assertEqual(result["measurement"]["unit"], "Pa")
            self.assertFalse(result["quality_flags_present"])
            self.assertTrue((output / result["clean_csv"]).is_file())
            self.assertTrue((output / result["summary_json"]).is_file())
            self.assertTrue((reports / result["plot_png"]).is_file())

    def test_quality_filter_handles_missing_sentinel_nonfinite_and_bad_time(self):
        import pandas as pd
        fixture = pd.DataFrame({
            "PRESSURE": [700, "", 999999999, -2, "inf", 701],
            "LTST": ["0001 12:00:00", "0001 12:00:01", "0001 12:00:02",
                     "0001 12:00:03", "0001 12:00:04", ""],
        })
        _, valid, counts = quality_filter(fixture)
        self.assertEqual(valid.tolist(), [True, False, False, False, False, False])
        self.assertEqual(counts["missing_pressure"], 1)
        self.assertEqual(counts["sentinel_pressure"], 1)
        self.assertEqual(counts["nonfinite_pressure"], 1)
        self.assertEqual(counts["nonpositive_pressure"], 1)
        self.assertEqual(counts["missing_local_time"], 1)

    def test_checksum_and_schema_mismatch_are_rejected(self):
        with tempfile.TemporaryDirectory() as temporary:
            changed = Path(temporary) / self.csv.name
            changed.write_bytes(self.csv.read_bytes() + b"\n")
            with self.assertRaisesRegex(ValueError, "checksum"):
                process_pressure_product(changed, self.xml, Path(temporary) / "out", Path(temporary) / "reports")
            changed_label = Path(temporary) / self.xml.name
            changed_label.write_text(
                self.xml.read_text(encoding="utf-8").replace("<records>2330</records>", "<records>2331</records>"),
                encoding="utf-8",
            )
            with self.assertRaisesRegex(ValueError, "row count"):
                process_pressure_product(self.csv, changed_label, Path(temporary) / "out2", Path(temporary) / "reports2")


class TargetTests(unittest.TestCase):
    def setUp(self):
        observations = load_observations(ROOT / "data/science/observations/observations.json")
        self.targets = load_targets(
            ROOT / "data/science/targets/targets.json", {row["record_id"] for row in observations}
        )

    def test_target_evidence_priority_and_recommendations(self):
        ranked = rank_targets(self.targets)
        self.assertEqual(ranked[0]["target_id"], "jezero-western-delta")
        priority = ranked[0]["scientific_priority"]
        self.assertEqual(priority["score"], 86.3)
        self.assertIn("terrain danger", priority["excludes"])
        self.assertGreaterEqual(len(recommendations_for_target(ranked[0])), 1)

    def test_missing_priority_inputs_remain_unscored(self):
        self.assertIsNone(score_target({"priority_inputs": {}}))


class ServiceTests(unittest.TestCase):
    def test_facade_loads_data_and_generates_environment_summary(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "data/science/observations").mkdir(parents=True)
            (root / "data/science/targets").mkdir(parents=True)
            (root / "data/science/meda/raw").mkdir(parents=True)
            (root / "data/science/meda/processed").mkdir(parents=True)
            (root / "data/science/meda/reports").mkdir(parents=True)
            (root / "data/science/observations/observations.json").write_bytes(
                (ROOT / "data/science/observations/observations.json").read_bytes()
            )
            (root / "data/science/targets/targets.json").write_bytes(
                (ROOT / "data/science/targets/targets.json").read_bytes()
            )
            for file in (ROOT / "data/science/meda/raw").iterdir():
                (root / "data/science/meda/raw" / file.name).write_bytes(file.read_bytes())
            service = ScienceService(root)
            summary = service.meda_pressure_summary(
                root / "data/science/meda/raw/WE__0001___________DER_PS__________________P02.CSV",
                root / "data/science/meda/raw/WE__0001___________DER_PS__________________P02.xml",
            )
            self.assertEqual(len(service.list_observations()), 2)
            self.assertEqual(len(service.list_targets()), 1)
            self.assertEqual(summary["measurement"]["unit"], "Pa")


if __name__ == "__main__":
    unittest.main()
