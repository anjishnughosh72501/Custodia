# Custodia — Hackathon Submission Guide

## 1. Project Information

- **Project Name**: Custodia
- **Tagline**: Rule-based claim verification for marketing and compliance. Verdicts are decided by deterministic code; a model may only propose quotes that are verified against your text.
- **Repository**: [https://github.com/anjishnughosh72501/Custodia](https://github.com/anjishnughosh72501/Custodia)
- **Live Frontend (Vercel)**: `<FRONTEND_VERCEL_URL_PLACEHOLDER>`
- **Live Backend (Render)**: `<BACKEND_RENDER_URL_PLACEHOLDER>`
- **Demo Video URL**: `<DEMO_VIDEO_URL_PLACEHOLDER>`
- **Team**: `<TEAM_NAMES>`
- **Contact Email**: `<CONTACT_EMAIL>`

---

## 2. Elevator Pitch & Problem

When marketing teams draft campaign copy, claims often outgrow the factual evidence:
- A 30% reduction in setup time becomes *"cuts setup time by 40%"*.
- A test of 120 small businesses becomes *"for every business"*.
- Prerequisites (e.g. *"on Pro plans"*) or observation timeframes are quietly dropped.
- Retrospective findings are inflated into forward-looking guarantees.

Generic LLMs fail as compliance checkers: they hallucinate, fail basic arithmetic, succumb to adversarial prompt injections, and perform non-deterministic "vibe checks".

**Custodia solves this with a deterministic-first architecture**:
1. **Code decides, not the model**: Large language models and NLI models only propose candidate quotes and flags. Deterministic Python rules verify character offsets against original text and render all final verdicts.
2. **Every finding has receipts**: Highlighted findings trace to verified character positions in both the draft and evidence.
3. **Fail-closed posture**: Ambiguous, missing, or contradictory text routes to `Needs human review` or `Not supported`—never rubber-stamped.
4. **Honest semantics**: Custodia checks whether wording stays inside the supplied evidence. It does not browse the web or claim a source is objectively true.

---

## 3. System Architecture & Technical Highlights

```
┌────────────────────────────────────────────────────────┐
│             Vercel Frontend (React 18 + TS)            │
│  - Anime.js staggered entrance & interactive inspector │
│  - Cold-start detection with automatic retry polling   │
│  - 16 pre-bundled offline scenarios fallback           │
│  - Client-side Markdown report generator & export      │
└───────────────────────────┬────────────────────────────┘
                            │ HTTPS / JSON API
┌───────────────────────────▼────────────────────────────┐
│              Render Backend (FastAPI + Python)         │
│  - Thread-pool unblocked event loop (fast /api/ping)   │
│  - Concurrent 3-worker extraction with 12s budget     │
│  - Role-based models (Haiku extract/flags, Sonnet rw)  │
│  - Proxy-aware sliding-window rate limiting (5k keys)  │
│  - 30-day retention with SHA-256 delete token support  │
│  - Optional ONNX INT8 NLI semantic diagnostic signal   │
└────────────────────────────────────────────────────────┘
```

- **Dual Deployment**: Runs either as a split deployment (Frontend on Vercel, Backend on Render with optional Postgres/Neon) or as a single self-contained Docker container (`docker run -p 8000:8000 custodia`).
- **Cold-Start Resilience**: Free cloud containers sleep when idle; Custodia detects delays over 3s, alerts the user with an inline waking notice, polls until ready, and offers 16 immediately usable offline scenarios.
- **Privacy & Safety**: Zero tracking, strict security headers (CSP, X-Frame-Options: DENY), `noindex` robots tags on saved review URLs, and full client-side deletion support (`DELETE /api/reviews/{id}`).

---

## 4. Benchmark & Validation Summary

Evaluated on an in-house suite of 65 test cases across 16 categories with stratified 60/40 splits (`dev` and `heldout`):
- **False Approvals**: **0** (target met across all 65 cases).
- **False Rejections**: **0** (all faithful cases approved).
- **Execution Speed**: Full 65-case benchmark executes in under 70 milliseconds on CPU.
- Detailed report available in [docs/BENCHMARK.md](file:///c:/A%20folder/Code%20Projects/ClaimFit-main/ClaimFit-main/docs/BENCHMARK.md) and [bench/RESULTS.md](file:///c:/A%20folder/Code%20Projects/ClaimFit-main/ClaimFit-main/bench/RESULTS.md).

---

## 5. Deployment Verification Checklist

- [x] Backend tests pass (152 pytest tests, 0 failures)
- [x] Frontend tests pass (53 vitest unit tests, 0 failures)
- [x] TypeScript clean (`tsc --noEmit` exits 0)
- [x] Production build clean (`vite build` exits 0)
- [x] Benchmark suite passes (`python bench/run.py` exits 0 with 0 false approvals)
- [x] Zero secrets committed in repository
- [x] Accessibility preserved (keyboard navigation, ARIA roles, prefers-reduced-motion)
- [x] Banned word tests pass (no false credibility or accuracy claims)
- [x] Dual deployment verified (Vercel + Render split AND Docker single-service)
