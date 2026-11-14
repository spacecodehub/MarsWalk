import json
from pathlib import Path

from fastapi.testclient import TestClient

from main import app

SNAPSHOT = Path(__file__).parent / "openapi_snapshot.json"


def _operations(spec):
    return {
        (path, method)
        for path, methods in spec["paths"].items()
        for method in methods
    }


def test_no_endpoint_removed_or_renamed():
    saved = json.loads(SNAPSHOT.read_text())
    live = TestClient(app).get("/openapi.json").json()
    missing = _operations(saved) - _operations(live)
    assert not missing, f"Agreed endpoints missing or renamed: {sorted(missing)}"


def test_no_schema_field_removed_or_renamed():
    saved = json.loads(SNAPSHOT.read_text())
    live = TestClient(app).get("/openapi.json").json()
    saved_schemas = saved.get("components", {}).get("schemas", {})
    live_schemas = live.get("components", {}).get("schemas", {})
    for name, schema in saved_schemas.items():
        assert name in live_schemas, f"Schema {name} was removed"
        old = set(schema.get("properties", {}))
        new = set(live_schemas[name].get("properties", {}))
        assert old <= new, f"{name} lost fields: {sorted(old - new)}"


def test_health_reports_missing_data_honestly():
    body = TestClient(app).get("/api/health").json()
    assert body["status"] == "ok"
    # With no data files present, the API must say so, never pretend.
    assert body["terrain_available"] is False
    assert body["science_catalogue_available"] is False
