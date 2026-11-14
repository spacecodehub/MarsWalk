import unittest

from gis_common import raster_corners


class RasterCornersTests(unittest.TestCase):
    def test_north_up_grid(self):
        self.assertEqual(
            raster_corners((100, 2, 0, 200, 0, -3), 4, 5),
            [(100, 200), (108, 200), (108, 185), (100, 185)],
        )

    def test_rotated_grid(self):
        self.assertEqual(
            raster_corners((1, 2, 4, 10, 3, -5), 3, 2),
            [(1, 10), (7, 19), (15, 9), (9, 0)],
        )


if __name__ == "__main__":
    unittest.main()
