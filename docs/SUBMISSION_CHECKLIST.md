# Submission Checklist

### Local Verification (Completed & Fully Verified)
- [x] Backend tests: 113 tests passing (`python -m pytest -q --ignore=tests/e2e`).
- [x] Frontend tests: 52 tests across 11 suites passing (`cd frontend && npm test -- --run`).
- [x] Frontend typecheck: clean (`cd frontend && npx tsc --noEmit`).
- [x] Frontend build: clean production build (`cd frontend && npm run build`).
- [x] Playwright E2E browser suite: 54/54 automated checks passing across desktop, mobile, reduced-motion, CSP, and full interactions (`python tests/e2e/test_ui.py`).
- [x] Deterministic benchmark: 65 labelled test cases (45 baseline, 20 adversarial), 0 false approvals, 0 false rejections (`python bench/run.py`).
- [x] Security headers and CSP configured (including font data URIs, frame-ancestors, nosniff).
- [x] Proxy-aware rate limiter implemented (`X-Forwarded-For` first hop) with background timestamp pruning.
- [x] Environment variable aliasing: `CUSTODIA_*` first with backward-compatible `SCOPELOCK_*` fallbacks.
- [x] Dockerfile hardened: pinned versions, non-root `custodia` user (`UID 10001`), `/data` directory, healthcheck.
- [x] GitHub Actions CI workflow created (`.github/workflows/ci.yml`).
- [x] Honest copy and documentation: no fabricated benchmark or accuracy percentages in UI copy or README.
- [x] Third-party attribution: `docs/THIRD_PARTY.md` credits React Bits components under MIT License.
- [x] Screenshots captured in `docs/screenshots/` (desktop landing/checker, mobile landing/checker, evidence fit rings).

### Pre-Deployment / Release Steps
- [ ] Deploy container to hosting platform (Render blueprint in `render.yaml` or container host).
- [ ] Verify live public URL over HTTPS:
  - [ ] Check `/api/health` returns status `ok`.
  - [ ] Verify `/`, `/check`, `/examples`, and `/r/{id}` routes directly and on browser refresh.
  - [ ] Validate responsive layouts on real mobile device.
- [ ] If setting `ANTHROPIC_API_KEY`: verify model-assisted mode operates; if unset, engine runs purely on deterministic heuristic rules.
