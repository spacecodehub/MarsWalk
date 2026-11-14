from fastapi.testclient import TestClient
from main import app


def test_mission_has_agreed_fields():
    with TestClient(app) as client:
        response = client.get("/api/mission")
    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"mission", "location", "objective", "status"}
    assert body["status"] == "SIMULATION"


def test_cors_allows_frontend_origin():
    with TestClient(app) as client:
        response = client.get(
            "/api/mission", headers={"Origin": "http://localhost:5173"}
        )
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
