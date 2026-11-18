# Security Architecture & Hardening Guide

## Threat Model & Defense-in-Depth

Custodia processes user-supplied digital media, unstructured guideline documents (PDFs, text, images), and enterprise marketing copy. To protect against malicious payloads, supply chain poisoning, privilege escalation, and compliance fraud, Custodia implements an end-to-end security architecture.

```
       [ Client Request ]
               │
               ▼
+──────────────────────────────+
│   Rust Security Gateway      │ ──▶ [Port 8002]
│  • Magic-byte verification   │     • Strips path traversal / null bytes
│  • MIME/extension mismatch   │     • Enforces 15MB file size limit
│  • SHA-256 hashing           │     • Decompresses & validates ZIP archives
│  • Bounded concurrency       │     • Rejects malformed / polyglot files
+──────────────────────────────+
               │ (Sanitized file + SHA-256)
               ▼
+──────────────────────────────+
│     FastAPI Application      │ ──▶ [Port 8001]
│  • RBAC & Session Auth       │     • Zero-Key Deterministic Preflight
│  • SQL Parameterization      │     • Immutable Audit Logging (SHA-256)
│  • Strict Human Approval     │     • Rate limiting & error masking
+──────────────────────────────+
```

---

## 1. Rust Security Gateway Hardening

The Rust Gateway (`gateway/`) sits at the boundary of the ingestion pipeline. All uploaded brand documents, guideline PDFs, and media creatives must be validated by Rust before Python parsers touch the bytes.

### A. Magic Byte Validation & Polyglot Defense
* Inspects binary headers using exact magic signatures rather than trusting the user-provided `Content-Type` header or file extension.
* Detects polyglot files (e.g., an executable or script hidden within a valid PDF header or image wrapper) and instantly rejects them with `HTTP 400 Bad Request`.

### B. MIME & Extension Mismatch Detection
* Validates that the file extension (`.pdf`, `.png`, `.jpg`, `.txt`, `.csv`) matches both the detected MIME type and the parsed byte structure.
* Mismatched uploads (e.g., `invoice.pdf.exe` or a shell script renamed to `.png`) are dropped immediately.

### C. ZIP Bomb & Decompression Protection
* Enforces strict decompression constraints:
  * Maximum decompressed size threshold (50MB).
  * Maximum compression ratio ceiling (10:1) to mitigate algorithmic zip bombs.
  * Maximum recursive archive depth (single-level only).
  * Traversal prevention: sanitizes all filenames inside archives, rejecting `../`, `..\\`, absolute paths, and null bytes (`\0`).

### D. Concurrency & Resource Bounding
* Implements bounded concurrency queues using Tokio asynchronous tasks to protect against Denial of Service (DoS) attacks.
* Imposes streaming request timeouts (30 seconds per upload).
* Guarantees deterministic temporary file deletion using Rust RAII patterns, ensuring disk storage is never exhausted by aborted uploads.

---

## 2. Access Control & Role-Based Security (RBAC)

Custodia enforces four distinct enterprise roles within each Organization:

| Role | Permissions |
|---|---|
| **VIEWER** | Read-only access to Brand DNA, guidelines, public analytics, and published campaigns. |
| **CREATOR** | Can upload drafts, run preflight analysis, apply automated corrections, and submit reviews for approval. Cannot approve their own reviews. |
| **REVIEWER** | Can review queued content, inspect findings, approve content, reject content, or request revisions. |
| **ADMIN** | Full organization control: manage team memberships, edit brand rules, set approved facts, upload core guidelines, and grant exemptions. |

### Separation of Duties Invariant
A `CREATOR` cannot approve or publish their own content. The system enforces strict separation of duties: `can_approve_review()` strictly verifies that the acting user has `REVIEWER` or `ADMIN` privileges.

---

## 3. Storage Security & Injection Immunity

* **SQL Injection Immunity**: All database queries across both `SqliteStore` and `PostgresStore` utilize parameterized queries with bound placeholders (`?` or `%s`). Raw SQL string concatenation is strictly prohibited.
* **XSS Sanitization**: User inputs, review comments, and brand guidelines are sanitized before rendering in the React frontend.
* **CORS & CSRF**: Backend endpoints enforce explicit CORS origin whitelisting.

---

## 4. Immutable Cryptographic Audit Trail

Every state-altering event in Custodia is recorded in the `audit_events` ledger:
* **Recorded Events**: `PREFLIGHT_ANALYZED`, `FINDING_CORRECTED`, `REVIEW_SUBMITTED`, `REVIEW_APPROVED`, `REVIEW_REJECTED`, `RULE_CREATED`, `RULE_TOGGLED`, `FACT_CREATED`.
* **Payload Hashing**: Each event computes and stores a cryptographic SHA-256 fingerprint of the before/after state diff, actor ID, timestamp, and target resource ID.
* **Tamper-Evident History**: Provides full traceability for compliance audits, SOC 2 verification, and brand legal reviews.
