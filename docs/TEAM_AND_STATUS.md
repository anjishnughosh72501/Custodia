# Ownership and Verified Status

## Team and Contact

- **Team**: `<TEAM_NAMES>`
- **Contact Email**: `<CONTACT_EMAIL>`
- **Repository**: [https://github.com/anjishnughosh72501/Custodia](https://github.com/anjishnughosh72501/Custodia)
- **Live Frontend (Vercel)**: `<FRONTEND_VERCEL_URL_PLACEHOLDER>`
- **Live Backend (Render)**: `<BACKEND_RENDER_URL_PLACEHOLDER>`

---

## Component Status

| Area / Component | Files | Status |
| :--- | :--- | :--- |
| **Core Engine & Rules** | `app/rules/engine.py`, `app/extraction/parsers.py`, `app/language/risk.py`, `app/extraction/nli.py` | 100% verified. 7 comparison dimensions, exact residue masking, second-person promises, gerund traps, unicode homoglyph normalization, case-insensitive preposition matching, optional lightweight ONNX NLI fallback. |
| **Backend API & Service** | `app/main.py`, `app/service.py`, `app/store.py`, `app/extraction/llm.py` | 100% verified. Thread-pooled asynchronous handling, parallel extraction with 12s budget, role-based model configurations, proxy-aware bounded rate limiter, 30-day retention with delete token endpoint (`DELETE /api/reviews/{id}`), PostgreSQL/Neon support, CORS, `/api/ping`. |
| **Frontend React UI** | `frontend/src/` (Marketing & App shells, Checker, Examples library, Doc & Inspector, Motion & React Bits) | 100% verified. 53 Vitest unit tests pass, TypeScript compiles cleanly, cold-start waking detection, static example fallback, client-side Markdown report download, copy link, and review deletion. |
| **Benchmark Evaluation** | `bench/cases.jsonl`, `bench/run.py`, `docs/BENCHMARK.md` | 100% verified. 65 evaluation cases (38 dev, 27 heldout; 45 baseline, 20 adversarial) evaluate with 0 false approvals and 0 false rejections in under 70 ms. |
| **Production Container & Deployment** | `Dockerfile`, `render.yaml`, `frontend/vercel.json`, `requirements.txt` | Hardened multi-stage Docker build, unprivileged user (`custodia`, UID 10001), healthcheck against `/api/ping`, dual deployment support (Render backend + Vercel frontend or single-service Docker). |
| **Documentation & Attribution** | `README.md`, `docs/SUBMISSION.md`, `docs/DEMO_SCRIPT.md`, `docs/THIRD_PARTY.md`, `LICENSE` | Clean and honest documentation; React Bits MIT attribution preserved; strictly zero fabricated claims or accuracy figures. |
