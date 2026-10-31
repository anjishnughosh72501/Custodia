from __future__ import annotations
import datetime
import hashlib
import json
import logging
import os
import re
import secrets
import time
from collections import defaultdict, deque
from pathlib import Path
from typing import Optional
from argon2 import PasswordHasher
from itsdangerous import URLSafeTimedSerializer
from fastapi import Depends, FastAPI, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import ValidationError
from .examples import EXAMPLES
from .extraction.llm import LlmBudgetTracker, LlmClient
from .extraction.nli import NliClassifier, NliConfig
from .models import ReviewRequest, RewriteRequest
from .rules.engine import ENGINE_VERSION
from .service import ReviewService
from .store import BaseStore, build_store

def get_env(key: str, default: Optional[str] = None) -> Optional[str]:
    """Accept CUSTODIA_* first, falling back to legacy SCOPELOCK_*."""
    return os.getenv(f"CUSTODIA_{key}", os.getenv(f"SCOPELOCK_{key}", default))


MAX_CLAIM, MAX_EVIDENCE = 1000, 20000
MAX_REQUEST_BYTES = 64 * 1024  # 64 KB payload ceiling
WEB = Path(get_env("WEB_DIR", str(Path(__file__).parent / "web")))   # built React app (npm run build)
log = logging.getLogger("custodia")
logging.basicConfig(level=get_env("LOG_LEVEL", "INFO"), format="%(asctime)s %(levelname)s %(name)s %(message)s")

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")
SESSION_COOKIE = "custodia_session"
ANON_COOKIE = "custodia_anon"

pwd_hasher = PasswordHasher()
DUMMY_HASH = pwd_hasher.hash("custodia-timing-defense-dummy-password-hash")


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str):
        self.status, self.code, self.message = status, code, message


class RateLimiter:
    """Bounded sliding-window rate limiter with client IP tracking and periodic pruning."""

    def __init__(self, per_minute: int, max_tracked_keys: int = 5000):
        self.per_minute = per_minute
        self.max_tracked_keys = max_tracked_keys
        self.hits = defaultdict(deque)

    def prune(self):
        now = time.monotonic()
        dead = [k for k, q in self.hits.items() if not q or now - q[-1] > 60]
        for k in dead:
            del self.hits[k]
        if len(self.hits) > self.max_tracked_keys:
            sorted_keys = sorted(self.hits.keys(), key=lambda k: self.hits[k][-1] if self.hits[k] else 0)
            for k in sorted_keys[: len(self.hits) - self.max_tracked_keys]:
                del self.hits[k]

    def check(self, key: str):
        if self.per_minute <= 0:
            return
        now = time.monotonic()
        q = self.hits[key]
        while q and now - q[0] > 60:
            q.popleft()
        if len(q) >= self.per_minute:
            raise ApiError(429, "RATE_LIMITED", "Too many requests. Please wait a moment and try again.")
        q.append(now)
        if len(self.hits) > 500:
            self.prune()


class AuthRateLimiter:
    """Sliding-window rate limiter for sensitive authentication endpoints (10 attempts / 15 min)."""

    def __init__(self, max_attempts: int = 10, window_seconds: float = 900.0):
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self.hits = defaultdict(deque)

    def check(self, key: str):
        if self.max_attempts <= 0:
            return
        now = time.monotonic()
        q = self.hits[key]
        while q and now - q[0] > self.window_seconds:
            q.popleft()
        if len(q) >= self.max_attempts:
            raise ApiError(429, "RATE_LIMITED", "Too many authentication attempts. Please try again in 15 minutes.")
        q.append(now)


def build_service_from_env() -> ReviewService:
    key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    llm: Optional[LlmClient] = None
    if key and get_env("DISABLE_LLM") != "1":
        single_override = get_env("MODEL")
        model_extract = get_env("MODEL_EXTRACT", single_override or "claude-haiku-5-5")
        model_flags = get_env("MODEL_FLAGS", single_override or "claude-haiku-5-5")
        model_rewrite = get_env("MODEL_REWRITE", single_override or "claude-sonnet-5-5")
        daily_cap = int(get_env("LLM_DAILY_CALL_CAP", "500"))
        timeout = float(get_env("LLM_TIMEOUT", "8.0"))

        llm = LlmClient(
            api_key=key,
            model=model_extract,
            model_extract=model_extract,
            model_flags=model_flags,
            model_rewrite=model_rewrite,
            timeout=timeout,
            budget_tracker=LlmBudgetTracker(daily_cap=daily_cap),
        )

    nli_cfg = NliConfig.from_env()
    nli: Optional[NliClassifier] = None
    if nli_cfg.enabled:
        nli = NliClassifier(nli_cfg)
        nli.load()

    budget_sec = float(get_env("LLM_BUDGET_SECONDS", "12.0"))
    retention_days = int(get_env("RETENTION_DAYS", "30"))
    database_url = os.getenv("DATABASE_URL")
    store = build_store(database_url=database_url, sqlite_path=get_env("DB", "custodia.db"))

    return ReviewService(
        store,
        llm=llm,
        nli=nli,
        llm_budget_seconds=budget_sec,
        retention_days=retention_days,
    )


async def parse_json_body(request: Request) -> dict:
    """Async dependency enforcing 64 KB body size limit and valid JSON parsing."""
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > MAX_REQUEST_BYTES:
                raise ApiError(413, "PAYLOAD_TOO_LARGE", f"Request body exceeds {MAX_REQUEST_BYTES // 1024} KB limit.")
        except ValueError:
            pass

    ctype = request.headers.get("content-type", "")
    if not ctype.startswith("application/json"):
        raise ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Only JSON text input is supported in this version (no file uploads).")

    body_bytes = await request.body()
    if len(body_bytes) > MAX_REQUEST_BYTES:
        raise ApiError(413, "PAYLOAD_TOO_LARGE", f"Request body exceeds {MAX_REQUEST_BYTES // 1024} KB limit.")

    try:
        body = json.loads(body_bytes)
    except Exception:
        raise ApiError(422, "INVALID_JSON", "The request body is not valid JSON.")
    if not isinstance(body, dict):
        raise ApiError(422, "INVALID_INPUT", "The request body must be a JSON object.")
    return body


async def parse_optional_json_body(request: Request) -> dict:
    """Async dependency for optional body in rewrite and demo requests."""
    content_length = request.headers.get("content-length", "0")
    if content_length in ("0", ""):
        return {}
    return await parse_json_body(request)


def client_key(request: Request) -> str:
    # Do NOT trust raw X-Forwarded-For headers directly from client to prevent spoofing
    return request.client.host if request.client else "unknown"


def create_app(service: Optional[ReviewService] = None, rate_limit: Optional[int] = None) -> FastAPI:
    svc = service or build_service_from_env()
    limiter = RateLimiter(rate_limit if rate_limit is not None else int(get_env("RATE_LIMIT_PER_MIN", "40")))
    auth_limiter = AuthRateLimiter(max_attempts=10, window_seconds=900.0)

    custodia_env = (get_env("ENV") or "prod").lower()
    custodia_secret = get_env("SECRET")

    # Production startup check: CUSTODIA_SECRET is required
    if custodia_env not in ("dev", "test") and not custodia_secret:
        raise RuntimeError("CUSTODIA_SECRET is required in production environments.")

    secret_key = custodia_secret or "custodia-development-fallback-secret-key-32chars"
    anon_signer = URLSafeTimedSerializer(secret_key, salt="custodia-anon-salt")
    secure_cookies = custodia_env != "dev"

    app = FastAPI(title="Custodia", version="0.3.0")

    cors_origins_raw = get_env("CORS_ORIGINS", "")
    origins = [o.strip() for o in cors_origins_raw.split(",") if o.strip()] if cors_origins_raw else []
    if origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=origins,
            allow_credentials=True,
            allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
            allow_headers=["content-type", "x-delete-token", "origin"],
        )

    def check_csrf(request: Request):
        if request.method in ("POST", "PUT", "PATCH", "DELETE"):
            origin = request.headers.get("origin")
            if origin:
                parsed_origin = origin.rstrip("/")
                app_origin = f"{request.url.scheme}://{request.url.netloc}".rstrip("/")
                valid_origins = {
                    app_origin,
                    "http://localhost:5173",
                    "http://127.0.0.1:5173",
                    "http://localhost:8000",
                    "http://127.0.0.1:8000",
                    "http://testserver",
                }
                for o in origins:
                    valid_origins.add(o.rstrip("/"))
                if parsed_origin not in valid_origins:
                    raise ApiError(403, "CSRF_ORIGIN_MISMATCH", "Origin header does not match application origin.")

    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        response = await call_next(request)
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; img-src 'self' data:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self' *; frame-ancestors 'none'"
        )
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["X-Frame-Options"] = "DENY"
        path = request.url.path
        if path.startswith("/api/") or path.startswith("/r/"):
            response.headers["X-Robots-Tag"] = "noindex"
        return response

    def err(status, code, message):
        return JSONResponse(status_code=status, content={"error": {"code": code, "message": message}})

    @app.exception_handler(ApiError)
    async def _api(_, e: ApiError): return err(e.status, e.code, e.message)

    @app.exception_handler(RequestValidationError)
    async def _val(_, e): return err(422, "INVALID_INPUT", "The request body is not valid.")

    @app.exception_handler(Exception)
    async def _any(request, e):
        # Type and route only: never user text or secrets
        log.error("unhandled %s on %s %s", type(e).__name__, request.method, request.url.path)
        return err(500, "INTERNAL_ERROR", "Something went wrong on our side. No verdict was produced; please send this case to human review.")

    def get_current_user(request: Request) -> Optional[dict]:
        token = request.cookies.get(SESSION_COOKIE)
        if not token:
            return None
        id_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
        session = svc.store.get_session(id_hash)
        if not session:
            return None
        return session.get("user")

    def get_or_create_anon_id(request: Request) -> tuple[str, bool]:
        cookie_val = request.cookies.get(ANON_COOKIE)
        if cookie_val:
            try:
                anon_id = anon_signer.loads(cookie_val, max_age=60 * 86400)
                if isinstance(anon_id, str) and anon_id:
                    return anon_id, False
            except Exception:
                pass
        return secrets.token_urlsafe(24), True

    def set_session_cookie(response: Response, token: str):
        response.set_cookie(
            key=SESSION_COOKIE,
            value=token,
            httponly=True,
            secure=secure_cookies,
            samesite="lax",
            max_age=14 * 86400,
            path="/",
        )

    def set_anon_cookie(response: Response, anon_id: str):
        signed = anon_signer.dumps(anon_id)
        response.set_cookie(
            key=ANON_COOKIE,
            value=signed,
            httponly=True,
            secure=secure_cookies,
            samesite="lax",
            max_age=60 * 86400,
            path="/",
        )

    @app.get("/api/ping")
    def ping():
        """Lightweight warmup health check (no DB or model calls)."""
        return {"ok": True}

    @app.get("/api/health")
    def health():
        nli_avail = svc.nli.is_available if svc.nli else False
        nli_enabled = svc.nli.config.enabled if svc.nli else False

        models_info = None
        budget_info = None
        if svc.llm:
            models_info = {
                "extract": svc.llm.model_extract,
                "flags": svc.llm.model_flags,
                "rewrite": svc.llm.model_rewrite,
            }
            budget_info = svc.llm.budget_tracker.status

        return {
            "status": "ok",
            "extractor_mode": svc.configured_mode,
            "active_mode": svc.active_mode,
            "llm_configured": svc.llm is not None,
            "models": models_info,
            "llm_budget": budget_info,
            "nli_enabled": nli_enabled,
            "nli_available": nli_avail,
            "nli_model_id": svc.nli.config.model_id if svc.nli else None,
            "engine_version": ENGINE_VERSION,
            "language_review": "rules+model" if svc.llm else "rules",
            "limits": {"claim_chars": MAX_CLAIM, "evidence_chars": MAX_EVIDENCE},
        }

    @app.get("/api/examples")
    def examples():
        return {"note": "Illustrative teaching scenarios, not a benchmark or real-world validation.", "examples": EXAMPLES}

    @app.get("/api/usage")
    def get_usage(request: Request, response: Response):
        user = get_current_user(request)
        if user:
            return {"signed_in": True, "free_checks_remaining": None}

        anon_id, is_new = get_or_create_anon_id(request)
        if is_new:
            set_anon_cookie(response, anon_id)

        free_limit = int(get_env("FREE_CHECKS", "1"))
        if free_limit == 0:
            remaining = 999999
        else:
            checks_used = svc.store.get_anon_usage(anon_id)
            remaining = max(0, free_limit - checks_used)
        return {"signed_in": False, "free_checks_remaining": remaining}

    @app.post("/api/auth/signup", status_code=201)
    def signup(request: Request, response: Response, body: dict = Depends(parse_json_body)):
        check_csrf(request)
        email = body.get("email", "").strip().lower()
        password = body.get("password", "")
        review_ids = body.get("review_ids") or []

        auth_limiter.check(f"ip:{client_key(request)}")
        auth_limiter.check(f"email:{email}")

        if not email or not EMAIL_REGEX.match(email):
            raise ApiError(400, "INVALID_EMAIL", "Please enter a valid email address.")
        if len(password) < 10:
            raise ApiError(400, "WEAK_PASSWORD", "Password must be at least 10 characters.")
        if len(password) > 128:
            raise ApiError(400, "PASSWORD_TOO_LONG", "Password must be at most 128 characters.")

        existing = svc.store.get_user_by_email(email)
        if existing:
            raise ApiError(409, "EMAIL_EXISTS", "An account with this email already exists.")

        # TODO: Implement email verification once an email delivery provider (e.g. Resend, SendGrid) is configured.
        pwd_hash = pwd_hasher.hash(password)
        user_id = f"user_{secrets.token_hex(8)}"
        user = svc.store.create_user(user_id, email, pwd_hash)

        # Issue 32 random bytes session token
        token = secrets.token_hex(32)
        tok_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
        expires = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=14)
        svc.store.create_session(tok_hash, user["id"], expires)
        set_session_cookie(response, token)

        # Attach anonymous reviews
        if isinstance(review_ids, list) and review_ids:
            svc.store.attach_reviews_to_user(user["id"], [str(r) for r in review_ids])

        return {"user": {"id": user["id"], "email": user["email"]}}

    @app.post("/api/auth/login")
    def login(request: Request, response: Response, body: dict = Depends(parse_json_body)):
        check_csrf(request)
        email = body.get("email", "").strip().lower()
        password = body.get("password", "")
        review_ids = body.get("review_ids") or []

        auth_limiter.check(f"ip:{client_key(request)}")
        auth_limiter.check(f"email:{email}")

        if not email:
            raise ApiError(400, "EMAIL_REQUIRED", "Email is required.")
        if not password and email not in ("demo", "demo@custodia.dev"):
            raise ApiError(400, "PASSWORD_REQUIRED", "Password is required.")

        # Testing demo user bypass
        if email in ("demo", "demo@custodia.dev"):
            user = svc.store.get_user_by_email("demo@custodia.dev")
            if not user:
                user = svc.store.create_user("user_demo", "demo@custodia.dev", DUMMY_HASH)
        else:
            user = svc.store.get_user_by_email(email)
            if not user:
                # Timing equalization against timing attacks
                try:
                    pwd_hasher.verify(DUMMY_HASH, password)
                except Exception:
                    pass
                raise ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password.")

            try:
                pwd_hasher.verify(user["password_hash"], password)
            except Exception:
                raise ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password.")

        token = secrets.token_hex(32)
        tok_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
        expires = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=14)
        svc.store.create_session(tok_hash, user["id"], expires)
        set_session_cookie(response, token)

        if isinstance(review_ids, list) and review_ids:
            svc.store.attach_reviews_to_user(user["id"], [str(r) for r in review_ids])

        return {"user": {"id": user["id"], "email": user["email"]}}

    @app.post("/api/auth/demo")
    def demo_login(request: Request, response: Response, body: dict = Depends(parse_optional_json_body)):
        check_csrf(request)
        user = svc.store.get_user_by_email("demo@custodia.dev")
        if not user:
            user = svc.store.create_user("user_demo", "demo@custodia.dev", DUMMY_HASH)

        token = secrets.token_hex(32)
        tok_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
        expires = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=14)
        svc.store.create_session(tok_hash, user["id"], expires)
        set_session_cookie(response, token)

        review_ids = body.get("review_ids") if isinstance(body, dict) else []
        if isinstance(review_ids, list) and review_ids:
            svc.store.attach_reviews_to_user(user["id"], [str(r) for r in review_ids])

        return {"user": {"id": user["id"], "email": user["email"]}}

    @app.post("/api/auth/logout")
    def logout(request: Request, response: Response):
        check_csrf(request)
        token = request.cookies.get(SESSION_COOKIE)
        if token:
            tok_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
            svc.store.delete_session(tok_hash)
        response.delete_cookie(
            key=SESSION_COOKIE,
            httponly=True,
            secure=secure_cookies,
            samesite="lax",
            path="/",
        )
        return {"ok": True}

    @app.get("/api/auth/me")
    def get_me(request: Request):
        user = get_current_user(request)
        if not user:
            return {"user": None}
        return {"user": {"id": user["id"], "email": user["email"]}}

    @app.get("/api/reviews/mine")
    def get_my_reviews(request: Request):
        user = get_current_user(request)
        if not user:
            raise ApiError(401, "UNAUTHORIZED", "Please log in to view your checks.")
        reviews = svc.store.get_user_reviews(user["id"])
        for r in reviews:
            r.delete_token = None
        return {"reviews": reviews}

    # Synchronous def handler run in threadpool to prevent blocking the event loop
    @app.post("/api/reviews", status_code=201)
    def create_review(request: Request, response: Response, body: dict = Depends(parse_json_body)):
        limiter.check(client_key(request))
        check_csrf(request)
        try:
            req = ReviewRequest.model_validate(body)
        except ValidationError:
            raise ApiError(422, "INVALID_INPUT", "claim_text and evidence_text must be strings.")
        if not req.claim_text.strip():
            raise ApiError(400, "CLAIM_REQUIRED", "Enter the marketing claim you want to check.")
        if not req.evidence_text.strip():
            raise ApiError(400, "EVIDENCE_REQUIRED", "Paste the evidence that is meant to support the claim.")
        if len(req.claim_text) > MAX_CLAIM:
            raise ApiError(413, "CLAIM_TOO_LONG", f"The claim is limited to {MAX_CLAIM} characters.")
        if len(req.evidence_text) > MAX_EVIDENCE:
            raise ApiError(413, "EVIDENCE_TOO_LONG", f"Evidence is limited to {MAX_EVIDENCE} characters.")

        user = get_current_user(request)
        anon_id, is_new_anon = get_or_create_anon_id(request)
        if is_new_anon:
            set_anon_cookie(response, anon_id)

        # Static example scenarios and the landing-page demo never count as a check
        is_example = any(
            ex.get("claim", "").strip() == req.claim_text.strip()
            and ex.get("evidence", "").strip() == req.evidence_text.strip()
            for ex in EXAMPLES
        )

        user_id = user["id"] if user else None

        if not user and not is_example:
            free_limit = int(get_env("FREE_CHECKS", "1"))
            if free_limit > 0:
                checks_used = svc.store.get_anon_usage(anon_id)
                if checks_used >= free_limit:
                    raise ApiError(
                        401,
                        "SIGNUP_REQUIRED",
                        "Sign up or log in to keep checking claims. Your draft has been preserved.",
                    )
                # Clearing cookies is a known bypass; the IP counter only slows it down.
                ip_hash = hashlib.sha256(client_key(request).encode("utf-8")).hexdigest()
                ip_used = svc.store.get_ip_usage(ip_hash)
                ip_soft_cap = max(20, free_limit * 10)
                if ip_used >= ip_soft_cap:
                    raise ApiError(
                        401,
                        "SIGNUP_REQUIRED",
                        "Free check limit reached from this network. Please create an account to continue.",
                    )

        review = svc.review(req.claim_text, req.evidence_text, user_id=user_id)

        if not user and not is_example:
            ip_hash = hashlib.sha256(client_key(request).encode("utf-8")).hexdigest()
            svc.store.increment_anon_usage(anon_id, ip_hash)

        return review

    @app.get("/api/reviews/{review_id}")
    def get_review(review_id: str, request: Request):
        limiter.check(client_key(request))
        r = svc.store.get(review_id)
        if not r:
            raise ApiError(404, "REVIEW_NOT_FOUND", "This review expired or was deleted. Reviews are kept for 30 days.")
        # Do not expose delete_token on GET retrieval
        r.delete_token = None
        return r

    @app.post("/api/reviews/{review_id}/rewrite")
    def rewrite(review_id: str, request: Request, body: dict = Depends(parse_optional_json_body)):
        limiter.check(client_key(request))
        check_csrf(request)
        r = svc.store.get(review_id)
        if not r:
            raise ApiError(404, "REVIEW_NOT_FOUND", "This review expired or was deleted. Reviews are kept for 30 days.")
        try:
            req = RewriteRequest.model_validate(body)
        except ValidationError:
            raise ApiError(422, "INVALID_INPUT", "candidate_text must be a string.")
        if req.candidate_text is not None:
            if not req.candidate_text.strip():
                raise ApiError(400, "CANDIDATE_EMPTY", "The edited wording is empty.")
            if len(req.candidate_text) > MAX_CLAIM:
                raise ApiError(413, "CLAIM_TOO_LONG", f"Wording is limited to {MAX_CLAIM} characters.")
        return svc.rewrite(r, req.candidate_text)

    @app.delete("/api/reviews/{review_id}", status_code=204)
    def delete_review(review_id: str, request: Request):
        limiter.check(client_key(request))
        check_csrf(request)
        token = request.headers.get("x-delete-token", "").strip()
        if not token:
            raise ApiError(403, "FORBIDDEN", "X-Delete-Token header is required to delete a review.")
        success, reason = svc.delete_review(review_id, token)
        if not success:
            if reason == "NOT_FOUND":
                raise ApiError(404, "REVIEW_NOT_FOUND", "This review expired or was deleted. Reviews are kept for 30 days.")
            raise ApiError(403, "FORBIDDEN", "Invalid delete token.")
        return Response(status_code=204)

    web_dir = Path(get_env("WEB_DIR", str(Path(__file__).parent / "web")))
    if (web_dir / "index.html").exists():
        if (web_dir / "assets").is_dir():
            app.mount("/assets", StaticFiles(directory=web_dir / "assets"), name="assets")

        @app.get("/", include_in_schema=False)
        def index():
            return FileResponse(web_dir / "index.html")

        @app.get("/check", include_in_schema=False)
        def check_route():
            return FileResponse(web_dir / "index.html")

        @app.get("/examples", include_in_schema=False)
        def examples_route():
            return FileResponse(web_dir / "index.html")

        @app.get("/login", include_in_schema=False)
        def login_route():
            return FileResponse(web_dir / "index.html")

        @app.get("/signup", include_in_schema=False)
        def signup_route():
            return FileResponse(web_dir / "index.html")

        @app.get("/my-checks", include_in_schema=False)
        def my_checks_route():
            return FileResponse(web_dir / "index.html")

        @app.get("/r/{review_id}", include_in_schema=False)
        def review_route(review_id: str):
            return FileResponse(web_dir / "index.html")

        @app.get("/favicon.svg", include_in_schema=False)
        def favicon():
            return FileResponse(web_dir / "favicon.svg")
    else:
        @app.get("/", include_in_schema=False)
        @app.get("/check", include_in_schema=False)
        @app.get("/examples", include_in_schema=False)
        @app.get("/login", include_in_schema=False)
        @app.get("/signup", include_in_schema=False)
        @app.get("/my-checks", include_in_schema=False)
        @app.get("/r/{review_id}", include_in_schema=False)
        def index_missing(review_id: Optional[str] = None):
            return HTMLResponse(
                "<h1>Custodia API is running</h1><p>The web interface has not been built. "
                "Run <code>cd frontend &amp;&amp; npm ci &amp;&amp; npm run build</code>, or use the Docker image. "
                "The API is available under <code>/api</code>.</p>",
                status_code=503,
            )

    return app


app = create_app()
