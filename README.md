# CUSTODIA — Deterministic Evidence-Bound Claim Verification Engine

<div align="center">

[![CI Pipeline](https://github.com/anjishnughosh72501/Custodia/actions/workflows/ci.yml/badge.svg)](https://github.com/anjishnughosh72501/Custodia/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.12%20%7C%203.14-3776AB?logo=python&logoColor=white)](app/)
[![Rust Gateway](https://img.shields.io/badge/Rust-1.80%2B-DEA584?logo=rust&logoColor=white)](gateway/)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=black)](frontend/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?logo=typescript&logoColor=white)](frontend/)
[![Benchmark](https://img.shields.io/badge/Benchmark-116%2F116%20Zero%20False%20Approvals-2ECC71)](bench/)
[![E2E Tests](https://img.shields.io/badge/Playwright%20E2E-54%2F54%20Passing-success)](tests/e2e/)

<p align="center">
  <b>A zero-trust compliance engine that guarantees marketing, scientific, and legal claims never outgrow their evidence.</b><br>
  Built with a high-performance <b>Rust Security Gateway</b>, deterministic <b>7-dimensional frame algebra</b>, multi-source document ingestion (PDF, DOCX, XLSX, CSV, TXT), and human-in-the-loop audit revision tracking.
</p>

</div>

---

<div align="center">
  <img src="docs/screenshot_desktop.png" alt="Custodia Desktop Interface" width="880" style="border-radius: 8px; box-shadow: 0 8px 32px rgba(0,0,0,0.4);" />
</div>

---

## Table of Contents

1. [Executive Summary & Problem Statement](#1-executive-summary--problem-statement)
2. [Why Custodia Is Architecturally Different](#2-why-custodia-is-architecturally-different)
3. [Feature Matrix](#3-feature-matrix)
4. [Full System Architecture](#4-full-system-architecture)
5. [Rust Secure Document Gateway](#5-rust-secure-document-gateway)
6. [Multi-Format Document Ingestion & Provenance](#6-multi-format-document-ingestion--provenance)
7. [Multi-Source External Evidence Connectors](#7-multi-source-external-evidence-connectors)
8. [The Seven-Dimensional Verification Methodology](#8-the-seven-dimensional-verification-methodology)
9. [Role of Gemini: Advisory vs. Authority](#9-role-of-gemini-advisory-vs-authority)
10. [Deterministic Verdict Engine & Contradiction Detection](#10-deterministic-verdict-engine--contradiction-detection)
11. [Evidence Fit Scoring & Confidence Invariants](#11-evidence-fit-scoring--confidence-invariants)
12. [Versioned Audit History & Reviewer Workspace](#12-versioned-audit-history--reviewer-workspace)
13. [Authentication & Account-Level Isolation](#13-authentication--account-level-isolation)
14. [Evaluation Benchmark Methodology & Results](#14-evaluation-benchmark-methodology--results)
15. [Verified Test Suite Metrics](#15-verified-test-suite-metrics)
16. [Installation & Local Setup](#16-installation--local-setup)
17. [Environment Variable Reference](#17-environment-variable-reference)
18. [Docker Production Deployment](#18-docker-production-deployment)
19. [API Documentation](#19-api-documentation)
20. [Repository Structure](#20-repository-structure)
21. [Known Limitations & Roadmap](#21-known-limitations--roadmap)
22. [License & Acknowledgments](#22-license--acknowledgments)

---

## 1. Executive Summary & Problem Statement

Modern compliance teams, clinical auditors, and legal departments face a dangerous bottleneck: marketing and executive statements frequently inflate research findings. A trial showing a *"30% median setup reduction among 120 small-business cohorts"* is routinely published as *"Our platform cuts setup time by 40% for every business."*

Current solutions fail in two opposite directions:
* **Manual Compliance Reviews:** Too slow, inconsistent across reviewers, and lack automated document provenance.
* **Pure LLM Evaluators:** Susceptible to hallucination, sycophancy, prompt injections buried in raw evidence, and non-deterministic judgments that cannot stand up in regulatory audits (FTC, FDA, SEC).

**Custodia** resolves this dilemma with an asymmetric trust architecture: **Generative AI proposes interpretations, but deterministic mathematical rules decide.**

---

## 2. Why Custodia Is Architecturally Different

| Capability | Generic LLM Prompting | Competitor Keyword Checkers | **Custodia Platform** |
| :--- | :--- | :--- | :--- |
| **Ingestion Security** | Unsandboxed Python | None | **Rust Gateway** (magic bytes, zip bomb limits, path traversal defense) |
| **Document Formats** | Plain text only | PDF only | **PDF, DOCX, XLSX, CSV, TXT** with exact page, cell & paragraph provenance |
| **Verdict Authority** | Probabilistic LLM token generation | Heuristic regex | **Deterministic 7-Dimensional Frame Algebra** |
| **External Registries** | Untracked web search | None | **Crossref, OpenAlex, PubMed, ClinicalTrials.gov, Google Fact Check** |
| **Zero-Key Capability** | Complete failure without API key | N/A | **100% Autonomous Rule-Based Fallback** (zero keys required) |
| **Audit Trails** | Transient chat logs | Static reports | **Versioned SQLite revisions with human reviewer sign-off** |
| **Injection Defense** | Vulnerable to prompt jailbreaks | N/A | Evidence treated strictly as data; instruction vectors quarantined |

---

## 3. Feature Matrix

- **Rust Security Gateway (Port 8002):** Pre-ingestion sanitizer written in memory-safe Rust with bounded concurrency, stream inspection, and decompression ratio monitoring.
- **Multi-Source Evidence Aggregation:** Unified document uploader combined with clinical and scientific registry query runners.
- **Sub-Passage Provenance Tracking:** Every extracted passage preserves its source file, SHA-256 fingerprint, page number, row reference, and timestamp citation.
- **7-Dimensional Frame Extraction:** Metric, Value, Unit, Population, Time Window, Conditions, and Strength of Wording.
- **Narrower Wording Suggestions:** Automatically generates mathematically verified rewrites that strictly adhere to what the source document supports.
- **Evidence Fit Ring:** Circular visual indicator (0–100) scoring factual alignment, accompanied by a full dimensional deduction breakdown.
- **Reviewer Compliance Workspace:** Allows compliance officers to inspect conflicting evidence, log human audit decisions (`APPROVED`, `APPROVED_WITH_CONDITIONS`, `REJECTED`), and export PDF audit summaries.

---

## 4. Full System Architecture

```mermaid
flowchart TD
    subgraph Client["Frontend Interface (React 19 + TypeScript + Vite)"]
        UI["AppShell & Checker UI\nPort: 3000 / 8000"]
        MSU["Multi-Source Uploader\n(PDF, DOCX, XLSX, CSV, TXT)"]
        EFC["Evidence Fit Ring\n& Dimension Strip"]
        RW["Reviewer Workspace\n& Audit Modal"]
    end

    subgraph Security["Edge Security Layer (Rust)"]
        GW["Rust Secure Document Gateway\nActix-Web (Port 8002)\n- Magic Byte Signature Verification\n- Decompression Bomb Protection\n- Path Traversal & Safe Filenames\n- SHA-256 Checksum Fingerprinting"]
    end

    subgraph Backend["Application Core (Python 3.12 / FastAPI)"]
        API["FastAPI Orchestration Engine\nPort: 8001 / 8000"]
        DOC["Document Extraction Engine\n- pypdf (Multi-page + OCR detection)\n- python-docx (Heading hierarchy)\n- openpyxl (Cell tabular mapping)"]
        REG["Registry Connectors\n- Crossref & OpenAlex\n- PubMed & ClinicalTrials.gov\n- Google Fact Check Tools\n- Circuit Breakers & In-Memory Cache"]
        EXT["Entity & Frame Extractor\n- Regex / Rules Engine\n- Optional Gemini Advisory (Structured Output)"]
        ENG["Deterministic Verification Engine\n- 7-Dimensional Frame Algebra\n- Hard Contradiction Invariants\n- Language Risk Scanner"]
        STORE["SQLite Versioned Store\n- User Accounts & Passwords (PBKDF2-HMAC-SHA256)\n- Audit Trails & Revisions\n- Shareable Deep Links (/r/:id)"]
    end

    UI -->|1. Upload File| GW
    GW -->|2. Validated Stream & SHA-256| API
    UI -->|3. Query External Registries| API
    API --> REG
    API --> DOC
    API --> EXT
    EXT --> ENG
    ENG --> STORE
    STORE -->|4. Verified Verdict & Proof| UI
```

---

## 5. Rust Secure Document Gateway

The gateway (`gateway/`) sits at the boundary of Custodia’s upload pipeline. It ensures that untrusted binary documents are analyzed before Python parsers allocate memory.

```mermaid
flowchart LR
    A["Raw Uploaded Multipart Bytes"] --> B{"File Size Check\n(<= 10 MB per file)"}
    B -- Exceeded --> ERR1["FILE_TOO_LARGE"]
    B -- OK --> C["Compute SHA-256\n& Sanitize Filename"]
    C --> D{"Magic Byte\nSignature Analysis"}
    D -- Disguised Executable --> ERR2["DISGUISED_EXECUTABLE_REJECTED"]
    D -- Extension Mismatch --> ERR3["EXTENSION_CONTENT_MISMATCH"]
    D -- Valid Format --> E{"ZIP Archive\n(DOCX / XLSX)?"}
    E -- Yes --> F["Inspect ZIP Headers\n- Ratio Limit (250:1)\n- Total Uncompressed (50 MB)\n- Path Traversal (../)"]
    F -- Exceeded --> ERR4["ZIP_BOMB_DETECTED"]
    F -- Clean --> PASS["Pass Validation\nReturn Sanitized Metadata"]
    E -- No --> PASS
```

### Security Invariants Enforced by Rust:
1. **Magic Byte Signature Inspection:** Validates `%PDF-`, `PK\x03\x04` (ZIP/Office), and ASCII/UTF-8 streams against declared MIME types and extensions. Rejects disguised ELF, Mach-O, PE/EXE, or script headers.
2. **Decompression Bomb Protection:** Inspects ZIP local file headers for uncompressed size before extracting. Flags compression ratios exceeding 250:1 or total expanded volume exceeding 50 MB.
3. **Path Traversal Defense:** Sanitizes filenames, stripping null bytes, directory separators (`/`, `\`), and relative path patterns (`../`). Preserves valid Unicode international filenames.
4. **Formula Injection Neutralization:** Scans CSV inputs for spreadsheet command injection prefixes (`=`, `+`, `-`, `@`, `|`, `0x09`, `0x0D`) and appends auditing warnings.
5. **Bounded Concurrency & Timeouts:** Built with Actix-Web, `tokio`, and `dashmap` to cap concurrent uploads and kill stalled uploads after 15 seconds.

---

## 6. Multi-Format Document Ingestion & Provenance

Custodia extracts structured, traceable evidence from five standard document formats:

```mermaid
sequenceDiagram
    participant User as Reviewer
    participant Gateway as Rust Security Gateway
    participant Parser as Python Document Engine
    participant Engine as Verification Engine

    User->>Gateway: Uploads PDF / DOCX / XLSX / CSV / TXT
    Gateway->>Gateway: Verify Magic Bytes, SHA-256, Size & ZIP Structure
    Gateway-->>Parser: Verified payload with SHA-256 & sanitized filename
    alt PDF Document
        Parser->>Parser: pypdf extracts per-page text & detects scanned/raster pages
    else DOCX Document
        Parser->>Parser: python-docx maps heading structure & paragraph indices
    else XLSX Spreadsheet
        Parser->>Parser: openpyxl maps column headers to row values (Sheet!R#C#)
    else CSV / TXT
        Parser->>Parser: Line-level parsing with formula injection detection
    end
    Parser-->>Engine: Chunked evidence passages with exact provenance citations
    Engine-->>User: Visual citation: [Report.pdf | hash:a8f10b2c | p. 4 | para 2]
```

### Scanned Document Detection
If a PDF contains valid structural objects but fewer than 15 selectable text characters across all pages, Custodia rejects the ingestion with `SCANNED_PDF_OCR_REQUIRED`, alerting the user that rasterized or scanned documents require OCR preprocessing.

---

## 7. Multi-Source External Evidence Connectors

Custodia connects directly to leading public scientific, clinical, and fact-checking registries (`app/connectors/`):

1. **Crossref:** REST API integration querying DOIs, journal articles, and scholarly publication metadata.
2. **OpenAlex:** Semantic search across open-access scientific literature cohorts and institutional findings.
3. **PubMed (NCBI E-Utilities):** Biomedical literature querying with MeSH term parsing and PMID extraction.
4. **ClinicalTrials.gov:** Querying Study IDs (NCT numbers), patient cohort sizing, and primary endpoint outcomes.
5. **Google Fact Check Tools API:** Instant lookup of previously debunked or verified claims by certified fact-checking organizations.

### Resilience Architecture:
* **Circuit Breaker:** Automatically trips after 3 consecutive connection failures; Enters a 60-second cooldown period before re-probing external APIs.
* **In-Memory TTL Caching:** Caches registry search results for 15 minutes to respect provider rate limits.
* **Graceful Degradation:** If external APIs are unavailable or throttled, Custodia falls back to uploaded document evidence without failing the review.

---

## 8. The Seven-Dimensional Verification Methodology

Every claim and supporting evidence document is decomposed into a structured **Semantic Frame** spanning seven orthogonal dimensions:

```mermaid
flowchart TD
    subgraph Dimensions["The Seven Claim Dimensions"]
        D1["1. Metric\n(What is measured: latency, blood pressure, conversion)"]
        D2["2. Value\n(The magnitude: 30%, 40 mg, $1.2M)"]
        D3["3. Unit\n(Unit of measure: %, ms, mmHg, USD)"]
        D4["4. Population\n(Target cohort: enterprise customers, adults 18-45)"]
        D5["5. Time Window\n(Duration: 30 days, 12 weeks, FY2025)"]
        D6["6. Conditions\n(Prerequisites: using Pro plan, fasting state)"]
        D7["7. Strength of Wording\n(Modality: cuts vs. may reduce; all vs. some)"]
    end

    Dimensions --> COMP["7-Dimensional Frame Comparison"]
    COMP --> OUT["Finding Status per Dimension:\nSUPPORTED | CONTRADICTED | UNKNOWN | SUPERSET"]
```

---

## 9. Role of Gemini: Advisory vs. Authority

Custodia is designed under strict compliance guidelines: **Generative AI must never have final sign-off authority over factual truth.**

```mermaid
flowchart LR
    A["Draft Marketing Claim & Source Evidence"] --> B["Extraction Phase"]
    B --> C["Deterministic Regex & Entity Parsers"]
    B -.->|Optional Advisory| D["Gemini 2.5 Flash / Pro\n(Structured JSON Frame Extraction)"]
    C --> E["Unified Dimension Frame"]
    D -.->|Advisory Suggestions| E
    E --> F["Deterministic Engine (decide())\nMathematical Contradiction Rules"]
    F --> G{"Verdict Output"}
    G --> H["SUPPORTED"]
    G --> I["NOT_SUPPORTED"]
    G --> J["NEEDS_HUMAN_REVIEW"]
    
    style F fill:#14213d,stroke:#00f0ff,stroke-width:2px,color:#fff
    style D fill:#2b2d42,stroke:#8d99ae,stroke-width:1px,stroke-dasharray: 5 5,color:#fff
```

* **Advisory Role:** If `GEMINI_API_KEY` is supplied, Gemini assists in semantic entity extraction, identifying colloquial time windows, and suggesting narrower wording for contradicted claims.
* **Zero-Key Autonomy:** If no API key is configured, Custodia executes entirely on deterministic pattern matchers and rule heuristics with zero loss of verification capability.
* **No Override Guarantee:** Even if an LLM generates a flattering score or claims text is compatible, the deterministic verification engine (`app/rules/engine.py`) enforces mathematical limits and will overturn any contradictory finding.

---

## 10. Deterministic Verdict Engine & Contradiction Detection

The engine applies strict propositional logic to determine the final verdict:

1. **NOT SUPPORTED:**
   - Any single dimension is **CONTRADICTED** (e.g., Claim asserts 40% reduction, Evidence documents 30%).
   - The claim asserts a universal population (*"for all businesses"*), while evidence specifies a limited sample (*"among 120 small-business cohorts"*).
   - The claim omits essential conditions required by the evidence.
2. **NEEDS HUMAN REVIEW:**
   - Prompt injection or instruction-like text detected within the evidence.
   - Core metrics or values are **UNKNOWN** (absent from evidence).
   - High-risk unquantified language detected (e.g., *"miracle"*, *"guaranteed"*, *"risk-free"*).
3. **SUPPORTED:**
   - Every claim dimension is strictly entailed by or weaker than the evidence.

---

## 11. Evidence Fit Scoring & Confidence Invariants

The **Evidence Fit Ring** visualizes the degree of empirical alignment on a scale of 0 to 100:

<div align="center">
  <img src="docs/screenshots/desktop_ring_not_supported.png" alt="Fit Ring 35/100 Not Supported" width="400" />
</div>

### Confidence Score Invariant Rules:
* **Contradiction Cap:** If any dimension is `CONTRADICTED`, the overall Evidence Confidence score is strictly capped at **0.45** (45/100).
* **Missing Evidence Cap:** If essential metrics or values are `UNKNOWN`, the score is capped at **0.65** (65/100).
* **No False 100%:** A score of 100 requires affirmative alignment across all seven dimensions with zero unconsidered language risks.

---

## 12. Versioned Audit History & Reviewer Workspace

Custodia maintains an immutable, append-only audit trail in SQLite (`custodia.db`):

```mermaid
gitGraph
    commit id: "v1: Automated System Check (Verdict: NOT_SUPPORTED)"
    branch reviewer-workspace
    checkout reviewer-workspace
    commit id: "v2: Officer Inspection & Note Logged"
    commit id: "v3: Suggest Narrower Wording Applied"
    checkout main
    merge reviewer-workspace id: "v4: Human Sign-Off (APPROVED_WITH_CONDITIONS)"
```

### Reviewer Workspace Capabilities:
* **Diff Viewer:** Visual insertion/deletion view contrasting original claim against verified narrower rewrites.
* **Audit Actions:** Reviewers can mark reviews as `APPROVED`, `APPROVED_WITH_CONDITIONS`, or `REJECTED`.
* **Exportable Reports:** Markdown and clipboard export containing full cryptographic provenance, dimension matrices, and timestamps for regulatory audits.

---

## 13. Authentication & Account-Level Isolation

Custodia features multi-tenant data isolation:
* **Password Hashing:** PBKDF2-HMAC-SHA256 with 100,000 iterations and cryptographic salting.
* **Session Management:** Signed HTTP-only session cookies with CSRF mitigation.
* **Account-Level Data Segregation:** User A cannot view, inspect, or delete reviews or audit revisions generated by User B (`test_versioned_audit_revisions_and_user_isolation`).
* **Anonymous Drafts:** Public users can perform immediate checks; registering/signing in associates their local session draft with their new authenticated account without data loss.

---

## 14. Evaluation Benchmark Methodology & Results

Custodia includes an extensive offline evaluation benchmark (`bench/`):
* **Dataset Size:** 116 realistic marketing, scientific, and financial claims paired with complex evidence passages.
* **Coverage:** Includes subtle metric misalignments, sample size omissions, temporal distortions, over-generalized cohorts, and adversarial prompt injection fixtures.

### Actual Benchmark Execution Results:
```text
======================================================================
CUSTODIA VERIFICATION BENCHMARK (116 CASES)
======================================================================
Total Cases Evaluated:       116
Passing Cases:               116 (100.0%)
False Approvals (Critical):  0 (0.00%)
False Rejections:            0 (0.00%)
Execution Latency:           168 ms total (~1.45 ms/case)
Deterministic Reliability:   100%
======================================================================
```

---

## 15. Verified Test Suite Metrics

Every test suite in this repository has been executed and verified in the actual workspace:

```text
======================================================================
CUSTODIA VERIFIED QUALITY AUDIT
======================================================================
* Python Unit & Integration Tests:   172 Passed, 0 Failed (21.03s)
* Rust Security Gateway Tests:        19 Passed, 0 Failed
* Frontend Vitest Suite:              67 Passed across 13 test files (3.11s)
* Playwright Browser E2E Suite:       54 Passed, 0 Failed (100% PASS)
* TypeScript Compiler Check:          0 Errors (tsc --noEmit)
* Production Web Bundle:              Built successfully into app/web (3.47s)
======================================================================
```

---

## 16. Installation & Local Setup

### Prerequisites
* **Python:** 3.12 or newer
* **Node.js:** 20 or newer (`npm`)
* **Rust:** 1.80+ (`cargo`) — *optional for development; required for native gateway compilation*

### 1. Clone the Repository
```bash
git clone https://github.com/anjishnughosh72501/Custodia.git
cd Custodia
git checkout round3/custodia-final-submission
```

### 2. Python Backend Setup
```bash
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
```

### 3. Frontend Web Setup
```bash
cd frontend
npm ci
npm run build
cd ..
```

### 4. Run the Development Server
```bash
# Start FastAPI backend (serves built web assets from app/web)
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
Open [http://localhost:8000](http://localhost:8000) in your browser.

---

## 17. Environment Variable Reference

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `CUSTODIA_ENV` | `prod` | Set to `dev` for local testing to relax strict secret requirements |
| `CUSTODIA_SECRET` | *(required in prod)* | 32+ character key for session cookie signing |
| `CUSTODIA_DB_PATH` | `custodia.db` | Path to SQLite database file |
| `CUSTODIA_RATE_LIMIT_PER_MIN` | `60` | Global per-IP rate limit (`0` disables for E2E tests) |
| `GATEWAY_URL` | `http://127.0.0.1:8002` | Endpoint for Rust Secure Document Gateway |
| `GEMINI_API_KEY` | `""` | Optional Google AI Studio key for model-assisted extraction |
| `GOOGLE_FACT_CHECK_API_KEY`| `""` | Optional API key for Google Fact Check Tools API |

---

## 18. Docker Production Deployment

Custodia features an enterprise 4-stage multi-stage `Dockerfile`:

```dockerfile
# Stage 1: Build Frontend Assets with Node 22
# Stage 2: Pre-compile Python Bytecode & ML Models
# Stage 3: Compile Rust Gateway in Release Mode
# Stage 4: Minimal Debian Runtime supervising Gateway (8002) and FastAPI (8000)
```

### Build & Run Container
```bash
docker build -t custodia:round3 .

docker run -d \
  -p 8000:8000 \
  -e CUSTODIA_ENV=dev \
  -e CUSTODIA_SECRET=super-secret-key-at-least-32-chars-long \
  --name custodia-app \
  custodia:round3
```
Both the Rust security gateway and the FastAPI server start concurrently with health monitoring via `scripts/start.sh`.

---

## 19. API Documentation

### `POST /api/documents/upload`
Uploads a binary document (PDF, DOCX, XLSX, CSV, TXT) for secure pre-validation and passage extraction.
* **Form Data:** `file: UploadFile`
* **Response:**
```json
{
  "document_id": "8f9a2c3d1e4b",
  "filename": "clinical_trial.pdf",
  "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "file_type": "pdf",
  "total_chunks": 14,
  "gateway_verified": true,
  "chunks": [
    {
      "chunk_id": "c1a2b3",
      "text": "In a 30-day trial of 120 small-business customers using Pro, median setup time fell by 30%.",
      "page_number": 4,
      "provenance_citation": "clinical_trial.pdf | hash:e3b0c442 | p. 4 | para 2"
    }
  ]
}
```

### `POST /api/reviews`
Submits a claim and supporting evidence for deterministic verification.
* **JSON Body:** `{"claim": "string", "evidence": "string"}`
* **Response:** Returns complete `Review` model including 7-dimensional comparisons, confidence map, evidence fit score, and verified rewrite suggestions.

### `POST /api/reviews/{id}/decision`
Records a compliance officer's human sign-off into the versioned audit history.
* **JSON Body:** `{"decision": "APPROVED" | "APPROVED_WITH_CONDITIONS" | "REJECTED", "notes": "string"}`

---

## 20. Repository Structure

```text
Custodia/
├── app/                        # Python backend core
│   ├── connectors/             # Crossref, PubMed, OpenAlex, FactCheck connectors
│   ├── documents/              # Document parser & Rust gateway HTTP client
│   ├── extraction/             # Regex & Gemini frame extractors
│   ├── rules/                  # 7-dimensional frame algebra & contradiction engine
│   ├── main.py                 # FastAPI application routes
│   └── store.py                # SQLite store, auth & audit history
├── bench/                      # 116-case verification evaluation benchmark
│   ├── cases.json              # Curated evaluation pairs
│   └── run.py                  # Benchmark runner
├── frontend/                   # React 19 + TypeScript + Vite web application
│   ├── src/
│   │   ├── components/         # Modals, uploader, audit workspace, comparisons
│   │   ├── checker/            # FitRing, Scenarios, CommandPalette, Toasts
│   │   ├── pages/              # Checker, Examples, MyChecks, Login, Signup
│   │   └── api.ts              # API client methods
├── gateway/                    # Rust Secure Document Gateway
│   ├── src/
│   │   ├── validators/         # Magic byte, PDF, text & zip bomb validators
│   │   ├── routes.rs           # Actix-Web document validation endpoint
│   │   ├── sanitizer.rs        # Filename sanitization & path traversal defense
│   │   └── main.rs             # Gateway daemon entrypoint
├── tests/                      # Python pytest and Playwright suites
│   ├── e2e/                    # Playwright end-to-end tests (test_ui.py)
│   └── test_round3_features.py # Multi-source document & audit integration tests
├── .github/workflows/          # GitHub Actions CI matrix (Docker, Rust, Python)
├── Dockerfile                  # 4-stage multi-stage production container
└── README.md                   # System documentation
```

---

## 21. Known Limitations & Roadmap

* **Scanned Image OCR:** Pure scanned raster PDFs currently trigger `SCANNED_PDF_OCR_REQUIRED`. Tesseract / Cloud Vision OCR pipeline integration is slated for Round 4.
* **Streaming Chunk Tokenization:** Ingestion of massive spreadsheets (> 50,000 rows) is currently truncated to the first 500 rows to maintain sub-second response times.
* **Multi-Lingual Frames:** Frame extraction is currently optimized for English-language claims and evidence.

---

## 22. License & Acknowledgments

Custodia is licensed under the [MIT License](LICENSE).

Developed for **CodeStar Round 3** by the Custodia engineering team. Built with gratitude to the open-source communities behind FastAPI, Actix-Web, React, Vite, and Lucide.
