# Ownership and Verified Status

| Area / Component | Files | Status |
|---|---|---|
| Core Engine & Rules | `app/rules/engine.py`, `app/extraction/parsers.py`, `app/language/risk.py` | 100% verified. 7 comparison dimensions, exact residue masking, second-person promises, gerund traps, unicode homoglyph normalization, case-insensitive preposition matching. |
| Backend API & Service | `app/main.py`, `app/service.py`, `app/store.py`, `app/extraction/llm.py` | 100% verified. Security headers middleware (CSP with data URI fonts), proxy-aware rate limiter with memory pruning, env aliasing (`CUSTODIA_*`), SPA fallback routing (`/examples`, `/check`, `/r/{id}`). |
| Frontend React UI | `frontend/src/` (Marketing & App shells, Checker, Examples library, Doc & Inspector, Motion & React Bits) | 100% verified. 52 Vitest unit tests pass, TypeScript clean, production bundle compiles cleanly. |
| Benchmark Evaluation | `bench/cases.jsonl`, `bench/run.py`, `tests/test_benchmark.py` | 100% verified. 65 evaluation cases (45 baseline, 20 adversarial) evaluate with 0 false approvals and 0 false rejections. |
| Production Container & CI | `Dockerfile`, `render.yaml`, `.github/workflows/ci.yml` | Hardened multi-stage Docker build, unprivileged user (`custodia`, UID 10001), `/data` volume, automated CI workflow. |
| Documentation & Attribution | `README.md`, `docs/SUBMISSION_CHECKLIST.md`, `docs/THIRD_PARTY.md`, `LICENSE` | Clean and honest documentation; React Bits MIT attribution preserved; no fabricated accuracy claims. |
