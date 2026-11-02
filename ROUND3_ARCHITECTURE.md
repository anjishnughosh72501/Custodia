# Custodia — Round 3 Complete Architecture & Security Specification

**Version:** 3.0.0-rc1  
**Target Branch:** `round3/custodia-complete-upgrade`  
**Base Repository:** https://github.com/anjishnughosh72501/Custodia  

---

## 1. System Architecture

Custodia is an evidence-first marketing claim verification platform engineered around a zero-trust model:
**Claims are guilty until proven supported by verifiable evidence.**

```
+-------------------------------------------------------------------------+
|                  Client Browser (React 19 + TypeScript)                |
|  - Multi-Document Dropzone (PDF, DOCX, XLSX, CSV, TXT)                  |
|  - Real-World Connectors UI (Crossref, OpenAlex, PubMed, NCT, FactCheck)|
|  - Evidence Confidence Map (7 Dimensions with strict penalty caps)      |
|  - Diff-style Claim Comparison & In-Place Rewrite Verification          |
|  - Audit History Timeline & Human Compliance Sign-Off Modal             |
+-------------------------------------------------------------------------+
                                    |
                            HTTP / Port 3000
                                    v
+-------------------------------------------------------------------------+
|                    Express Supervised Gateway (Node.js)                 |
|  - Single-Origin port 3000 (preserves HttpOnly SameSite=Lax cookies)   |
|  - Supervises Python FastAPI on 127.0.0.1:8001                         |
|  - Supervises Rust Document Gateway on 127.0.0.1:8002                  |
|  - Reverse-proxies /api/* with zero cookie cross-site loss             |
+-------------------------------------------------------------------------+
         |                                                 |
  Internal Local (8001)                             Internal Local (8002)
         v                                                 v
+----------------------------------+    +----------------------------------+
|    Python FastAPI Application    |    |  Custodia Secure Document Gateway|
|  - Session Auth & Account Sandbox|    |  (Rust 1.75+ / Axum / Tokio)     |
|  - Deterministic 7-Dim Engine    |    |  - Magic-Byte Signature Scan     |
|  - Multi-Source Parsers (5 Types)|<-->|  - Extension Mismatch Detection  |
|  - 5 External Connectors (APIs)  |    |  - SHA-256 Cryptographic Digest  |
|  - Optional Gemini Reasoning     |    |  - Anti-Decompression Zip Bomb   |
|  - Versioned SQLite Audit Store  |    |  - Path Traversal Sanitizer      |
+----------------------------------+    +----------------------------------+
```

---

## 2. Security Model & Custodia Secure Document Gateway

The Rust gateway (`gateway/`) sits as an isolated, memory-safe pre-parser validation layer on `127.0.0.1:8002` (private loopback, never exposed publicly).

### Implemented Protections:
1. **Magic-Byte Signature Verification**: Rejects files whose content signature does not match expected format headers:
   - PDF: `%PDF-` header inspection.
   - ZIP Containers (DOCX / XLSX): `PK\x03\x04` header check.
   - Plain Text / CSV: UTF-8 encoding verification and rejection of binary null bytes (`0x00`).
2. **Disguised Executable Rejection**: Immediately halts uploads starting with Linux ELF (`\x7fELF`), Windows PE/MZ (`MZ`), or executable scripts (`#!`).
3. **Extension vs. Content Mismatch Detection**: Traps spoofed files (e.g. an ELF executable or shell script renamed with a `.pdf` extension).
4. **Anti-Decompression Exhaustion (Zip Bombs)**:
   - Inspects the ZIP Central Directory header in memory *without extracting files to disk*.
   - Caps cumulative uncompressed payload to `50 MB`.
   - Caps total archive entries to `1,000`.
   - Flags and rejects any archive exhibiting a compression ratio $> 100:1$.
5. **Path Traversal & Filename Sanitization**:
   - Strips directory components (`../`, `..\`, absolute paths).
   - Eliminates non-printable ASCII and control codes.
   - Prevents Windows device reserved names (`CON`, `PRN`, `AUX`, `NUL`, `COM1-9`).
   - Clamps filename to 255 bytes max.
6. **Bounded Concurrency & Resource Limits**:
   - Uses a `tokio::sync::Semaphore` with 16 concurrent permits to prevent denial-of-service CPU/RAM starvation.
   - Enforces configurable upload size limits (default 10 MB per document).

*Note: Document gateway signature checking is a pre-parser structural defense; it is not a replacement for traditional kernel-level anti-malware sandboxes.*

---

## 3. Supported Document Formats & Provenance Tracking

Every extracted evidence chunk preserves five immutable provenance fields:
- `document_id`: Unique UUID of the parent document.
- `sha256`: Cryptographic SHA-256 hash of the uploaded document bytes.
- `filename`: Original upload filename.
- `file_type`: Format classification (`pdf`, `docx`, `xlsx`, `csv`, `txt`).
- `extracted_at`: ISO 8601 UTC timestamp.

### Format-Specific Provenance:
- **PDF**: Page-by-page extraction preserving 1-indexed `page_number`. Detects rasterized/scanned PDFs lacking text and throws `SCANNED_PDF_OCR_REQUIRED`.
- **DOCX**: Extracts document body paragraphs, preserving heading structure in `section_name` and 1-indexed `paragraph_index`.
- **XLSX**: Iterates over sheets, preserving `sheet_name` and cell coordinates (`cell_reference="Sheet1!R5"`).
- **CSV**: Parses delimited rows, preserving header column labels and `cell_reference="Row 12"`.
- **TXT**: Parses line-by-line and paragraph-by-paragraph with line coordinate tracking.

---

## 4. Real-World Evidence Connectors

Custodia connects to 5 public knowledge and clinical registries via modular, fault-tolerant connectors:

| Connector | Data Source | Primary Use Case | Resiliency |
| :--- | :--- | :--- | :--- |
| **Crossref** | `api.crossref.org` | DOIs, publication years, peer-reviewed journal papers | TTL Cache, Circuit Breaker, 5s Timeout |
| **OpenAlex** | `api.openalex.org` | Scholarly works, citation counts, institutional authors | TTL Cache, Circuit Breaker, 5s Timeout |
| **PubMed** | NCBI E-utilities | Medline/PubMed biomedical abstracts (PMIDs) | TTL Cache, Circuit Breaker, 5s Timeout |
| **ClinicalTrials.gov**| v2 REST API | Clinical trials (NCT IDs), phases, cohorts, endpoints | TTL Cache, Circuit Breaker, 5s Timeout |
| **Google Fact Check** | Fact Check Tools API | Third-party publisher ratings & fact-check records | TTL Cache, Circuit Breaker, 5s Timeout |

### Connector Fault Tolerance:
- **Exponential Backoff**: Jittered exponential retries on HTTP 429/503.
- **Circuit Breaker**: Trips to `OPEN` state after 3 consecutive failures, preventing cascading thread starvation.
- **Strict Fallback**: If an API is offline or returns an error, the verdict engine treats the external source as unavailable and **never treats an API failure as evidence supporting a claim**.

---

## 5. Google AI Studio & Gemini API Integration

- **Model Alias**: Configured for `gemini-3.8-flash` via `@google/genai` TypeScript and Python SDKs.
- **Zero-Key Determinism**: `GEMINI_API_KEY` remains strictly optional. When omitted or budget is exhausted, the application operates deterministically using the native rule-based extractor.
- **Deterministic Engine Primacy**: AI models assist with quote extraction, passage ranking, and candidate rewrites, but **never independently approve claims**. The deterministic 7-dimension Python engine (`app/rules/engine.py`) remains authoritative with mathematical invariant checks.

---

## 6. Deterministic 7-Dimension Verification Engine

Custodia evaluates every claim against evidence across seven dimensions:
1. **Metric**: What is being measured (e.g. response rate, latency, conversion).
2. **Value**: The numerical figure, direction of change, and statistical measure.
3. **Unit**: Percentage points, hours, dollars, percent, etc.
4. **Population**: Target group, sample size (e.g. 300 patients, enterprise customers).
5. **Time Window**: Duration or period (e.g. 24 weeks, Q3, annual).
6. **Conditions**: Pre-requisites or qualifiers (e.g. baseline HbA1c > 8.0%).
7. **Strength of Wording**: Causal claims ("causes", "proves") vs correlational/observational claims.

Evidence is strictly classified as **Supporting**, **Conflicting**, **Insufficient**, or **Missing**.

---

## 7. Versioned Audit History & Human Reviewer Sign-Off

Stored in durable SQLite (`reviews.db`):
- Tracks every automated run and subsequent revision.
- Supports human compliance decisions: `APPROVED`, `REJECTED`, `FLAGGED_FOR_LEGAL`, `REVISED_EVIDENCE`.
- **Account Isolation**: Cryptographically enforced via HMAC session tokens. Users can only read, revise, and sign off on their own documents.

---

## 8. Benchmark Suite & Methodology

- **Location**: `bench/cases.jsonl`
- **Total Cases**: 116 cases covering 17 categorized failure modes:
  - Baseline faithful claims
  - Causal leaps
  - Contradictory sources
  - Direction flips
  - Dropped conditions
  - Second-person promises
  - Statistical swaps (mean vs median)
  - Unit swaps (percent vs percentage points)
  - Time-window stretching
  - Population widening
  - Adversarial prompt injection attacks
- **Splits**: Dev (66 cases), Held-out (50 cases).
- **Execution Performance**: 116 cases evaluated in **~165 ms**.
- **Results**: **0 false approvals, 0 false rejections**.

---

## 9. Deployment Instructions

### Environment Variables
| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | Public Express server port | `3000` |
| `FASTAPI_PORT` | Internal Python backend port | `8001` |
| `GATEWAY_PORT` | Internal Rust gateway port | `8002` |
| `CUSTODIA_SECRET` | 32-byte secret for session signing | Auto-generated dev secret |
| `GEMINI_API_KEY` | Optional Google AI Studio API key | None (runs rule-based) |

### Building and Running
```bash
# 1. Build Rust Gateway
cd gateway && cargo build --release && cd ..

# 2. Build Frontend
npm run build

# 3. Start Full-Stack Server
npm start
```
