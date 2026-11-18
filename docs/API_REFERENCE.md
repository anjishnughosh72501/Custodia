# Inkloom AI Brand Governance REST API Reference

All endpoints are hosted under `/api`. Standard responses are returned in JSON with strict HTTP status codes.

---

## 1. Brand DNA & Guidelines

### `GET /api/brand/organizations`
Returns all registered enterprise organizations.
- **Response**: `200 OK`
```json
{
  "organizations": [
    {
      "id": "org_inkloom_demo",
      "name": "Inkloom AI Enterprise",
      "slug": "inkloom-ai-enterprise",
      "created_at": "2026-11-18T18:00:00Z"
    }
  ]
}
```

### `GET /api/brand/profiles`
Lists brand profiles, optionally filtered by `org_id`.
- **Query Params**: `org_id` (optional)
- **Response**: `200 OK`

### `POST /api/brand/profiles/{profile_id}/guidelines`
Uploads a guideline document (PDF, DOCX, TXT, MD) and extracts candidate brand governance rules.
- **Form Data**: `file` (multipart file upload, max 15 MB)
- **Response**: `200 OK`
```json
{
  "filename": "Brand_Playbook_2026.pdf",
  "extracted_rules_count": 4,
  "rules": [...]
}
```

### `GET /api/brand/profiles/{profile_id}/rules`
Lists all governance rules for a brand profile.
- **Query Params**: `status` (optional: `ACTIVE`, `INACTIVE`, `EXTRACTED`)
- **Response**: `200 OK`

### `POST /api/brand/rules/{rule_id}/toggle`
Toggles a brand rule between `ACTIVE` and `INACTIVE`.
- **Response**: `200 OK`

### `GET /api/brand/profiles/{profile_id}/facts`
Lists approved enterprise facts (pricing ground truth, clinical metrics, product identities).
- **Response**: `200 OK`

### `GET /api/brand/profiles/{profile_id}/assets`
Lists registered brand assets (vector logos, primary palettes, fonts).
- **Response**: `200 OK`

---

## 2. Brand Preflight Engine

### `POST /api/preflight/analyze`
Executes multi-model preflight inspection against active rules and approved enterprise facts.
- **Request Body**:
```json
{
  "brand_profile_id": "bp_demo",
  "content": "Our AI platform guarantees 95% higher productivity for every business. Subscribe today for ₹799.",
  "category": "AD",
  "channels": ["social", "display"]
}
```
- **Response**: `200 OK`
```json
{
  "id": "prev_7b08491f",
  "overall_score": 0,
  "risk_tier": "CRITICAL",
  "workflow_status": "NEEDS_REVISION",
  "findings": [
    {
      "id": "fnd_cb19899a73",
      "title": "Prohibited Guarantee Language",
      "category": "LEGAL",
      "enforcement": "STRICT",
      "highlighted_text": "guarantees",
      "explanation": "Marketing statements must never use absolute guarantee language...",
      "suggested_fix": "demonstrated to deliver",
      "source_reference": "Inkloom_Brand_Governance_Playbook_2026.pdf (Section 4.1)"
    },
    {
      "id": "fnd_0b0fa21c43",
      "title": "Approved Subscription Pricing: ₹999",
      "category": "FACTS",
      "enforcement": "STRICT",
      "highlighted_text": "₹799",
      "suggested_fix": "₹999",
      "source_reference": "FY26_Master_Commercial_Pricing.xlsx (Sheet: Subscriptions!R2C4)"
    }
  ],
  "suggested_rewrite": "Our AI platform demonstrated to deliver up to 35% higher productivity for small and mid-sized teams. Subscribe today for ₹999."
}
```

### `POST /api/preflight/reviews/{review_id}/apply-correction`
Applies a specific suggested correction or all corrections to the review draft.
- **Request Body**: Optional `{ "finding_id": "fnd_..." }` (omitting applies all)
- **Response**: `200 OK` (returns updated review with recomputed score)

---

## 3. Human Approval & Governance Workflow

### `GET /api/workflow/queue`
Retrieves prioritized review queue for compliance officers and reviewers.
- **Response**: `200 OK`
```json
{
  "queue": [...],
  "total_pending": 2,
  "total_count": 8
}
```

### `POST /api/workflow/reviews/{review_id}/decision`
Records a formal human reviewer sign-off decision with RBAC verification.
- **Request Body**:
```json
{
  "decision": "APPROVED",
  "notes": "Verified against FY26 pricing sheet and clinical trial benchmark report."
}
```
- **Allowed Decisions**: `APPROVED`, `APPROVED_WITH_CONDITIONS`, `REJECTED`.
- **Response**: `200 OK`

### `POST /api/workflow/reviews/{review_id}/comments`
Adds a discussion comment to the immutable review audit thread.
- **Request Body**: `{ "comment": "Requested updated disclaimer footnote." }`
- **Response**: `200 OK`

---

## 4. Governance Drift Analytics & Audit

### `GET /api/analytics/overview`
Returns real-time aggregated metrics across the organization.
- **Response**: `200 OK`
```json
{
  "total_reviews": 12,
  "approval_rate_pct": 75.0,
  "overall_compliance_score": 82.5,
  "category_breakdown": {
    "FACTS": 5,
    "CLAIMS": 3,
    "LEGAL": 2,
    "MESSAGING": 1
  },
  "top_violated_rules": [
    { "rule_id": "rule_approved_price", "rule_title": "Approved Pricing ₹999", "count": 5 }
  ]
}
```

### `GET /api/audit/events`
Returns immutable ledger of cryptographic audit entries (`evt_*`).
- **Response**: `200 OK`

---

## 5. Phase 17 Showcase Scenario Endpoint

### `POST /api/demo/run-phase17-scenario` (or `GET`)
Executes the complete Phase 17 acceptance scenario in a single call for live demonstration:
1. Ingests benchmark copy: `"Our AI platform guarantees 95% higher productivity for every business. Subscribe today for ₹799."`
2. Evaluates against Inkloom brand DNA.
3. Detects all 4 distinct issues (guarantee, pricing, 95% metric, universal population).
4. Demonstrates strict score invariant capping at `0` (`CRITICAL` tier).
5. Generates auto-corrected rewrite.
6. Applies fix and conducts reviewer sign-off.
7. Logs immutable event to SQLite ledger.
- **Response**: `200 OK`
