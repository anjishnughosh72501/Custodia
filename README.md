# Custodia

> **Rule-based claim verification for marketing and compliance.**  
> Verdicts are decided by deterministic code; a model may only propose quotes that are verified against your text.

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

## Lightweight Natural Language Inference (NLI)

Custodia includes an optional, production-ready Natural Language Inference (NLI) module that provides semantic comparison without compromising the authority of the deterministic verification engine.

### What NLI Does
NLI treats the user's evidence as the **premise** and the marketing claim as the **hypothesis**, classifying their relationship into three distinct categories:
1. **Entailment** — The evidence semantically supports the wording of the claim.
2. **Neutral** — The evidence does not contain enough information to determine whether the claim is true.
3. **Contradiction** — The evidence directly conflicts with the statement in the claim.

### Difference from Quote Extraction & LLM Rewrites
| Capability | LLM Adapter (`app/extraction/llm.py`) | NLI Classifier (`app/extraction/nli.py`) | Deterministic Engine (`app/rules/engine.py`) |
|---|---|---|---|
| **Role** | Propose quotes, detect language risks, suggest rewrites | Score semantic entailment / contradiction | Enforce exact quotes, 7-dimension comparisons & final verdicts |
| **Output Type** | Generative text spans and flags | 3-class probability distribution & predicted label | Structured verdicts (`Supported`, `Contradicted`, `Needs human review`) |
| **Authority** | Advisory (must be verified verbatim) | Advisory (diagnostic signal only) | **Authoritative (final decision)** |
| **Inference Stack** | Remote Anthropic API call | Local ONNX Runtime INT8 on CPU | Pure Python (no models, no network) |

### Why Deterministic Checks Remain Authoritative
Empirical benchmarking reveals specific blind spots in small cross-encoder models:
- **Unit Blindness:** `nli-MiniLM2-L6-H768` predicted entailment (0.947 confidence) when comparing `3,000 RPM` with `3,000 MPH`. Custodia's deterministic `_unit` rule immediately caught this as `UNIT_MISMATCH` (`NOT_SUPPORTED`).
- **Arithmetic Reasoning:** The model predicted contradiction (0.955 confidence) when comparing `1.2s to 0.6s` against a claim of `improved by 50%`.
- **Dropped Limitations:** Semantic embeddings can overlook missing plan conditions or narrowed target populations.

**Conservative Decision Rules:**
1. **No Rubber-Stamping:** An NLI prediction of entailment can **never** upgrade an unverified, contradicted, or unknown claim to `Supported`.
2. **Contradiction Veto:** If all seven deterministic dimensions match but the semantic model detects a contradiction ($\ge 0.60$ confidence), approval is withheld and routed to human review (`NEEDS_HUMAN_REVIEW` with abstain reason `SEMANTIC_CONTRADICTION_FLAGGED`).
3. **Conservative Neutral Handling:** If the semantic model predicts a neutral relationship ($\ge 0.70$ confidence), the claim is routed to human review (`SEMANTIC_NEUTRAL_FLAGGED`).
4. **Input Truncation Safeguard:** When evidence exceeds sequence limits (`CUSTODIA_NLI_MAX_LENGTH`), the result is flagged as truncated and evaluated conservatively.

### Model Provenance & Licensing
- **Model ID:** `cross-encoder/nli-MiniLM2-L6-H768`
- **Base Checkpoint:** `nreimers/MiniLMv2-L6-H768-distilled-from-RoBERTa-Large` (distilled 6-layer RoBERTa, hidden size 768)
- **Pinned Revision:** `b95119ce93d3e065de6214e38cd4a97b0f2f2c6d`
- **License:** Apache-2.0
- **Verified Label Mapping:** `0: contradiction, 1: entailment, 2: neutral` (dynamically validated from model `config.json`).

### Model Preparation & INT8 Quantization
The production setup uses a dynamically quantized INT8 ONNX checkpoint that runs on CPU without requiring PyTorch at runtime.

To download, verify, and smoke-test the model:
```bash
python scripts/prepare_nli_model.py
```
This script downloads the pinned checkpoint files, verifies their SHA-256 checksums, confirms the `id2label` mapping, and runs an offline smoke test:
- `config.json` (SHA-256: `8b0e41caff...`)
- `tokenizer.json` (SHA-256: `82139106e6...`)
- `model_int8.onnx` (82.8 MB, SHA-256: `44391a5241...`)

### Benchmarking & Measured Render Free Tier Performance
We benchmarked the INT8 model using `scripts/benchmark_nli.py` across 24 curated test cases on CPU inference:

```
=================================================================
           CUSTODIA NLI BENCHMARK REPORT
=================================================================
Model: cross-encoder/nli-MiniLM2-L6-H768
Quantization: INT8 ONNX CPU | Checkpoint size: 79.0 MB
-----------------------------------------------------------------
Total Cases:     24
Accuracy:        75.00% (18/24)
Failures:        0
Truncated:       0 (0.0%)
-----------------------------------------------------------------
MEMORY FOOTPRINT (RSS):
  Baseline RSS:          31.2 MB
  Post-Load RSS:         153.1 MB (Delta: +122.0 MB)
  Peak RSS:              157.3 MB (Headroom vs 512 MB: 354.7 MB)
-----------------------------------------------------------------
LATENCY (CPU):
  Model Load:            363.4 ms
  Per-Pair Median:       21.08 ms
  Per-Pair Mean:         21.32 ms
  Per-Pair P95:          25.82 ms
-----------------------------------------------------------------
CONFUSION MATRIX:
                 Pred: Entailment | Neutral | Contradiction
  True entailment   :          6 |       1 |             1
  True neutral      :          0 |       7 |             0
  True contradiction:          2 |       2 |             5
=================================================================
```

> **Memory Ceiling Assessment:** At 157.3 MB peak RSS, the application maintains **354.7 MB of memory headroom** under Render's 512 MB free tier ceiling. Single-worker execution (`--workers 1`) is enforced in Docker to avoid duplicating model weights across processes.

### Running the Benchmark
```bash
python scripts/benchmark_nli.py
# Or supply a custom evaluation dataset:
python scripts/benchmark_nli.py --dataset bench/nli_benchmark_cases.json
```

### Enabling and Disabling NLI
NLI is controlled via `CUSTODIA_NLI_ENABLED`:
- `CUSTODIA_NLI_ENABLED=0` (default): NLI is disabled; reviews run purely on deterministic checks or Anthropic extraction.
- `CUSTODIA_NLI_ENABLED=1`: NLI is loaded on startup and evaluated for all incoming claims.

Custodia supports four independent processing modes, reported in `/api/health` under `active_mode`:
1. `heuristic` — NLI disabled, Anthropic disabled.
2. `heuristic+nli` — NLI enabled, Anthropic disabled.
3. `llm` — NLI disabled, Anthropic enabled.
4. `llm+nli` — Both NLI and Anthropic enabled.

If model files are missing or loading fails, the service logs a warning, continues safely in fallback mode with `nli.available=False`, and preserves full deterministic verification.

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
| `CUSTODIA_NLI_ENABLED` | `0` | Set to `1` to enable local quantized Natural Language Inference inference. |
| `CUSTODIA_NLI_MODEL_PATH` | `models/model_int8.onnx` | Path to the dynamically quantized INT8 ONNX checkpoint file. |
| `CUSTODIA_NLI_TOKENIZER_PATH` | `models/tokenizer.json` | Path to the Hugging Face `tokenizer.json` file. |
| `CUSTODIA_NLI_CONFIG_PATH` | `models/config.json` | Path to the Hugging Face `config.json` file containing label mappings. |
| `CUSTODIA_NLI_MAX_LENGTH` | `256` | Bounded maximum sequence length (in tokens) for NLI inference. |
| `CUSTODIA_NLI_MAX_INPUT_CHARS` | `2000` | Character ceiling for claim and evidence text passed to the NLI module. |
| `CUSTODIA_NLI_ENTAILMENT_THRESHOLD` | `0.70` | Confidence threshold required to consider NLI entailment strong. |
| `CUSTODIA_NLI_CONTRADICTION_THRESHOLD` | `0.60` | Confidence threshold to flag semantic contradiction and withhold approval. |

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
# Run backend test suite (140 tests covering safety, extraction, rules, NLI, regressions, hardening, and benchmarks)
# Note: NLI unit tests mock the ONNX runtime session, requiring zero model downloads
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

## Deployment & Production Architecture

Custodia supports two deployment architectures:

### Option A: Vercel (Frontend) + Render (Backend) Split (Production Recommended)

1. **Deploy Backend to Render**:
   - Create a Web Service connected to this repository.
   - Use the included `Dockerfile` (or Python 3.12 environment with `uvicorn app.main:app --host 0.0.0.0 --port $PORT`).
   - Configure Environment Variables:
     - `CUSTODIA_CORS_ORIGINS`: `https://<your-vercel-app>.vercel.app` (or `*` for testing).
     - `DATABASE_URL` (optional): PostgreSQL connection string (e.g. Neon, Supabase) with automatic fallback to `/data/custodia.db` SQLite.
     - `ANTHROPIC_API_KEY` (optional): API key for model quote proposals and rewrites (graceful heuristic fallback if unset).
   - Healthcheck endpoint: `/api/ping` or `/api/health`.

2. **Deploy Frontend to Vercel**:
   - Import the repository into Vercel.
   - Set **Root Directory** to `frontend`.
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Add Environment Variable:
     - `VITE_API_BASE`: `https://<your-render-service>.onrender.com`

3. **Handling Free-Tier Cold Starts**:
   - Render's free tier spins down containers after 15 minutes of inactivity.
   - **Silent Warm-Up**: Custodia's frontend automatically fires a silent background ping (`GET /api/ping`) on page load.
   - **Cold-Start Waking Banner**: If the backend takes longer than 3 seconds to respond, an inline status notice informs the user that the server is waking, polling every 4 seconds.
   - **Offline Fallback**: If the server is sleeping, 16 pre-bundled illustrative scenarios load immediately from `examples.generated.json`.
   - **Keep-Warm Tip**: Set up a free 10-minute cron ping (e.g. via UptimeRobot or cron-job.org) targeting `https://<your-render-service>.onrender.com/api/ping`.

### Option B: Single-Service Docker (FastAPI serving built React SPA)

To run everything in a single self-contained container:
```bash
# Build the production image
docker build -t custodia .

# Run container (exposes port 8000)
docker run -p 8000:8000 -v custodia_data:/data custodia
```
FastAPI serves both the API endpoints (`/api/*`) and the built React frontend (`/*`) with client-side SPA fallback.

---

## Evaluation & Benchmark Suite

Custodia includes an automated evaluation suite testing 65 realistic and adversarial marketing claim pairs across 16 categories:

- **Run the evaluation**:
  ```bash
  python bench/run.py
  ```
- **Results**:
  - `dev` split (38 cases): 0 false approvals, 0 false rejections
  - `heldout` split (27 cases): 0 false approvals, 0 false rejections
  - Full details in [docs/BENCHMARK.md](file:///c:/A%20folder/Code%20Projects/ClaimFit-main/ClaimFit-main/docs/BENCHMARK.md) and [bench/RESULTS.md](file:///c:/A%20folder/Code%20Projects/ClaimFit-main/ClaimFit-main/bench/RESULTS.md).

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
