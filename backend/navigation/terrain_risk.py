"""Experimental relative risk preprocessing; never a NASA safety model."""

from __future__ import annotations

import numpy as np


def calculate_terrain_risk(
    slope_deg: np.ndarray,
    roughness_m: np.ndarray,
    valid: np.ndarray,
    *,
    slope_reference_deg: float = 34.723,
    roughness_reference_m: float = 13.039,
    slope_weight: float = 0.4,
    roughness_weight: float = 0.35,
) -> np.ndarray:
    """Return a 0–100 relative penalty using the legacy P4 references.

    References and weights are demonstration settings. Hard safety checks are
    separate and must be applied by ``MarsRoutePlanner`` before traversal.
    """
    if slope_deg.shape != roughness_m.shape or slope_deg.shape != valid.shape:
        raise ValueError("slope, roughness, and validity arrays must have the same shape")
    if slope_reference_deg <= 0 or roughness_reference_m <= 0:
        raise ValueError("risk normalization references must be positive")
    if slope_weight < 0 or roughness_weight < 0 or slope_weight + roughness_weight <= 0:
        raise ValueError("risk weights must be non-negative with a positive sum")
    slope_risk = np.clip(np.asarray(slope_deg, dtype=float) / slope_reference_deg * 100, 0, 100)
    roughness_risk = np.clip(np.asarray(roughness_m, dtype=float) / roughness_reference_m * 100, 0, 100)
    total = slope_weight + roughness_weight
    result = (slope_weight * slope_risk + roughness_weight * roughness_risk) / total
    result[~np.asarray(valid, dtype=bool)] = np.nan
    return result.astype(np.float32)
