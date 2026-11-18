# INKLOOM COMPLETE TRANSFORMATION PLAN
## Transforming Custodia into an Intelligent Brand Governance & Content Intelligence Platform

**Date:** November 2026  
**Target Event:** Inkloom AI Hackathon  
**Branch:** `feature/inkloom-brand-governance-transformation`  
**Base:** `round3/custodia-final-submission` (`de3100d`)

---

## 1. Existing Architecture

Custodia was originally created as a deterministic claim-verification and evidence-checking tool. Its existing architecture comprises:
- **Rust Secure Document Gateway (`gateway/`, Port 8002):** Actix-Web service performing pre-ingestion security validation (MIME and magic-byte validation, ZIP bomb decompression ratio ceiling 250:1, filename sanitization against path traversal, and SHA-256 fingerprinting).
- **FastAPI Backend Core (`app/`, Port 8000/8001):** Single-tier API exposing claim checking (`/api/reviews`), multi-format document parsing (`/api/documents/upload` for PDF, DOCX, XLSX, CSV, TXT), external registry connectors (`app/connectors/`), and session authentication (`/api/auth/`).
- **Deterministic 7-Dimensional Frame Algebra (`app/rules/`):** Mathematical engine decomposing claims into metric, value, unit, population, time window, conditions, and strength of wording.
- **SQLite Data Layer (`app/store.py`):** Basic user accounts with PBKDF2 hashing, flat review entries, audit revisions, and human decision logging.
- **Frontend Workspace (`frontend/src/`):** React 19 + TypeScript + Vite SPA featuring claim checker forms, FitRing visualization, dual-pane document highlighting, and reviewer workspace modal.

---

## 2. Existing Working Functionality

- **Secure Document Uploads:** PDF (multi-page + OCR detection), DOCX (headings and paragraphs), XLSX (sheet/row/cell references), CSV, and TXT parsing with full SHA-256 and provenance citation tracking.
- **Rust Ingestion Sanitizer:** Native memory-safe pre-filtering for uploads with Python signature fallback.
- **Claim Verification:** Strict 7-dimensional contradiction detection with zero false approvals on the 116-case benchmark.
- **Language Risk Scanner:** Regex and lexical detection of high-risk hyperbolic and absolute marketing claims.
- **External Evidence Connectors:** Crossref, OpenAlex, PubMed, ClinicalTrials.gov, and Google Fact Check APIs with circuit breakers and caching.
- **Basic Reviewer Decisions & Audit History:** Append-only revision logging for claims in SQLite.

---

## 3. Incomplete & Legacy Functionality

- **Absence of Brand Knowledge / Policy Base:** The system only compared ad-hoc claim text to ad-hoc evidence text. It had no concept of an organization, brand profile, persistent brand guidelines, or approved brand facts.
- **No Rule Enforcement Engine for Tone & Style:** The existing rule engine checked only numerical/empirical claim dimensions; it lacked brand tone scoring, preferred vs prohibited terminology, and disclaimer compliance.
- **Single-Tenant Data Store:** While `user_id` was tracked, there was no multi-tenant `Organization` or `Membership` model with role-based access control (Admin, Brand Manager, Creator, Reviewer).
- **No Visual Content Governance:** Uploading visual creatives, ad banners, logo graphics, or color-palette checks was unsupported.
- **Absence of Governance Analytics:** No metrics for brand drift, compliance rates over time, violation frequency by category, or review velocity.

---

## 4. Existing Bugs & Architectural Pain Points

- **Low System Uptime Sensitivity in Rate Limiting:** Fixed in commit `de3100d`, where `time.monotonic()` in newly booted containers caused timestamp subtraction underflows.
- **Hardcoded Single Claim-Evidence Pair View:** The UI was locked into a two-textarea layout ("Draft marketing claim" vs "Supporting evidence"), inadequate for full campaign materials, multi-channel copy, and visual creative assets.

---

## 5. Reusable Modules

- `app/documents/parser.py`: Multi-format document parser (PDF, DOCX, XLSX, CSV, TXT) with provenance tracking.
- `gateway/`: Complete Rust security gateway for file verification.
- `app/rules/engine.py` & `app/rules/confidence.py`: Deterministic comparison algebra and confidence invariant caps.
- `app/extraction/parsers.py`: Number, percentage, monetary, and entity parsers.
- `app/connectors/`: Resilient external API connectors with circuit breakers.
- `frontend/src/checker/FitRing.tsx`: SVG animated compliance score gauge.
- `frontend/src/checker/diff.ts`: Token-level string diff utility for rewrites.

---

## 6. Required Refactoring

- **Modularity:** Separate business logic into distinct domains:
  - `app/brand/`: Brand profiles, brand guidelines ingestion, rule extraction, and brand asset management.
  - `app/governance/`: Brand rules engine, policy validator, and multi-dimensional analysis orchestration.
  - `app/preflight/`: Content ingestion, preflight check orchestration, findings generator, and correction applicator.
  - `app/workflow/`: Human review assignments, role-based approval state machine, comments, and decisions.
  - `app/analytics/`: Real-time and historical brand drift metrics, violation trends, and compliance scores.
  - `app/visual/`: Visual brand intelligence (logo detection, brand color palette matching, alt-text checking).
- **Schema Evolution:** Extend `app/store.py` with multi-tenant relational tables (Organizations, Memberships, BrandProfiles, BrandRules, BrandAssets, ApprovedFacts, ContentItems, PreflightReviews, Findings, ApprovalDecisions, AuditEvents).

---

## 7. New Backend Services

1. **Brand DNA Engine (`app/brand/`):**
   - Ingestion of guideline PDFs, brand playbooks, approved claims, and color specifications.
   - Rule extraction pipeline with status tracking (`EXTRACTED`, `PENDING_REVIEW`, `ACTIVE`, `INACTIVE`).
   - Approved facts repository (e.g. pricing, trial metrics, official guarantees).
2. **Brand Preflight Engine (`app/preflight/`):**
   - Content submission orchestration across text, documents, and visual media.
   - Comprehensive multi-model analysis combining deterministic rules, empirical claim checks, and semantic evaluation.
   - Risk scoring algorithm balancing severity levels (`STRICT`, `WARNING`, `ADVISORY`).
3. **Visual Brand Intelligence Service (`app/visual/`):**
   - Color extraction from images and Delta-E color distance measurement against brand hex palettes.
   - Logo presence and variant consistency inspection.
   - Image text and accessibility disclaimer checking.
4. **Approval & Governance Workflow Engine (`app/workflow/`):**
   - State machine: `DRAFT` → `PROCESSING` → `NEEDS_REVISION` → `PENDING_REVIEW` → `APPROVED` / `APPROVED_WITH_CONDITIONS` / `REJECTED`.
   - Role-based permissions enforcing that only authorized Reviewers and Brand Managers can sign off.
5. **Brand Drift & Analytics Engine (`app/analytics/`):**
   - Dynamic query aggregation across review findings, category breakdown, violation recurrence, and approval velocity.

---

## 8. New Frontend Screens

The frontend is transformed into a modern, high-density enterprise SaaS platform (Linear/Stripe inspired):
- **Overview (Dashboard):** Brand health score, pending review queue, critical compliance alerts, recent approvals, and violation breakdown.
- **Brand DNA:** Brand profile setup, guideline uploader, rule review table (with edit, approve, and deactivate controls), approved facts manager, and tone specifications.
- **Content Studio:** Multi-modal content creation and submission (text editor, document uploader, creative image attachment, brand profile selector, and content category selector).
- **Brand Preflight (Inspection Workspace):** Side-by-side content preview with inline finding highlights, explainable findings panel, severity badges, rule citations, approved source links, and one-click correction applicator.
- **Review Queue:** Collaborative review list with assignment filters, review decision modals (`APPROVED`, `APPROVED_WITH_CONDITIONS`, `REJECTED`), reviewer notes, and discussion comments.
- **Brand Assets:** Visual asset library displaying approved logos, color swatches, typography rules, and usage constraints.
- **Governance Analytics:** Charts and breakdown metrics for compliance rate, common violation categories, average resolution time, and brand drift over time.
- **Audit & History:** Searchable, immutable event log for compliance audits.
- **Settings:** Organization management, user roles, API provider status, and security controls.

---

## 9. New Database Structures

- `organizations`: Multi-tenant organization accounts.
- `memberships`: User-to-organization mapping with roles (`ADMIN`, `BRAND_MANAGER`, `CREATOR`, `REVIEWER`).
- `brand_profiles`: Specific brand/product identities within an organization.
- `brand_rules`: Rules across categories (`TONE`, `TERMINOLOGY`, `MESSAGING`, `FACTS`, `CLAIMS`, `LEGAL`, `VISUAL`, `ACCESSIBILITY`) with enforcement levels (`STRICT`, `WARNING`, `ADVISORY`).
- `brand_rule_versions`: Historical versions of modified rules.
- `brand_assets`: Logos, imagery, and style palettes with metadata.
- `approved_facts`: Structured enterprise truth repository (prices, metrics, cohorts, dates).
- `content_items`: Submitted marketing and communication pieces.
- `preflight_reviews`: Preflight analysis runs with overall compliance score, risk tier, and status.
- `review_findings`: Granular findings with category, severity, confidence, explanation, and suggested correction.
- `review_comments`: Discussion threads between creators and compliance reviewers.
- `approval_decisions`: Immutable sign-off records with reviewer ID, decision, and rationale.
- `audit_events`: Tamper-evident activity stream.

---

## 10. AI Model Strategy

| Capability | Model / Engine | Responsibility | Fallback |
| :--- | :--- | :--- | :--- |
| **Deterministic Validation** | Native Python & Regex Rules | Exact terminology, prohibited phrases, pricing verification, required disclaimers. | 100% deterministic, zero external dependencies. |
| **Claim Entailment & Contradictions** | 7-Dimensional Frame Algebra + Calibrated NLI | Verifying numerical, temporal, and population claims against approved facts and evidence. | Propositional logic bounds check. |
| **Tone & Messaging Analysis** | Gemini 2.5 Flash / Pro (Structured Output) | Contextual brand tone analysis, nuanced messaging guidelines, and context-aware rewrites. | Rule-based semantic scanner and narrower wording heuristics. |
| **Visual Analysis** | Vision API / Canvas & Color Distance Engine | Palette extraction, Delta-E color distance, logo bounding checks, image text extraction. | Hex color sampling and structural metadata checks. |
| **Document Ingestion** | `pypdf`, `python-docx`, `openpyxl` | Structured text and table extraction with page/cell provenance citations. | Rejects rasterized PDFs with `SCANNED_PDF_OCR_REQUIRED`. |

---

## 11. Security Improvements

- Strict organization isolation enforced at the database and query layer.
- RBAC permissions checked on all workflow and review decision endpoints.
- Secure document processing through Rust gateway sanitization.
- Private document isolation: customer creative materials are never logged or leaked.
- CSRF protection and signed HTTP-only cookies.

---

## 12. Testing Strategy

1. **Unit & Regression Tests:** Preserve existing 172 Python tests, 116 benchmark cases, 19 Rust tests, 67 frontend tests, and 54 Playwright checks.
2. **New Brand Governance Tests:**
   - Brand profile creation and rule extraction.
   - Deterministic brand policy validation (prohibited words, mandatory disclaimers, pricing).
   - Multi-tenant organization isolation.
   - Workflow approval permissions and transition enforcement.
3. **End-to-End Acceptance Scenario (Phase 17):**
   - Organization setup → Brand profile → Upload guideline rules → Submit advertisement ("Our AI platform guarantees 95% higher productivity for every business. Subscribe today for ₹799.") → Preflight analysis catches 4 distinct violations → Creator applies rewrite → Reviewer approves → Decision logged to immutable audit history.

---

## 13. Deployment Strategy

- **Backend:** FastAPI modular monolith supporting both development mode (`CUSTODIA_ENV=dev`) and production with signed sessions.
- **Frontend:** React 19 production build bundled into `app/web` for single-origin serving or standalone Vercel hosting.
- **Containerization:** 4-stage multi-stage `Dockerfile` (Node 22 Web Builder, Python Model Builder, Rust 1.85 Gateway Builder, and Python Runtime) supervised via `scripts/start.sh`.
