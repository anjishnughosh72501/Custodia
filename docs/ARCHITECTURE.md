# Inkloom AI Brand Governance Platform Architecture

## System Architecture Overview

Custodia by Inkloom AI is an enterprise intelligent brand-governance and content-intelligence platform. It operates across multiple secure tiers to ingest guidelines, extract and version rules, preflight marketing collateral in real time, suggest deterministic fact-grounded rewrites, and enforce human sign-off via strict role-based access control (RBAC).

```
┌────────────────────────────────────────────────────────────────────────┐
│                        RUST SECURITY GATEWAY (8002)                   │
│ - Magic-byte signature verification (PDF, DOCX, XLSX, PNG, SVG)       │
│ - MIME / extension spoofing detection & SHA-256 fingerprinting         │
│ - Decompression bomb limits (ZIP depth, ratio, max uncompressed size)   │
│ - Path traversal sanitization & stream-based boundary defense          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Validated Streams
┌───────────────────────────────────▼────────────────────────────────────┐
│                  FASTAPI BRAND GOVERNANCE CORE (8001)                  │
│                                                                        │
│ ┌──────────────────────────┐    ┌──────────────────────────────────┐   │
│ │     Brand DNA Engine     │    │     Brand Preflight Engine       │   │
│ │ - Guideline Parser (PDF) │    │ - Deterministic Policy Checks    │   │
│ │ - Rule Extraction Regex  │    │ - Empirical Claim Ceilings       │   │
│ │ - Approved Facts Store   │    │ - Pricing Variance Verifier      │   │
│ │ - Rule Versioning (v1,v2)│    │ - Invariant Capping (0-100)      │   │
│ └──────────────────────────┘    └──────────────────────────────────┘   │
│ ┌──────────────────────────┐    ┌──────────────────────────────────┐   │
│ │  Visual Brand Intel      │    │    RBAC & Approval Workflow      │   │
│ │ - Euclidean Color Dist   │    │ - Creator Draft Submissions      │   │
│ │ - Palette Compliance %   │    │ - Reviewer / Admin Gatekeepers   │   │
│ │ - Logo Placement & Contrast│  │ - Conditional Approvals & Notes  │   │
│ └──────────────────────────┘    └──────────────────────────────────┘   │
│ ┌──────────────────────────┐    ┌──────────────────────────────────┐   │
│ │ Governance Drift Telemetry│   │  Cryptographic Audit Journal     │   │
│ │ - Violations by Category │    │ - Immutable Event Ledger (evt_*) │   │
│ │ - Top Breached Rules     │    │ - SQLite / Neon Postgres Storage │   │
│ └──────────────────────────┘    └──────────────────────────────────┘   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ JSON API & Static HTML/CSS/JS
┌───────────────────────────────────▼────────────────────────────────────┐
│                    REACT + TYPESCRIPT WORKSPACE (3000)                 │
│ - Brand DNA Manager (Rules toggles, approved facts, assets)            │
│ - Content Studio (Real-time preflight checking & inline diff)          │
│ - Review Queue (Collaborative human sign-off workspace)                │
│ - Drift Analytics Dashboard (Telemetry, compliance trends)             │
│ - Phase 17 Interactive Showcase Runner                                 │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. Rust Security Gateway
Positioned at the front edge of all document and asset upload pipelines. The gateway validates raw byte signatures before Python parses any binary structure:
- **PDF**: Enforces `%PDF-` magic header and structured trailer tags.
- **DOCX / XLSX**: Verifies PK ZIP signatures, directory structures, and prevents decompression zip bombs (rejects decompression ratios > 100:1 or uncompressed sizes > 50 MB).
- **Images (PNG, JPEG, SVG)**: Validates binary headers and parses dimensions safely.

### 2. Brand DNA Engine (`app/brand/`)
- **Guideline Ingestion**: Uploads PDF, DOCX, or text guidelines and extracts rules through syntactic pattern matchers and contextual heuristics.
- **Rules Versioning**: Every rule update records a `BrandRuleVersion` snapshot documenting timestamp, actor ID, and change summary.
- **Approved Enterprise Facts**: Stores canonical ground truth for commercial pricing (e.g. `₹999`), verified clinical/benchmark trials (e.g. `35%`), and cohort qualifications.

### 3. Brand Preflight Engine (`app/preflight/`)
- Evaluates candidate marketing copy against active rules, pricing guidelines, and claim boundaries.
- **Scoring Invariants**:
  - Base score: `100`.
  - STRICT violation: `-25` points; automatically capped at `45` max (mandating `CRITICAL` or `HIGH` risk tier).
  - Multiple STRICT violations or ungrounded guarantees drive score to `0-30`.
  - Low-risk content with 0 findings scores `100` (`LOW` risk).
- **Explainable Findings**: Returns exact highlighted text, reason for violation, suggested replacement, and citation to official guideline/benchmark source.
- **Deterministic Rewrites**: Generates a corrected copy by applying sorted non-overlapping string replacements.

### 4. Visual Brand Intelligence (`app/visual/`)
- Analyzes hex palettes extracted from creative imagery.
- Calculates normalized Euclidean RGB color distance:
  $$\Delta C = \frac{\sqrt{(\Delta R)^2 + (\Delta G)^2 + (\Delta B)^2}}{\sqrt{3} \times 255}$$
- Measures palette compliance % against authorized brand colors (`#14213D`, `#00F0FF`, `#2F7F79`, `#FBF8F1`).

### 5. RBAC Approval Workflow (`app/workflow/`)
- Multi-tier role permissions: `CREATOR`, `REVIEWER`, `BRAND_MANAGER`, `ADMIN`.
- Automated AI preflight produces `NEEDS_REVISION` or `PENDING_REVIEW` states.
- AI never self-approves content; formal sign-off requires authorized human reviewer credentials (`REVIEWER` or `ADMIN`).
- Supports `APPROVED`, `APPROVED_WITH_CONDITIONS`, and `REJECTED`.

### 6. Audit & Drift Analytics (`app/analytics/`)
- Measures organizational compliance drift across time.
- Categorizes infractions across 7 dimensions: `FACTS`, `CLAIMS`, `LEGAL`, `TERMINOLOGY`, `MESSAGING`, `VISUAL`, `ACCESSIBILITY`.
- Every preflight check, rule edit, and approval decision generates an immutable cryptographic audit record (`evt_<hash>`).
