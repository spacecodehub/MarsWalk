import json
import re
import unittest

from osgeo import gdal, ogr, osr
from qgis.core import QgsApplication, QgsProject

from build_terrain_products import (
    ANALYSIS_DEM_PATH,
    OUTPUTS,
    OUTPUT_DIRECTORY,
    PROJECT_PATH,
    REPORT_PATH,
    SOURCE_DTM,
)
from gis_common import PRODUCTS, REPOSITORY_ROOT, SIM_ROOT


gdal.DontUseExceptions()
ogr.DontUseExceptions()


class TerrainProductTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = QgsApplication.instance() or QgsApplication([], False)
        cls.app.initQgis()
        json.loads(REPORT_PATH.read_text(encoding="utf-8"))

    def test_source_pds_metadata_confirms_vertical_reference(self):
        source = gdal.Open(str(SOURCE_DTM), gdal.GA_ReadOnly)
        self.assertIsNotNone(source)
        pds = json.loads(source.GetMetadata("json:PDS")[0])
        self.assertEqual(
            pds["PRODUCT_ID"], "DTEEC_022680_1985_022746_1985_A01"
        )
        note = re.sub(r"\\+[RN]", " ", pds["IMAGE"]["NOTE"].upper())
        note = re.sub(r"\s+", " ", note)
        self.assertIn("METERS ABOVE THE MARTIAN EQUIPOTENTIAL SURFACE", note)
        self.assertIn("MARS 2000 DATUM", note)
        self.assertAlmostEqual(abs(source.GetGeoTransform()[1]), 1.0097038, places=5)

    def test_dtm_label_provenance_points_to_embedded_label_product(self):
        dtm = next(product for product in PRODUCTS if product["key"] == "hirise_dtm")
        self.assertTrue(dtm["label_embedded"])
        self.assertEqual(dtm["label_url"], dtm["url"])
        self.assertTrue(dtm["url"].endswith(".IMG"))

    def test_terrain_outputs_exist_have_units_and_match_analysis_grid(self):
        analysis = gdal.Open(str(ANALYSIS_DEM_PATH), gdal.GA_ReadOnly)
        self.assertIsNotNone(analysis)
        self.assertAlmostEqual(abs(analysis.GetGeoTransform()[1]), 5.0, places=6)
        self.assertAlmostEqual(abs(analysis.GetGeoTransform()[5]), 5.0, places=6)
        analysis_band = analysis.GetRasterBand(1)
        self.assertEqual(analysis_band.DataType, gdal.GDT_Float32)
        self.assertEqual(analysis_band.GetUnitType(), "m")
        self.assertIn("Mars 2000", analysis.GetMetadataItem("VERTICAL_REFERENCE"))
        crs = osr.SpatialReference(wkt=analysis.GetProjectionRef())
        self.assertEqual(crs.GetAttrValue("PROJECTION"), "Equirectangular")
        self.assertAlmostEqual(crs.GetProjParm("central_meridian"), 77.44, places=6)
        self.assertAlmostEqual(crs.GetProjParm("standard_parallel_1"), 15.0, places=6)
        for key, (filename, _algorithm) in OUTPUTS.items():
            path = OUTPUT_DIRECTORY / filename
            with self.subTest(product=key):
                self.assertTrue(path.is_file())
                output = gdal.Open(str(path), gdal.GA_ReadOnly)
                self.assertIsNotNone(output)
                self.assertEqual(
                    (output.RasterXSize, output.RasterYSize),
                    (analysis.RasterXSize, analysis.RasterYSize),
                )
                self.assertEqual(
                    output.GetGeoTransform(), analysis.GetGeoTransform()
                )
                self.assertTrue(
                    osr.SpatialReference(wkt=output.GetProjectionRef()).IsSame(
                        osr.SpatialReference(wkt=analysis.GetProjectionRef())
                    )
                )
                band = output.GetRasterBand(1)
                self.assertEqual(band.DataType, gdal.GDT_Float32)
                self.assertIsNotNone(band.GetNoDataValue())
                self.assertEqual(band.GetNoDataValue(), -9999.0)
                self.assertEqual(
                    band.GetUnitType(),
                    "degree" if key in ("slope", "aspect") else "m",
                )
                self.assertIn(
                    "SOURCE_PRODUCT_ID",
                    output.GetMetadata(),
                )
                self.assertEqual(
                    output.GetMetadataItem("SOURCE_PRODUCT_ID"),
                    "DTEEC_022680_1985_022746_1985_A01",
                )
                values = band.ReadAsArray(0, 0, 1, 1)
                self.assertEqual(float(values[0, 0]), band.GetNoDataValue())

    def test_sim_spatial_geometries_are_valid(self):
        geodatabase = SIM_ROOT / "Geodatabase" / "Nili.gdb"
        dataset = ogr.Open(str(geodatabase), 0)
        self.assertIsNotNone(dataset)
        spatial_layers = 0
        for index in range(dataset.GetLayerCount()):
            layer = dataset.GetLayerByIndex(index)
            if layer.GetGeomType() == ogr.wkbNone:
                continue
            spatial_layers += 1
            layer.ResetReading()
            for feature in layer:
                geometry = feature.GetGeometryRef()
                if geometry is not None:
                    self.assertTrue(
                        geometry.IsValid(),
                        f"Invalid geometry in {layer.GetName()} feature {feature.GetFID()}",
                    )
        self.assertEqual(spatial_layers, 13)

    def test_qgis_project_reopens_with_all_layers_valid(self):
        self.assertTrue(PROJECT_PATH.is_file())
        project = QgsProject.instance()
        self.assertTrue(project.read(str(PROJECT_PATH)))
        self.assertEqual(len(project.mapLayers()), 24)
        invalid = [
            layer.name()
            for layer in project.mapLayers().values()
            if not layer.isValid()
        ]
        self.assertEqual(invalid, [])

    def test_relative_registration_is_reported_as_unverified_control(self):
        alignment = json.loads(
            (REPOSITORY_ROOT / "GIS" / "documentation" / "alignment_assessment.json")
            .read_text(encoding="utf-8")
        )
        result = alignment["result"]
        self.assertEqual(result["tie_count"], 12)
        self.assertEqual(result["median_ctx_relative_shift_m"], [-10.0, -55.0])
        self.assertEqual(result["median_absolute_deviation_m"], [5.0, 5.0])
        self.assertIn(
            "not an absolute control-point survey",
            " ".join(alignment["limitations"]),
        )
        self.assertIn("Mars 2020", " ".join(alignment["limitations"]))

    @classmethod
    def tearDownClass(cls):
        cls.app.exitQgis()


if __name__ == "__main__":
    unittest.main()
