import pytest
from fastapi.testclient import TestClient
from app.main import RateLimiter, create_app, get_env
from app.service import ReviewService
from app.store import Store


def test_security_headers_present():
    app = create_app(ReviewService(Store(":memory:")), rate_limit=0)
    client = TestClient(app)

    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.headers["x-content-type-options"] == "nosniff"
    assert res.headers["referrer-policy"] == "no-referrer"
    assert res.headers["x-frame-options"] == "DENY"
    csp = res.headers["content-security-policy"]
    assert "default-src 'self'" in csp
    assert "img-src 'self' data:" in csp
    assert "style-src 'self' 'unsafe-inline'" in csp
    assert "frame-ancestors 'none'" in csp


def test_rate_limiter_x_forwarded_for_separate_buckets():
    # Rate limit = 2 requests per minute
    app = create_app(ReviewService(Store(":memory:")), rate_limit=2)
    client = TestClient(app)

    # Client A: 2 requests succeed, 3rd fails
    res_a1 = client.post("/api/reviews", json={"claim_text": "C1", "evidence_text": "E1"}, headers={"X-Forwarded-For": "203.0.113.1, 10.0.0.1"})
    assert res_a1.status_code == 201

    res_a2 = client.post("/api/reviews", json={"claim_text": "C2", "evidence_text": "E2"}, headers={"X-Forwarded-For": "203.0.113.1, 10.0.0.1"})
    assert res_a2.status_code == 201

    res_a3 = client.post("/api/reviews", json={"claim_text": "C3", "evidence_text": "E3"}, headers={"X-Forwarded-For": "203.0.113.1, 10.0.0.1"})
    assert res_a3.status_code == 429
    assert res_a3.json()["error"]["code"] == "RATE_LIMITED"

    # Client B: with different X-Forwarded-For first hop, still has budget!
    res_b1 = client.post("/api/reviews", json={"claim_text": "CB1", "evidence_text": "EB1"}, headers={"X-Forwarded-For": "198.51.100.5, 10.0.0.1"})
    assert res_b1.status_code == 201


def test_rate_limiter_prunes_empty_deques():
    limiter = RateLimiter(per_minute=10)
    # Add dummy entries
    limiter.hits["old_client"].append(0.0)  # Very old timestamp
    limiter.hits["active_client"].append(1e12)  # Future timestamp

    limiter.prune()
    assert "old_client" not in limiter.hits
    assert "active_client" in limiter.hits


def test_env_var_aliasing(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("SCOPELOCK_MODEL", "fallback-model")
    assert get_env("MODEL") == "fallback-model"

    monkeypatch.setenv("CUSTODIA_MODEL", "custodia-preferred")
    assert get_env("MODEL") == "custodia-preferred"
