import datetime
import hashlib
import os
import pytest
from fastapi.testclient import TestClient
from app.main import create_app
from app.service import ReviewService
from app.store import SqliteStore

EVIDENCE = "In a 30-day test of 120 small-business customers using Pro, median setup time fell by 30%."
DRAFT_1 = "Our setup time fell by 30% for small-business customers using Pro."
DRAFT_2 = "We reduce setup time by 30% for small-business users."


@pytest.fixture
def test_store():
    return SqliteStore(":memory:")


@pytest.fixture
def auth_client(test_store, monkeypatch):
    monkeypatch.setenv("CUSTODIA_FREE_CHECKS", "1")
    monkeypatch.setenv("CUSTODIA_ENV", "dev")
    monkeypatch.setenv("CUSTODIA_SECRET", "auth-gate-test-secret-key-32-chars-long!")
    svc = ReviewService(test_store)
    app = create_app(svc, rate_limit=0)
    return TestClient(app, base_url="https://testserver")


def test_signup_login_logout_me(auth_client):
    # GET /api/auth/me when unauthenticated
    res = auth_client.get("/api/auth/me")
    assert res.status_code == 200
    assert res.json() == {"user": None}

    # Signup
    signup_res = auth_client.post(
        "/api/auth/signup",
        json={"email": "Tester@Example.com", "password": "supersecurepassword123"},
    )
    assert signup_res.status_code == 201
    user_data = signup_res.json()["user"]
    assert user_data["email"] == "tester@example.com"
    assert "id" in user_data
    assert "custodia_session" in auth_client.cookies

    # GET /api/auth/me when authenticated
    me_res = auth_client.get("/api/auth/me")
    assert me_res.status_code == 200
    assert me_res.json()["user"]["email"] == "tester@example.com"

    # Logout
    logout_res = auth_client.post("/api/auth/logout")
    assert logout_res.status_code == 200
    assert logout_res.json() == {"ok": True}

    # GET /api/auth/me after logout
    assert auth_client.get("/api/auth/me").json() == {"user": None}

    # Login
    login_res = auth_client.post(
        "/api/auth/login",
        json={"email": "tester@example.com", "password": "supersecurepassword123"},
    )
    assert login_res.status_code == 200
    assert login_res.json()["user"]["email"] == "tester@example.com"
    assert auth_client.get("/api/auth/me").json()["user"] is not None


def test_duplicate_email(auth_client):
    auth_client.post(
        "/api/auth/signup",
        json={"email": "dupe@example.com", "password": "password12345"},
    )
    res = auth_client.post(
        "/api/auth/signup",
        json={"email": "DUPE@example.com", "password": "password12345"},
    )
    assert res.status_code == 409
    assert res.json()["error"]["code"] == "EMAIL_EXISTS"


def test_weak_and_invalid_passwords(auth_client):
    # Short password (< 10 chars)
    res = auth_client.post(
        "/api/auth/signup",
        json={"email": "user@example.com", "password": "short"},
    )
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "WEAK_PASSWORD"

    # Too long password (> 128 chars)
    res2 = auth_client.post(
        "/api/auth/signup",
        json={"email": "user@example.com", "password": "x" * 129},
    )
    assert res2.status_code == 400
    assert res2.json()["error"]["code"] == "PASSWORD_TOO_LONG"


def test_identical_errors_unknown_email_vs_wrong_password(auth_client):
    # Register a user
    auth_client.post(
        "/api/auth/signup",
        json={"email": "existing@example.com", "password": "correctpassword10"},
    )
    auth_client.post("/api/auth/logout")

    # Unknown email
    res_unknown = auth_client.post(
        "/api/auth/login",
        json={"email": "nonexistent@example.com", "password": "somepassword10"},
    )
    # Wrong password for existing email
    res_wrong_pw = auth_client.post(
        "/api/auth/login",
        json={"email": "existing@example.com", "password": "wrongpassword10"},
    )

    assert res_unknown.status_code == 401
    assert res_wrong_pw.status_code == 401
    assert res_unknown.json() == res_wrong_pw.json()
    assert res_unknown.json()["error"]["code"] == "INVALID_CREDENTIALS"


def test_session_expiry_and_revocation(test_store, monkeypatch):
    monkeypatch.setenv("CUSTODIA_FREE_CHECKS", "1")
    monkeypatch.setenv("CUSTODIA_ENV", "dev")
    monkeypatch.setenv("CUSTODIA_SECRET", "session-test-secret")
    svc = ReviewService(test_store)
    client = TestClient(create_app(svc, rate_limit=0), base_url="https://testserver")

    # Signup
    client.post("/api/auth/signup", json={"email": "sess@example.com", "password": "password10chars"})
    assert client.get("/api/auth/me").json()["user"] is not None

    token = client.cookies.get("custodia_session")
    assert token is not None
    tok_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()

    # Manually expire the session in store
    expired_time = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=1)
    test_store._db.execute("UPDATE sessions SET expires_at = ? WHERE id_hash = ?", (expired_time.isoformat(), tok_hash))
    test_store._db.commit()

    # After expiry, /me should return None
    assert client.get("/api/auth/me").json() == {"user": None}


def test_free_check_gate_and_readable_after(test_store, monkeypatch):
    monkeypatch.setenv("CUSTODIA_FREE_CHECKS", "1")
    monkeypatch.setenv("CUSTODIA_ENV", "dev")
    monkeypatch.setenv("CUSTODIA_SECRET", "gate-test-secret")
    svc = ReviewService(test_store)
    client = TestClient(create_app(svc, rate_limit=0), base_url="https://testserver")

    # Check /api/usage before checks
    usage1 = client.get("/api/usage").json()
    assert usage1["signed_in"] is False
    assert usage1["free_checks_remaining"] == 1

    # First check succeeds
    res1 = client.post("/api/reviews", json={"claim_text": DRAFT_1, "evidence_text": EVIDENCE})
    assert res1.status_code == 201
    review1_id = res1.json()["id"]

    # Check /api/usage after 1 check
    usage2 = client.get("/api/usage").json()
    assert usage2["signed_in"] is False
    assert usage2["free_checks_remaining"] == 0

    # Second check is blocked with SIGNUP_REQUIRED
    res2 = client.post("/api/reviews", json={"claim_text": DRAFT_2, "evidence_text": EVIDENCE})
    assert res2.status_code == 401
    assert res2.json()["error"]["code"] == "SIGNUP_REQUIRED"

    # Product rule 3: The free check's result stays viewable after gate appears
    res_get = client.get(f"/api/reviews/{review1_id}")
    assert res_get.status_code == 200
    assert res_get.json()["id"] == review1_id


def test_static_examples_do_not_count_towards_gate(test_store, monkeypatch):
    monkeypatch.setenv("CUSTODIA_FREE_CHECKS", "1")
    monkeypatch.setenv("CUSTODIA_ENV", "dev")
    monkeypatch.setenv("CUSTODIA_SECRET", "gate-test-secret")
    svc = ReviewService(test_store)
    client = TestClient(create_app(svc, rate_limit=0), base_url="https://testserver")

    # Static example from EXAMPLES:
    ex_claim = "Our platform cuts setup time by 40% for every business."
    ex_ev = "In a 30-day test of 120 small-business customers using Pro, median setup time fell by 30%."

    # Running static example
    res1 = client.post("/api/reviews", json={"claim_text": ex_claim, "evidence_text": ex_ev})
    assert res1.status_code == 201

    # Remaining checks should STILL be 1!
    usage = client.get("/api/usage").json()
    assert usage["free_checks_remaining"] == 1

    # Custom check still works as the 1 free check
    res2 = client.post("/api/reviews", json={"claim_text": DRAFT_1, "evidence_text": EVIDENCE})
    assert res2.status_code == 201

    # Third check (second custom) is now gated
    res3 = client.post("/api/reviews", json={"claim_text": DRAFT_2, "evidence_text": EVIDENCE})
    assert res3.status_code == 401
    assert res3.json()["error"]["code"] == "SIGNUP_REQUIRED"


def test_anonymous_review_attaches_on_signup_and_login(test_store, monkeypatch):
    monkeypatch.setenv("CUSTODIA_FREE_CHECKS", "1")
    monkeypatch.setenv("CUSTODIA_ENV", "dev")
    monkeypatch.setenv("CUSTODIA_SECRET", "gate-test-secret")
    svc = ReviewService(test_store)
    client = TestClient(create_app(svc, rate_limit=0), base_url="https://testserver")

    # Anonymous check
    r1 = client.post("/api/reviews", json={"claim_text": DRAFT_1, "evidence_text": EVIDENCE})
    assert r1.status_code == 201
    review_id = r1.json()["id"]

    # Before signup, review has no user_id
    stored_before = test_store.get(review_id)
    assert stored_before.user_id is None

    # Signup and attach review_ids
    signup_res = client.post(
        "/api/auth/signup",
        json={"email": "attached@example.com", "password": "password12345", "review_ids": [review_id]},
    )
    assert signup_res.status_code == 201
    user_id = signup_res.json()["user"]["id"]

    # After signup, review is attached to user
    stored_after = test_store.get(review_id)
    assert stored_after.user_id == user_id

    # And /api/reviews/mine lists this review
    my_reviews = client.get("/api/reviews/mine").json()["reviews"]
    assert len(my_reviews) == 1
    assert my_reviews[0]["id"] == review_id


def test_origin_mismatch_rejected(auth_client):
    # Valid origin or omitted origin is allowed
    res_valid = auth_client.post(
        "/api/reviews",
        json={"claim_text": DRAFT_1, "evidence_text": EVIDENCE},
        headers={"origin": "http://testserver"},
    )
    assert res_valid.status_code == 201

    # Mismatched origin rejected with 403 CSRF_ORIGIN_MISMATCH
    res_mismatch = auth_client.post(
        "/api/reviews",
        json={"claim_text": DRAFT_2, "evidence_text": EVIDENCE},
        headers={"origin": "http://malicious-site.com"},
    )
    assert res_mismatch.status_code == 403
    assert res_mismatch.json()["error"]["code"] == "CSRF_ORIGIN_MISMATCH"


def test_auth_rate_limiting(auth_client):
    # 10 attempts allowed in window
    for i in range(10):
        auth_client.post(
            "/api/auth/login",
            json={"email": f"fail{i}@example.com", "password": "wrongpassword123"},
        )

    # 11th attempt is rate-limited
    res_blocked = auth_client.post(
        "/api/auth/login",
        json={"email": "fail_again@example.com", "password": "wrongpassword123"},
    )
    assert res_blocked.status_code == 429
    assert res_blocked.json()["error"]["code"] == "RATE_LIMITED"


def test_demo_username_bypass(auth_client):
    # Login directly with demo username without prior signup
    res_demo = auth_client.post(
        "/api/auth/login",
        json={"email": "demo", "password": ""},
    )
    assert res_demo.status_code == 200
    assert res_demo.json()["user"]["email"] == "demo@custodia.dev"
    assert auth_client.get("/api/auth/me").json()["user"]["email"] == "demo@custodia.dev"

    # Demo user has unlimited checks
    r1 = auth_client.post("/api/reviews", json={"claim_text": DRAFT_1, "evidence_text": EVIDENCE})
    assert r1.status_code == 201
    r2 = auth_client.post("/api/reviews", json={"claim_text": DRAFT_2, "evidence_text": EVIDENCE})
    assert r2.status_code == 201
