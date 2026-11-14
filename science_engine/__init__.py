"""Backend-neutral science and environmental intelligence utilities.

The service facade imports optional MEDA processing libraries. Keep its
public import lazy so catalogue-only API consumers need only the base runtime.
"""

__all__ = ["ScienceService"]


def __getattr__(name: str):
    if name == "ScienceService":
        from .science_service import ScienceService

        return ScienceService
    raise AttributeError(name)
