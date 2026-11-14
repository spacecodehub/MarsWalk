from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from science_engine.meda_processor import process_pressure_product, quality_filter, read_product_metadata
from science_engine.observations import CatalogueError, filter_observations, load_observations, validate_observations
from science_engine.recommendations import recommendations_for_target
from science_engine.science_service import ScienceService
from science_engine.target_integration import serialize_science_targets
from science_engine.targets import load_targets, rank_targets, score_target, validate_targets


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

    def test_projected_target_coordinates_require_finite_xy_crs_and_units(self):
        target = {
            "target_id": "projected-test", "coordinates": {"x": 120.5, "y": -8.0},
            "crs": "MOCK:GRID", "coordinate_units": "m", "evidence_sources": [{}],
        }
        self.assertEqual(validate_targets([target], set()), [target])
        invalid = {**target, "coordinates": {"x": float("nan"), "y": 2.0}}
        with self.assertRaisesRegex(CatalogueError, "projected coordinates"):
            validate_targets([invalid], set())


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

    def test_existing_outputs_are_preserved_without_explicit_overwrite(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "processed"
            reports = Path(temporary) / "reports"
            output.mkdir()
            reports.mkdir()
            clean_path = output / f"{self.csv.stem}_clean.csv"
            summary_path = output / f"{self.csv.stem}_summary.json"
            plot_path = reports / f"{self.csv.stem}_pressure.png"
            clean_path.write_text("keep this output", encoding="utf-8")
            summary_path.write_text("keep this summary", encoding="utf-8")
            plot_path.write_bytes(b"keep this plot")
            with self.assertRaisesRegex(FileExistsError, "overwrite=True"):
                process_pressure_product(self.csv, self.xml, output, reports)
            self.assertEqual(clean_path.read_text(encoding="utf-8"), "keep this output")
            self.assertEqual(summary_path.read_text(encoding="utf-8"), "keep this summary")
            self.assertEqual(plot_path.read_bytes(), b"keep this plot")
            result = process_pressure_product(self.csv, self.xml, output, reports, overwrite=True)
            self.assertEqual(result["valid_row_count"], 2330)
            self.assertNotEqual(clean_path.read_text(encoding="utf-8"), "keep this output")

    def test_output_paths_cannot_overwrite_selected_raw_label(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            csv_path = root / "sample.csv"
            csv_bytes = self.csv.read_bytes()
            csv_path.write_bytes(csv_bytes)
            label_bytes = self.xml.read_text(encoding="utf-8")
            label_bytes = label_bytes.replace(
                "WE__0001___________DER_PS__________________P02.CSV", "sample.csv"
            )
            output = root / "output"
            output.mkdir()
            colliding_label = output / "sample_summary.json"
            colliding_label.write_text(label_bytes, encoding="utf-8")
            before = colliding_label.read_bytes()
            with self.assertRaisesRegex(ValueError, "must not overwrite"):
                process_pressure_product(csv_path, colliding_label, output, root / "reports", overwrite=True)
            self.assertEqual(csv_path.read_bytes(), csv_bytes)
            self.assertEqual(colliding_label.read_bytes(), before)


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
                output_dir=root / "data/science/meda/processed",
                report_dir=root / "data/science/meda/reports",
            )
            self.assertEqual(len(service.list_observations()), 2)
            self.assertEqual(len(service.list_targets()), 1)
            self.assertEqual(summary["measurement"]["unit"], "Pa")


class ScienceTargetIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.service = ScienceService(ROOT)

    def test_real_targets_have_shared_schema_and_p4_p5_policies(self):
        p4 = self.service.targets_for_p4_route_planning()
        p5 = self.service.targets_for_p5_map()
        schema = json.loads(
            (ROOT / "docs/schemas/p6_science_targets.schema.json").read_text(encoding="utf-8")
        )
        required = {
            "target_id", "name", "science_category", "location", "priority_score",
            "priority", "scientific_justification", "provenance", "data_quality", "availability",
        }
        self.assertEqual(p4["schema_version"], "1.0")
        self.assertEqual(p5["schema_version"], "1.0")
        self.assertTrue(set(schema["required"]).issubset(p4))
        self.assertEqual(set(schema["$defs"]["target"]["required"]), required)
        self.assertEqual(
            set(p4["coordinate_reference"]),
            set(schema["properties"]["coordinate_reference"]["required"]),
        )
        self.assertEqual(p4["consumer"], "p4_route_planning")
        self.assertEqual(p5["consumer"], "p5_map_visualization")
        self.assertEqual(set(p4["targets"][0]), required)
        self.assertEqual(p4["targets"][0], p5["targets"][0])
        target = p4["targets"][0]
        self.assertEqual(target["target_id"], "jezero-western-delta")
        self.assertEqual(target["priority_score"], 86.3)
        self.assertEqual(target["priority"]["role"], "advisory_only")
        self.assertEqual(target["priority"]["inputs"]["scientific_significance"], 4.0)
        self.assertIn("terrain danger", target["priority"]["excludes"])
        self.assertIsNone(target["location"])
        self.assertEqual(target["availability"]["display_policy"], "list_only_unlocated")
        self.assertEqual(target["data_quality"]["uncertainty"]["status"], "not_quantified")
        for key in ("priority", "scientific_justification", "provenance", "data_quality", "availability"):
            self.assertEqual(
                set(target[key]),
                set(schema["$defs"]["target"]["properties"][key]["required"]),
            )
        self.assertEqual(
            target["provenance"]["supporting_observation_ids"],
            ["NASA-SCIENCE-RESOURCE:perseverance-explores-jezero-delta"],
        )
        self.assertEqual(len(target["provenance"]["observations"]), 1)
        self.assertTrue(target["provenance"]["observations"][0]["source_url"].startswith("https://science.nasa.gov/"))
        self.assertFalse(any("MEDA" in source.get("source_type", "") for source in target["provenance"]["sources"]))
        self.assertTrue(p4["route_planning_policy"]["hard_safety_constraints_are_mandatory"])
        self.assertFalse(p4["route_planning_policy"]["science_priority_may_override_hard_safety_constraints"])
        self.assertEqual(p5["map_display_policy"]["unlocated_target_display"], "list_only_unlocated")

    def test_mock_fixture_exercises_explicit_coordinate_transform(self):
        fixture = json.loads((ROOT / "tests/fixtures/mock_science_targets.json").read_text(encoding="utf-8"))
        self.assertEqual(fixture["fixture_type"], "MOCK_ONLY_NOT_MARS_DATA")
        calls = []

        def mock_transform(x, y, source_crs, target_crs):
            calls.append((source_crs, target_crs))
            return x / 1000, y / 1000

        payload = serialize_science_targets(
            fixture["targets"],
            consumer="p5_map_visualization",
            target_crs="MOCK:ROUTE_GRID_KILOMETERS",
            target_units="km",
            coordinate_transform=mock_transform,
        )
        target = payload["targets"][0]
        schema = json.loads(
            (ROOT / "docs/schemas/p6_science_targets.schema.json").read_text(encoding="utf-8")
        )
        self.assertEqual(set(target), set(schema["$defs"]["target"]["required"]))
        self.assertEqual(set(target["location"]), set(schema["$defs"]["location"]["required"]))
        self.assertEqual(
            set(target["location"]["coordinates"]),
            set(schema["$defs"]["location"]["properties"]["coordinates"]["required"]),
        )
        self.assertEqual(target["location"]["coordinates"], {"x": 1.25, "y": 2.4})
        self.assertEqual(target["location"]["crs"], "MOCK:ROUTE_GRID_KILOMETERS")
        self.assertEqual(target["location"]["units"], "km")
        self.assertEqual(target["location"]["transformation"]["method"], "caller_supplied_adapter")
        self.assertEqual(calls, [("MOCK:LOCAL_METERS", "MOCK:ROUTE_GRID_KILOMETERS")])

    def test_missing_coordinates_stay_missing_and_unknown_transform_is_rejected(self):
        actual = self.service.targets_for_p5_map(
            target_crs="P2:NOT_YET_AVAILABLE",
            coordinate_transform=lambda *_: self.fail("must not transform an unlocated target"),
        )
        self.assertIsNone(actual["targets"][0]["location"])
        fixture = json.loads((ROOT / "tests/fixtures/mock_science_targets.json").read_text(encoding="utf-8"))
        with self.assertRaisesRegex(CatalogueError, "needs a coordinate transform"):
            serialize_science_targets(
                fixture["targets"], consumer="p4_route_planning", target_crs="MOCK:OTHER_GRID"
            )


if __name__ == "__main__":
    unittest.main()
