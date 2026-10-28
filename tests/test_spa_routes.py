import os
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from app.main import create_app
from app.service import ReviewService
from app.store import Store


def test_spa_routes_serve_index_html(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    index_file = tmp_path / "index.html"
    index_file.write_text("<!doctype html><html><body>Custodia Stub</body></html>", encoding="utf-8")
    monkeypatch.setenv("SCOPELOCK_WEB_DIR", str(tmp_path))

    svc = ReviewService(Store(":memory:"))
    app = create_app(svc, rate_limit=0)
    client = TestClient(app)

    # Check /, /check, /r/abc return stub index.html
    r_root = client.get("/")
    assert r_root.status_code == 200
    assert "Custodia Stub" in r_root.text

    r_check = client.get("/check")
    assert r_check.status_code == 200
    assert "Custodia Stub" in r_check.text

    r_examples = client.get("/examples")
    assert r_examples.status_code == 200
    assert "Custodia Stub" in r_examples.text

    r_check_param = client.get("/check?example=critical")
    assert r_check_param.status_code == 200
    assert "Custodia Stub" in r_check_param.text

    r_review = client.get("/r/abc")
    assert r_review.status_code == 200
    assert "Custodia Stub" in r_review.text

    # Real review via API
    create_res = client.post("/api/reviews", json={
        "claim_text": "Our platform cuts setup time by 40% for every business.",
        "evidence_text": "In a 30-day test of 120 small-business customers using Pro, median setup time fell by 30%."
    })
    assert create_res.status_code == 201
    real_id = create_res.json()["id"]

    r_real_review = client.get(f"/r/{real_id}")
    assert r_real_review.status_code == 200
    assert "Custodia Stub" in r_real_review.text

    r_api_real = client.get(f"/api/reviews/{real_id}")
    assert r_api_real.status_code == 200
    assert r_api_real.json()["id"] == real_id

    # Unknown /api route returns JSON 404
    r_api_nope = client.get("/api/nope")
    assert r_api_nope.status_code == 404
    assert r_api_nope.headers.get("content-type", "").startswith("application/json")


def test_spa_routes_frontend_not_built_503(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    empty_dir = tmp_path / "nonexistent_web"
    empty_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setenv("SCOPELOCK_WEB_DIR", str(empty_dir))

    svc = ReviewService(Store(":memory:"))
    app = create_app(svc, rate_limit=0)
    client = TestClient(app)

    r_root = client.get("/")
    assert r_root.status_code == 503
    assert "Custodia API is running" in r_root.text

    r_check = client.get("/check")
    assert r_check.status_code == 503

    r_ex = client.get("/examples")
    assert r_ex.status_code == 503

    r_rev = client.get("/r/abc")
    assert r_rev.status_code == 503
