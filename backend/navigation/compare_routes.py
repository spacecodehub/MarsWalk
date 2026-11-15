"""Compare all supported route objectives under identical hard constraints."""

from __future__ import annotations

from typing import Any

from .a_star import MarsRoutePlanner, RouteError


def compare_routes(
    planner: MarsRoutePlanner, start, end, *, input_crs: str | None = None,
) -> dict[str, Any]:
    results: dict[str, Any] = {}
    for mode in planner.MODES:
        try:
            results[mode] = planner.plan(start, end, mode, input_crs=input_crs)
        except RouteError as exc:
            results[mode] = {"feasible": False, "mode": mode, "error": str(exc)}
    return {"feasible": any(r.get("feasible", False) for r in results.values()), "routes": results}
