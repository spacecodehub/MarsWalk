"""Retrieve only evidence-linked investigation recommendations."""

from __future__ import annotations

from typing import Any


def recommendations_for_target(target: dict[str, Any]) -> list[dict[str, str]]:
    """Return proposed investigations without recasting them as findings."""
    return [dict(item) for item in target.get("recommended_investigations", [])]
