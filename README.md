# Custodia

> **Deterministic claim verification for marketing and compliance.**  
> Checks whether marketing wording stays strictly within the supplied evidence before publication.

---

## About Custodia

Custodia is an automated, deterministic verification tool designed for marketing leads, compliance officers, and legal reviewers who must substantiate public claims against backing data (reports, clinical studies, benchmark metrics, or whitepapers).

### The Problem
Marketing copy frequently stretches the underlying data:
- An observed 30% reduction in setup time becomes "cuts setup time by 40%".
- A bounded test of 120 small businesses becomes "for every business".
- A conditional Pro tier requirement is silently dropped.
- Retrospective observational findings are turned into future "guarantees" or second-person promises.

Typical LLM-based checkers are vulnerable to prompt injection, hallucinations, and non-deterministic judgements.

### Architectural Principles ("Not a vibe check")
1. **Code decides, not the model**: The model is only used to propose verbatim quote candidates and semantic flags. Deterministic rule-based engines verify character positions against original source text and make all verdict decisions. Prompt injection or hallucinated output can never force an approval.
2. **Every finding has receipts**: All findings rest on verified character spans and exact quotes in the user's text.
3. **Unclear goes to human review**: If an extraction cannot be verified with certainty, or if unverified assertions / residue remain in the claim, approval is withheld and flagged as `Needs human review`—never rubber-stamped.
4. **"Supported" is not "objectively true"**: A `Supported` verdict only indicates that the draft wording stays within the provided evidence text; Custodia does not crawl the web or vouch for the external veracity of the evidence itself.

---

## How It Works

Custodia evaluates claims through a multi-stage deterministic pipeline:

```
[Draft Claim + Evidence Text]
             │
             ▼
   [Extraction Stage]
  (Rule-based heuristics or LLM quote proposal)
             │
             ▼
   [Span & Verbatim Verification]
  (Checks every quote exists verbatim in input)
             │
             ▼
   [Seven Dimensions Comparison]
  1. Metric
  2. Value / statistic
  3. Unit
  4. Population / cohort
  5. Time window
  6. Conditions / plan
  7. Strength of wording
             │
             ▼
   [Language Risk Analysis & Residue Detection]
  (Absolutes, guarantees, superlatives, promises, unverified assertions)
             │
             ▼
   [Verdict Decision & Narrower Rewrite]
  (Supported / Contradicted / Needs human review)
```

---

## Tech Stack

- **Backend:** Python 3.12+, FastAPI, SQLite (persisting review IDs), Pydantic v2, Uvicorn.
- **Frontend:** React 18, TypeScript, Vite 5, Plain CSS with design tokens (`--ivory`, `--paper`, `--ink`, `--ok`, `--bad`, `--warn`).
- **Typography:** Fraunces Variable (display serif) & Hanken Grotesk Variable (body sans).
- **Motion System:** View Transitions API, `IntersectionObserver` scroll reveal, Magnet buttons, Glare hover cards, accessible Count Up, and SVG thread drawing. Supports `prefers-reduced-motion`.
- **Testing:** `pytest` (backend unit & regression), `vitest` (frontend unit), `playwright` (responsive browser e2e).

---

## Configuration & Environment Variables

All settings are optional; without an Anthropic API key, the engine operates purely on deterministic rules and heuristics. Legacy `SCOPELOCK_*` environment variables are supported as backward-compatible fallbacks.

| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | *(empty)* | Optional Anthropic API key. When omitted, runs in rule-based heuristic mode. |
| `CUSTODIA_MODEL` | `claude-sonnet-5-5` | Model name to use when `ANTHROPIC_API_KEY` is present. |
| `CUSTODIA_LLM_TIMEOUT` | `20` | Timeout in seconds for model quote proposal calls. |
| `CUSTODIA_DB` | `custodia.db` | Path to SQLite database file storing review snapshots. |
| `CUSTODIA_RATE_LIMIT_PER_MIN` | `40` | Sliding window rate limit per client IP. Set to `0` for local test automation. |
| `CUSTODIA_LOG_LEVEL` | `INFO` | Backend logging level (`DEBUG`, `INFO`, `WARNING`, `ERROR`). |
| `CUSTODIA_WEB_DIR` | `app/web` | Directory from which the built React SPA is served. |
| `CUSTODIA_DISABLE_LLM` | `0` | Set to `1` to force heuristic extractor even if an API key is set. |

---

## Local Development

### Prerequisites
- Python 3.10+ (tested on Python 3.12)
- Node.js 18+ and `npm`

### 1. Backend Setup
```bash
# Clone the repository
git clone https://github.com/anjishnughosh72501/Custodia.git
cd Custodia

# Create and activate virtual environment
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

# Install backend dependencies
pip install -r requirements.txt
```

### 2. Frontend Setup & Build
```bash
cd frontend
npm ci
npm run build
cd ..
```
The build outputs to `app/web`, which FastAPI serves statically.

### 3. Run Application
```bash
# Start FastAPI server on http://localhost:8000
python -m uvicorn app.main:app --reload --port 8000
```
Open [http://localhost:8000](http://localhost:8000) to view the landing page, [http://localhost:8000/check](http://localhost:8000/check) for the checker workspace, or [http://localhost:8000/examples](http://localhost:8000/examples) for the examples library.

---

## Testing

Custodia maintains an extensive test suite with 100% verification passing:

```bash
# Run backend test suite (109 tests covering safety, extraction, rules, regressions, hardening, and benchmarks)
python -m pytest -q --ignore=tests/e2e

# Run frontend typecheck and unit tests (52 tests across 11 test suites)
cd frontend
npx tsc --noEmit
npm test -- --run
npm run build
cd ..

# Run end-to-end browser tests (requires Playwright and built frontend)
# Set rate limiter to 0 for rapid automated interaction:
CUSTODIA_RATE_LIMIT_PER_MIN=0 python tests/e2e/test_ui.py
```

---

## Deterministic Benchmark Suite

The repository includes a 65-case labelled evaluation benchmark in `bench/cases.jsonl` covering 45 baseline scenarios and 20 adversarial failure modes:

- **Metric drift & direction inversion**
- **Numeric inflation & boundary softening**
- **Unit mismatch & population widening**
- **Time window omissions & dropped conditions**
- **Causal leaps, gerund promises & prompt injections**
- **Unicode homoglyphs & formatting obfuscations**

Run the benchmark evaluation runner:
```bash
python bench/run.py
```

Output:
```
Evaluated 65 cases against deterministic engine.
False Approvals: 0 (0.0%)
False Rejections: 0 (0.0%)
```

> **Important:** This benchmark measures whether the deterministic engine reliably upholds its contract to withhold approval on known failure modes and adversarial attacks. It is an evaluation suite for contract enforcement, not a general marketing claim accuracy score.

---

## API Reference

### Health Check
`GET /api/health`

Response:
```json
{
  "status": "ok",
  "extractor_mode": "heuristic",
  "llm_configured": false,
  "engine_version": "rules-1.1",
  "language_review": "rules",
  "limits": {
    "claim_chars": 1000,
    "evidence_chars": 20000
  }
}
```

### Submit Review
`POST /api/reviews`

Request:
```json
{
  "claim_text": "Median setup time fell by 30%.",
  "evidence_text": "In a 30-day test of 120 small-business customers using Pro, median setup time fell by 30%."
}
```

Response includes the unique `id`, `verdict` (`SUPPORTED_BY_SUPPLIED_EVIDENCE`, `CONTRADICTED_BY_EVIDENCE`, `NEEDS_HUMAN_REVIEW`), seven dimension findings with exact verbatim spans and status, language risks, and calculated `fit_score`.

### Retrieve Saved Review
`GET /api/reviews/{id}`

Returns the full review object or HTTP 404 if not found.

### Re-verify or Generate Rewrite
`POST /api/reviews/{id}/rewrite`

Request:
```json
{
  "claim_text": "In a 30-day test of 120 small-business customers using Pro, median setup time fell by 30%."
}
```
Optional `claim_text` allows validating user edits against the original evidence; omitting it generates the engine's suggested narrower draft.

### Examples Library
`GET /api/examples`

Returns categorized teaching examples illustrating supported claims, metric mismatches, population expansions, dropped conditions, and adversarial injections.

### Error Format
All client and server errors return standard JSON:
```json
{
  "detail": "Descriptive error message"
}
```
HTTP status codes used:
- `400 Bad Request`: Input violates size or format limits.
- `404 Not Found`: Requested review ID does not exist.
- `422 Unprocessable Entity`: Schema validation errors.
- `429 Too Many Requests`: Rate limit exceeded (`Too many requests. Slow down to under 40 requests/min.`).

---

## Security & Deployment

### Production Hardening
- **Security Headers Middleware**: Every response includes `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and `Referrer-Policy: strict-origin-when-cross-origin`.
- **Proxy-Aware Sliding Window Rate Limiting**: The rate limiter inspects the client IP from the first hop of `X-Forwarded-For` when behind a reverse proxy, falling back to direct client IP. Expired timestamps are periodically pruned.
- **Input Sanitization**: Angular brackets and HTML-like markup are strictly handled as plain text spans, preventing DOM XSS.
- **Docker Container**: Multi-stage build (Node 22 build stage, Python 3.12 slim runtime stage), runs as an unprivileged `custodia` user (`UID 10001`), with `/data` volume for SQLite persistence and an automated `HEALTHCHECK`.
- **Render Deployment Blueprint**: Included in `render.yaml` for one-click deployment.

---

## Known Limits

- **English text only** in the current engine release.
- **No external source fetching:** Custodia evaluates only the text provided in the workspace; it does not browse the web or verify external veracity.
- **Single primary statistic:** Compares the primary metric per statement; ambiguous multi-statistic evidence is marked for human review.
- **Evidence fit score is not accuracy:** The score is an editorial summary of the seven comparisons, not an accuracy or source reliability measure; no accuracy figure is claimed.

---

## License

MIT License. See [LICENSE](file:///c:/A%20folder/Code%20Projects/ClaimFit-main/ClaimFit-main/LICENSE) for details.  
Third-party component notices and licenses are documented in [docs/THIRD_PARTY.md](file:///c:/A%20folder/Code%20Projects/ClaimFit-main/ClaimFit-main/docs/THIRD_PARTY.md).
