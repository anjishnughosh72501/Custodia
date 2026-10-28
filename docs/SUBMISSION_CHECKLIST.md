# Submission Checklist

### Local Verification (Completed & Fully Verified)
- [x] Backend tests: 152 tests passing (`python -m pytest -q`).
- [x] Frontend tests: 53 tests across 11 suites passing (`cd frontend && npm test -- --run`).
- [x] Frontend typecheck: clean (`cd frontend && npx tsc --noEmit`).
- [x] Frontend build: clean production build (`cd frontend && npm run build`).
- [x] Deterministic benchmark: 65 labelled test cases (38 dev, 27 heldout; 45 baseline, 20 adversarial), 0 false approvals, 0 false rejections (`python bench/run.py`).
- [x] Security headers and CSP configured (including font data URIs, frame-ancestors, nosniff, noindex on review pages).
- [x] Proxy-aware rate limiter implemented (`X-Forwarded-For` first hop) with memory pruning (5k max keys).
- [x] Event loop unblocked: async handlers converted to thread pool, parallel extraction with 12s budget.
- [x] Persistence & privacy: 30-day retention with SHA-256 delete token, `DELETE /api/reviews/{id}` endpoint.
- [x] Dual storage support: SQLite (local/Docker) and PostgreSQL (Neon/Render).
- [x] Environment variable aliasing: `CUSTODIA_*` first with backward-compatible `SCOPELOCK_*` fallbacks.
- [x] Dockerfile hardened: pinned versions, non-root `custodia` user (`UID 10001`), `/data` directory, healthcheck on `/api/ping`.
- [x] GitHub Actions CI workflow created (`.github/workflows/ci.yml`).
- [x] Honest copy and documentation: zero fabricated benchmark or accuracy percentages in UI copy or README.
- [x] Third-party attribution: `docs/THIRD_PARTY.md` credits React Bits components under MIT License.
- [x] Screenshots captured in `docs/screenshots/` (desktop landing/checker, mobile landing/checker, evidence fit rings).

### Deployment Configuration Steps
- [x] Dual-deployment configuration:
  - [x] Frontend on Vercel: `frontend/vercel.json` SPA routing, `VITE_API_BASE` support.
  - [x] Backend on Render: `render.yaml` with `custodia-api`, CORS support, `/api/ping` healthcheck.
  - [x] Single-service Docker: FastAPI serving built React frontend.
- [ ] Connect repository to Vercel and Render using provided deployment guides in `README.md`.
- [ ] Set `VITE_API_BASE` to live Render backend URL `<BACKEND_RENDER_URL_PLACEHOLDER>`.
- [ ] Verify live public URLs over HTTPS.
