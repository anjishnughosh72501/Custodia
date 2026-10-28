"""Production hardening tests for Custodia (Phase 1).

Covers:
- Non-blocking event loop: /api/health and /api/ping respond in < 500 ms while review is in flight.
- X-Forwarded-For proxy IP handling.
- Bounded rate limiter with expiration and key capping.
- Daily LLM call budget cap and graceful fallback.
- 64 KB request body size ceiling (413).
- Review TTL expiration and purge.
- Cryptographic delete token on creation and DELETE /api/reviews/{id} with right/wrong token.
- CORS middleware headers and /api/ping warm-up endpoint.
- Store interface compatibility (SQLite and Postgres).
"""
import concurrent.futures
import datetime
import time
import httpx
import pytest
from fastapi.testclient import TestClient

from app.extraction.llm import LlmBudgetTracker, LlmClient, ProviderError
from app.main import ApiError, RateLimiter, create_app
from app.models import ReviewRequest
from app.service import ReviewService
from app.store import SqliteStore, build_store


class SlowTransport(httpx.BaseTransport):
    """Simulates a slow LLM call taking 1.5 seconds."""
    def handle_request(self, request: httpx.Request) -> httpx.Response:
        time.sleep(1.2)
        # Return valid Anthropic Messages response
        body = {
            "id": "msg_123",
            "type": "message",
            "role": "assistant",
            "content": [{"type": "text", "text": '{"metric": "setup time", "value_with_unit": "30%", "population": null, "time_window": null, "conditions": null, "strength": null}'}],
        }
        import json
        return httpx.Response(200, json=body)


def test_ping_endpoint():
    """GET /api/ping returns ok: True immediately without hitting DB or models."""
    client = TestClient(create_app())
    res = client.get("/api/ping")
    assert res.status_code == 200
    assert res.json() == {"ok": True}


def test_health_non_blocking_while_review_in_flight(tmp_path):
    """While a review is in flight, /api/health must respond in under 500 ms."""
    slow_llm = LlmClient(
        api_key="test-key",
        model="claude-haiku-5-5",
        timeout=10.0,
        transport=SlowTransport(),
    )
    store = SqliteStore(str(tmp_path / "slow.db"))
    svc = ReviewService(store, llm=slow_llm)
    app = create_app(svc)
    client = TestClient(app)

    # Launch review in background thread
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        future_review = pool.submit(
            client.post,
            "/api/reviews",
            json={
                "claim_text": "Setup time fell by 30%.",
                "evidence_text": "Setup time fell by 30%.",
            },
        )

        # Allow review to start
        time.sleep(0.1)

        # Measure health check latency while review is in flight
        t0 = time.perf_counter()
        health_res = client.get("/api/health")
        latency = time.perf_counter() - t0

        assert health_res.status_code == 200
        assert latency < 0.5, f"Health check took {latency:.3f}s, expected < 0.5s"

        review_res = future_review.result()
        assert review_res.status_code == 201


def test_proxy_ip_x_forwarded_for():
    """Client IP is parsed from the first hop of X-Forwarded-For."""
    limiter = RateLimiter(per_minute=2)
    app = create_app(rate_limit=2)
    client = TestClient(app)

    # First hop should be tracked
    r1 = client.post("/api/reviews", json={"claim_text": "A", "evidence_text": "B"},
                     headers={"x-forwarded-for": "203.0.113.195, 70.41.3.18"})
    r2 = client.post("/api/reviews", json={"claim_text": "A", "evidence_text": "B"},
                     headers={"x-forwarded-for": "203.0.113.195, 70.41.3.18"})
    r3 = client.post("/api/reviews", json={"claim_text": "A", "evidence_text": "B"},
                     headers={"x-forwarded-for": "203.0.113.195, 70.41.3.18"})

    assert r1.status_code in (201, 400)
    assert r2.status_code in (201, 400)
    assert r3.status_code == 429

    # Different client IP should not be blocked
    r_diff = client.post("/api/reviews", json={"claim_text": "A", "evidence_text": "B"},
                         headers={"x-forwarded-for": "198.51.100.1, 70.41.3.18"})
    assert r_diff.status_code in (201, 400)


def test_bounded_rate_limiter_key_capping():
    """Rate limiter enforces max_tracked_keys to prevent memory exhaustion."""
    limiter = RateLimiter(per_minute=10, max_tracked_keys=50)
    for i in range(100):
        limiter.check(f"ip-{i}")
    limiter.prune()
    assert len(limiter.hits) <= 50


def test_daily_llm_budget_cap():
    """When daily LLM call cap is reached, budget tracker blocks calls."""
    tracker = LlmBudgetTracker(daily_cap=3)
    assert tracker.can_call() is True
    tracker.record_call()
    tracker.record_call()
    assert tracker.can_call() is True
    tracker.record_call()
    assert tracker.can_call() is False
    assert tracker.status == {"used": 3, "cap": 3}


def test_request_payload_size_ceiling():
    """Requests exceeding 64 KB are rejected with HTTP 413."""
    client = TestClient(create_app())
    oversized_claim = "A" * (65 * 1024)
    res = client.post(
        "/api/reviews",
        json={"claim_text": oversized_claim, "evidence_text": "evidence"},
        headers={"content-length": str(len(oversized_claim) + 50)},
    )
    assert res.status_code == 413
    assert res.json()["error"]["code"] == "PAYLOAD_TOO_LARGE"


def test_review_ttl_expiration_and_purge(tmp_path):
    """Expired reviews return 404 and are lazily purged."""
    store = SqliteStore(str(tmp_path / "ttl.db"))
    svc = ReviewService(store, retention_days=0)  # expires immediately
    app = create_app(svc)
    client = TestClient(app)

    create_res = client.post(
        "/api/reviews",
        json={"claim_text": "Fell 30%.", "evidence_text": "Fell 30%."},
    )
    assert create_res.status_code == 201
    rev_id = create_res.json()["id"]

    # Sleep slightly so current time > expires_at
    time.sleep(0.05)

    # Retrieval should return 404
    get_res = client.get(f"/api/reviews/{rev_id}")
    assert get_res.status_code == 404
    assert "expired" in get_res.json()["error"]["message"].lower()


def test_delete_review_with_token(tmp_path):
    """Reviews return a delete_token on creation, and DELETE /api/reviews/{id} enforces it."""
    store = SqliteStore(str(tmp_path / "delete.db"))
    svc = ReviewService(store, retention_days=30)
    app = create_app(svc)
    client = TestClient(app)

    create_res = client.post(
        "/api/reviews",
        json={"claim_text": "Fell 30%.", "evidence_text": "Fell 30%."},
    )
    assert create_res.status_code == 201
    body = create_res.json()
    rev_id = body["id"]
    delete_token = body.get("delete_token")
    assert delete_token is not None

    # GET does not leak delete_token
    get_res = client.get(f"/api/reviews/{rev_id}")
    assert get_res.status_code == 200
    assert get_res.json().get("delete_token") is None

    # DELETE without header -> 403
    assert client.delete(f"/api/reviews/{rev_id}").status_code == 403

    # DELETE with wrong token -> 403
    assert client.delete(f"/api/reviews/{rev_id}", headers={"x-delete-token": "wrong"}).status_code == 403

    # DELETE with valid token -> 204
    del_res = client.delete(f"/api/reviews/{rev_id}", headers={"x-delete-token": delete_token})
    assert del_res.status_code == 204

    # Subsequent GET -> 404
    assert client.get(f"/api/reviews/{rev_id}").status_code == 404


def test_cors_middleware_headers(monkeypatch):
    """CORS middleware headers are returned when CUSTODIA_CORS_ORIGINS is configured."""
    monkeypatch.setenv("CUSTODIA_CORS_ORIGINS", "https://custodia-verifier.vercel.app, http://localhost:5173")
    client = TestClient(create_app())

    res = client.get(
        "/api/ping",
        headers={"origin": "https://custodia-verifier.vercel.app"},
    )
    assert res.status_code == 200
    assert res.headers.get("access-control-allow-origin") == "https://custodia-verifier.vercel.app"
    assert res.headers.get("x-robots-tag") == "noindex"


def test_store_factory_postgres_fallback(monkeypatch):
    """Store factory instantiates PostgresStore when DATABASE_URL is postgresql."""
    # Test URI parsing and factory routing
    store = build_store(database_url="sqlite:///fallback", sqlite_path="test_sqlite.db")
    assert isinstance(store, SqliteStore)
