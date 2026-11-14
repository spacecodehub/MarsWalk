from __future__ import annotations

import asyncio
import json
import os
import tempfile
import unittest
import unittest.mock
from pathlib import Path
from typing import Any

import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.transform import from_origin

from a_star import MarsRoutePlanner, RouteError, SafetyConstraints
from science_adapter import P6ScienceAdapter, science_interest_grid
from terrain_adapter import P2TerrainAdapter, RasterMetadata, TerrainDataError, load_aligned_terrain
from terrain_risk import calculate_terrain_risk


MARS_CRS = CRS.from_proj4(
    "+proj=eqc +lat_ts=18.4663 +lat_0=0 +lon_0=0 +x_0=0 +y_0=0 +R=3396190 +units=m +no_defs"
)


def write_raster(path: Path, data: np.ndarray, *, transform=None, crs=MARS_CRS, nodata=-9999.0, unit=None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with rasterio.open(
        path, "w", driver="GTiff", height=data.shape[0], width=data.shape[1],
        count=1, dtype=data.dtype, crs=crs,
        transform=transform or from_origin(0, data.shape[0] * 5, 5, 5), nodata=nodata,
    ) as dst:
        dst.write(data, 1)
        if unit:
            dst.set_band_unit(1, unit)


def make_layers(root: Path, *, shape=(5, 5), bad_slope=None, bad_roughness=None, dem_values=None, nodata_cell=None, transform=None):
    transform = transform or from_origin(0, shape[0] * 5, 5, 5)
    dem = np.full(shape, 100.0, dtype=np.float32) if dem_values is None else np.asarray(dem_values, dtype=np.float32)
    slope = np.full(shape, 5.0, dtype=np.float32)
    roughness = np.full(shape, 1.0, dtype=np.float32)
    if bad_slope:
        for r, c, value in bad_slope:
            slope[r, c] = value
    if bad_roughness:
        for r, c, value in bad_roughness:
            roughness[r, c] = value
    if nodata_cell:
        dem[nodata_cell] = -9999.0
    paths = [root / f"{name}.tif" for name in ("dem", "slope", "roughness")]
    write_raster(paths[0], dem, transform=transform, unit="m")
    write_raster(paths[1], slope, transform=transform, unit="degree")
    write_raster(paths[2], roughness, transform=transform, unit="m")
    return load_aligned_terrain(*paths), transform


def cell_xy(transform, row, col):
    return (transform.c + (col + 0.5) * transform.a + (row + 0.5) * transform.b,
            transform.f + (col + 0.5) * transform.d + (row + 0.5) * transform.e)


class PlannerTests(unittest.TestCase):
    def test_shortest_a_star_is_optimal_and_deterministic(self):
        with tempfile.TemporaryDirectory() as tmp:
            layers, aff = make_layers(Path(tmp))
            planner = MarsRoutePlanner(layers, safety=SafetyConstraints(None, None))
            start, goal = cell_xy(aff, 0, 0), cell_xy(aff, 4, 4)
            first = planner.find_path(start, goal, "shortest")
            second = planner.find_path(start, goal, "shortest")
            self.assertEqual(first, second)
            self.assertEqual(first[0], (0, 0))
            self.assertEqual(first[-1], (4, 4))
            self.assertAlmostEqual(planner.analyze_route(first, "shortest")["distance_m"], 4 * math_sqrt_2() * 5)

    def test_diagonal_corner_cutting_is_blocked(self):
        with tempfile.TemporaryDirectory() as tmp:
            layers, aff = make_layers(Path(tmp), shape=(2, 2), bad_slope=[(0, 1, 40), (1, 0, 40)])
            planner = MarsRoutePlanner(layers, safety=SafetyConstraints(25, None))
            with self.assertRaisesRegex(RouteError, "No safe route"):
                planner.find_path(cell_xy(aff, 0, 0), cell_xy(aff, 1, 1), "shortest")

    def test_all_objectives_share_hard_safety_mask(self):
        with tempfile.TemporaryDirectory() as tmp:
            layers, aff = make_layers(Path(tmp), shape=(7, 7), bad_slope=[(3, 3, 80)])
            target = _science_target("target", *cell_xy(aff, 3, 3), priority=100)
            planner = MarsRoutePlanner(layers, safety=SafetyConstraints(25, 5), science_targets=[target])
            start, goal = cell_xy(aff, 0, 0), cell_xy(aff, 6, 6)
            for mode in planner.MODES:
                path = planner.find_path(start, goal, mode)
                self.assertNotIn((3, 3), path)
                self.assertTrue(all(planner.valid[row, col] for row, col in path))

    def test_safest_route_avoids_high_risk_strip(self):
        with tempfile.TemporaryDirectory() as tmp:
            layers, aff = make_layers(Path(tmp), shape=(5, 7), bad_slope=[(r, 3, 20) for r in range(1, 4)])
            layers.slope[layers.slope != 20] = 0
            layers.roughness[:] = 0
            planner = MarsRoutePlanner(layers, safety=SafetyConstraints(25, None), risk_weight=10)
            path = planner.find_path(cell_xy(aff, 2, 0), cell_xy(aff, 2, 6), "safest")
            self.assertNotIn((2, 3), path)

    def test_slope_roughness_hazard_and_elevation_are_hard_exclusions(self):
        with tempfile.TemporaryDirectory() as tmp:
            layers, aff = make_layers(
                Path(tmp), shape=(5, 5), bad_slope=[(1, 1, 35)], bad_roughness=[(2, 2, 11)],
            )
            hazard = {"type": "Polygon", "coordinates": [[[15, 15], [20, 15], [20, 20], [15, 20], [15, 15]]]}
            planner = MarsRoutePlanner(
                layers, safety=SafetyConstraints(25, 5, min_elevation_m=90, max_elevation_m=110),
                hazard_features=[hazard], hazard_crs=MARS_CRS.to_string(),
            )
            self.assertFalse(planner.valid[1, 1])
            self.assertFalse(planner.valid[2, 2])
            self.assertFalse(planner.valid[1, 3])
            self.assertTrue(planner.excluded_counts["hazard"] > 0)

    def test_nodata_uncovered_and_unsafe_endpoints_are_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            layers, aff = make_layers(Path(tmp), shape=(3, 3), nodata_cell=(1, 1))
            planner = MarsRoutePlanner(layers, safety=SafetyConstraints(None, None))
            with self.assertRaisesRegex(RouteError, "uncovered"):
                planner.coordinate_to_cell(*cell_xy(aff, 1, 1))
            with self.assertRaises(RouteError):
                planner.find_path(cell_xy(aff, 0, 0), cell_xy(aff, 1, 1), "shortest")

    def test_science_route_uses_p6_priority_and_stays_on_safe_cells(self):
        with tempfile.TemporaryDirectory() as tmp:
            layers, aff = make_layers(Path(tmp), shape=(9, 9), bad_slope=[(4, 4, 80)])
            target = _science_target("safe-target", *cell_xy(aff, 4, 6), priority=100)
            planner = MarsRoutePlanner(layers, safety=SafetyConstraints(25, 5), science_targets=[target], science_influence_radius_m=20)
            path = planner.find_path(cell_xy(aff, 4, 0), cell_xy(aff, 4, 8), "science-aware")
            self.assertNotIn((4, 4), path)
            self.assertTrue(all(planner.valid[row, col] for row, col in path))
            self.assertGreater(float(np.max(planner.science)), 0)

    def test_science_mode_refuses_unlocated_targets_or_missing_targets(self):
        with tempfile.TemporaryDirectory() as tmp:
            layers, aff = make_layers(Path(tmp))
            planner = MarsRoutePlanner(layers, safety=SafetyConstraints(None, None))
            with self.assertRaisesRegex(RouteError, "no located"):
                planner.find_path(cell_xy(aff, 0, 0), cell_xy(aff, 4, 4), "science-aware")

    def test_geojson_coordinates_are_mars_longitude_then_latitude(self):
        with tempfile.TemporaryDirectory() as tmp:
            layers, aff = make_layers(Path(tmp))
            planner = MarsRoutePlanner(layers, safety=SafetyConstraints(None, None))
            route = planner.plan(cell_xy(aff, 1, 1), cell_xy(aff, 2, 2), "shortest")
            payload = json.loads(json.dumps(route["geojson"]))
            coords = payload["features"][0]["geometry"]["coordinates"]
            self.assertEqual(payload["type"], "FeatureCollection")
            self.assertEqual(payload["features"][0]["geometry"]["type"], "LineString")
            self.assertEqual(len(coords[0]), 2)
            self.assertEqual(route["coordinates_projected_m"][0], list(cell_xy(aff, 1, 1)))
            self.assertIn("Mars east-positive longitude", payload["coordinate_convention"])

    def test_input_coordinate_transformation(self):
        with tempfile.TemporaryDirectory() as tmp:
            layers, aff = make_layers(Path(tmp))
            planner = MarsRoutePlanner(layers, safety=SafetyConstraints(None, None))
            x, y = cell_xy(aff, 1, 1)
            from rasterio.warp import transform
            lon, lat = transform(MARS_CRS, MARS_CRS.geodetic_crs, [x], [y])
            self.assertEqual(planner.coordinate_to_cell(*planner.to_map_coordinates((lon[0], lat[0]), MARS_CRS.geodetic_crs.to_string())), (1, 1))

    def test_raster_grid_mismatch_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            transform = from_origin(0, 25, 5, 5)
            dem = np.ones((5, 5), np.float32)
            write_raster(root / "dem.tif", dem, transform=transform)
            write_raster(root / "slope.tif", dem, transform=transform)
            write_raster(root / "roughness.tif", dem, transform=from_origin(1, 25, 5, 5))
            with self.assertRaisesRegex(TerrainDataError, "not match DEM"):
                load_aligned_terrain(root / "dem.tif", root / "slope.tif", root / "roughness.tif")

    def test_p2_adapter_reads_documented_file_names_and_masks(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            names = {
                "dem": "DTEEC_022680_1985_022746_1985_A01_dem_5m.tif",
                "slope": "DTEEC_022680_1985_022746_1985_A01_slope_deg.tif",
                "aspect": "DTEEC_022680_1985_022746_1985_A01_aspect_deg.tif",
                "roughness": "DTEEC_022680_1985_022746_1985_A01_roughness_3x3_m.tif",
            }
            base = np.ones((3, 3), dtype=np.float32)
            for key, name in names.items():
                write_raster(root / name, base, nodata=-9999, unit="degree" if key in {"slope", "aspect"} else "m")
            adapter = P2TerrainAdapter(root, validate_documented_grid=False)
            self.assertTrue(adapter.available())
            layers = adapter.load()
            self.assertEqual(layers.valid.shape, (3, 3))
            self.assertEqual(layers.metadata["roughness"].unit, "m")

    def test_p2_documented_grid_contract(self):
        from rasterio import Affine
        from terrain_adapter import P2_EXPECTED_ORIGIN, P2_EXPECTED_SHAPE, P2TerrainAdapter
        affine = Affine(5, 0, P2_EXPECTED_ORIGIN[0], 0, -5, P2_EXPECTED_ORIGIN[1])
        wkt = 'PROJCS["EQUIRECTANGULAR MARS",SPHEROID["MARS_localRadius",3394839.8133163,0],PARAMETER["central_meridian",77.44]]'
        metadata = {}
        for name, unit, nodata in (("dem", "m", -3.4028227e38), ("slope", "degree", -9999),
                                    ("aspect", "degree", -9999), ("roughness", "m", -9999)):
            metadata[name] = RasterMetadata(
                path=name, width=1517, height=3224, crs_wkt=wkt,
                transform=tuple(affine), bounds=(0, 0, 0, 0), resolution=(5, 5),
                dtype="float32", nodata=nodata, unit=unit,
            )
        P2TerrainAdapter._validate_documented_grid(P2_EXPECTED_SHAPE, affine, metadata)
        with self.assertRaisesRegex(TerrainDataError, "dimensions"):
            P2TerrainAdapter._validate_documented_grid((100, 100), affine, metadata)

    def test_p6_adapter_scores_located_target_from_documented_inputs(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "targets.json"
            from rasterio.warp import transform
            x, y = 12.5, 12.5
            lon, lat = transform(MARS_CRS, MARS_CRS.geodetic_crs, [x], [y])
            path.write_text(json.dumps({
                "schema_version": "1.0", "targets": [{
                    "target_id": "mock-geolocated", "name": "Mock target", "coordinates": {"longitude_east_deg": lon[0], "latitude_deg": lat[0]},
                    "crs": MARS_CRS.geodetic_crs.to_string(), "geological_category": "deltaic",
                    "evidence_sources": [{"url": "https://example.test/source", "supports": "TEST FIXTURE ONLY"}],
                    "priority_inputs": {"scientific_significance": 4, "evidence_strength": 4, "observation_availability": 4, "geological_diversity": 4, "investigation_value": 4},
                }],
            }), encoding="utf-8")
            targets, unlocated = P6ScienceAdapter(path).load(MARS_CRS)
            self.assertFalse(unlocated)
            self.assertEqual(targets[0].priority, 100.0)
            self.assertAlmostEqual(targets[0].x, x, places=3)

    def test_p6_adapter_parses_schema_and_marks_unlocated_target(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "targets.json"
            path.write_text(json.dumps({
                "schema_version": "1.0", "targets": [{
                    "target_id": "actual-schema-shape", "name": "Delta panorama area",
                    "coordinates": None, "crs": None, "geological_category": "deltaic",
                    "evidence_sources": [{"url": "https://science.nasa.gov/resource/perseverance-explores-the-jezero-crater-delta/", "supports": "published panorama"}],
                    "priority_inputs": {"scientific_significance": 4, "evidence_strength": 3, "observation_availability": 3, "geological_diversity": 3, "investigation_value": 4},
                }],
            }), encoding="utf-8")
            targets, unlocated = P6ScienceAdapter(path).load(MARS_CRS)
            self.assertEqual(targets, [])
            self.assertIn("no coordinates or CRS", unlocated[0]["reason"])

    def test_relative_risk_is_not_used_as_a_safety_mask(self):
        risk = calculate_terrain_risk(
            np.array([[0, 35]], dtype=float), np.array([[0, 13]], dtype=float),
            np.array([[True, False]]),
        )
        self.assertAlmostEqual(float(risk[0, 0]), 0)
        self.assertTrue(np.isnan(risk[0, 1]))


def math_sqrt_2() -> float:
    return 2 ** 0.5


def _science_target(target_id: str, x: float, y: float, priority: float) -> Any:
    from science_adapter import ScienceTarget
    return ScienceTarget(target_id, target_id, "fixture", x, y, priority, ("fixture provenance",), ("fixture evidence",))


class APITests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from api import app
        cls.app = app

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        _, self.aff = make_layers(root / "rasters", shape=(5, 5))
        self.targets = root / "targets.json"
        x, y = cell_xy(self.aff, 2, 2)
        from rasterio.warp import transform
        lon, lat = transform(MARS_CRS, MARS_CRS.geodetic_crs, [x], [y])
        self.targets.write_text(json.dumps({
            "schema_version": "1.0", "targets": [{
                "target_id": "test-target", "name": "Test target", "coordinates": {"longitude_east_deg": lon[0], "latitude_deg": lat[0]},
                "crs": MARS_CRS.geodetic_crs.to_string(), "geological_category": "fixture",
                "evidence_sources": [{"url": "fixture", "supports": "mock only"}],
                "priority_inputs": {"scientific_significance": 4, "evidence_strength": 4, "observation_availability": 4, "geological_diversity": 4, "investigation_value": 4},
            }],
        }), encoding="utf-8")
        self.env = {
            "MARSWALK_DEM_PATH": str(root / "rasters" / "dem.tif"),
            "MARSWALK_SLOPE_PATH": str(root / "rasters" / "slope.tif"),
            "MARSWALK_ROUGHNESS_PATH": str(root / "rasters" / "roughness.tif"),
            "MARSWALK_P6_TARGETS": str(self.targets),
        }
        self.patch = unittest.mock.patch.dict(os.environ, self.env)
        self.patch.start()

    def tearDown(self):
        self.patch.stop()
        self.tmp.cleanup()

    def request(self, method: str, path: str, body: dict[str, Any] | None = None):
        sent = []
        body_bytes = json.dumps(body).encode() if body is not None else b""
        incoming = [{"type": "http.request", "body": body_bytes, "more_body": False}]

        async def receive():
            return incoming.pop(0) if incoming else {"type": "http.disconnect"}

        async def send(message):
            sent.append(message)

        scope = {
            "type": "http", "asgi": {"version": "3.0"}, "http_version": "1.1",
            "method": method, "scheme": "http", "path": path, "raw_path": path.encode(),
            "query_string": b"", "root_path": "",
            "client": ("127.0.0.1", 12345), "server": ("127.0.0.1", 80),
            "headers": [(b"host", b"test"), (b"content-type", b"application/json")],
        }
        asyncio.run(self.app(scope, receive, send))
        response = next(item for item in sent if item["type"] == "http.response.start")
        chunks = [item.get("body", b"") for item in sent if item["type"] == "http.response.body"]
        payload = b"".join(chunks)
        return response["status"], json.loads(payload) if payload else None

    def test_health_and_layers_endpoints(self):
        status, health = self.request("GET", "/health")
        self.assertEqual(status, 200)
        self.assertTrue(health["terrain_available"])
        status, layers = self.request("GET", "/navigation/layers")
        self.assertEqual(status, 200)
        self.assertTrue(layers["available"])

    def test_route_compare_and_feasibility_endpoints(self):
        body = {"start": list(cell_xy(self.aff, 0, 0)), "destination": list(cell_xy(self.aff, 4, 4)), "mode": "safest"}
        status, result = self.request("POST", "/navigation/route", body)
        self.assertEqual(status, 200)
        self.assertTrue(result["feasible"])
        self.assertEqual(result["mode"], "safest")
        status, comparison = self.request("POST", "/navigation/compare", body)
        self.assertEqual(status, 200)
        self.assertEqual(set(comparison["routes"]), {"shortest", "safest", "science-aware"})
        status, feasible = self.request("POST", "/navigation/feasibility", body)
        self.assertEqual(status, 200)
        self.assertTrue(feasible["feasible"])

    def test_validation_failure_is_structured(self):
        status, error = self.request("POST", "/navigation/route", {"start": [1], "destination": [2, 3]})
        self.assertEqual(status, 422)
        self.assertIn("detail", error)


if __name__ == "__main__":
    unittest.main()
