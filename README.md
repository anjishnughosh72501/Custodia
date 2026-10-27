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
- Retrospective observational findings are turned into future "guarantees".

Typical LLM-based checkers are vulnerable to prompt injection, hallucinations, and non-deterministic judgements.

### Architectural Principles ("Not a vibe check")
1. **Code decides, not the model**: The model is only used to propose verbatim quote candidates and semantic flags. Deterministic rule-based engines verify character positions against original source text and make all verdict decisions. Prompt injection or hallucinated output can never force an approval.
2. **Every finding has receipts**: All findings rest on verified character spans and exact quotes in the user's text.
3. **Unclear goes to human review**: If an extraction cannot be verified with certainty, the claim is withheld and flagged as `Needs human review`—never rubber-stamped.
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
   [Language Risk Analysis]
  (Absolutes, guarantees, superlatives, causal leaps)
             │
             ▼
   [Verdict Decision & Narrower Rewrite]
  (Supported / Contradicted / Needs human review)
```

---

## Tech Stack

- **Backend:** Python 3.12+, FastAPI, SQLite (persisting review IDs), Pydantic v2.
- **Frontend:** React 18, TypeScript, Vite 5, Plain CSS with design tokens (`--ivory`, `--paper`, `--ink`, `--ok`, `--bad`, `--warn`).
- **Typography:** Fraunces Variable (display serif) & Hanken Grotesk Variable (body sans).
- **Motion System:** View Transitions API, `IntersectionObserver` scroll reveal, Magnet buttons, Glare hover cards, accessible Count Up, and SVG thread drawing.
- **Testing:** `pytest` (backend unit & regression), `vitest` (frontend unit), `playwright` (responsive browser e2e).

---

## Local Development

### Prerequisites
- Python 3.10+
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

# Install dependencies
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
Open [http://localhost:8000](http://localhost:8000) to view the landing page, or [http://localhost:8000/check](http://localhost:8000/check) for the checker workspace.

---

## Testing

```bash
# Run backend tests
python -m pytest -q

# Run frontend unit tests (Vitest)
cd frontend && npm test -- --run && cd ..

# Run Playwright E2E browser tests (starts against running server)
python tests/e2e/test_ui.py
```

---

## API Reference

- `POST /api/reviews` — Submit `{ claim_text, evidence_text }` to run the 7-dimension comparison.
- `GET /api/reviews/{id}` — Retrieve a saved review by ID.
- `POST /api/reviews/{id}/rewrite` — Request a narrower evidence-based rewrite or verify user edits.
- `GET /api/health` — Check engine version, LLM configuration status, and character limits.
- `GET /api/examples` — List teaching scenarios.

---

## Known Limits

- **English text only** in the current engine release.
- **No external source fetching:** Custodia evaluates only the text provided in the workspace.
- **Single primary statistic:** Compares the primary metric per statement; ambiguous multi-statistic evidence is marked for human review.
- **Evidence fit score is not accuracy:** The score is an editorial summary of the seven comparisons, not an accuracy or source reliability measure; no accuracy figure is claimed.

---

## License

MIT License — Copyright (c) 2026 Anjishnu Ghosh. See [LICENSE](LICENSE) for details.
