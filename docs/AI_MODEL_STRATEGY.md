# AI Model Strategy & Reasoning Architecture

## Overview

Custodia implements a **defense-in-depth, hybrid reasoning architecture** designed specifically for mission-critical enterprise brand governance. Brand safety, legal liability, and regulatory compliance cannot rely exclusively on probabilistic Large Language Models (LLMs) that may hallucinate, suffer from non-deterministic variance, or fail during API outages.

Custodia guarantees **Zero-Key Deterministic Execution**: the entire brand governance pipeline runs with 100% functionality, sub-second latency, and zero external network dependencies out of the box. When external LLM API keys (Gemini, OpenAI, Anthropic) are configured, Custodia seamlessly layers on qualitative semantic reasoning while retaining strict deterministic guardrails.

---

## 1. Zero-Key Deterministic Fallback Engine

The core governance engine (`app/preflight/service.py`) operates deterministically through four mathematical and rule-based verification layers:

### A. Prohibited Claims & Guarantee Detection
* **Mechanism**: Lexical and grammatical pattern matching targeting strict legal liability triggers.
* **Coverage**: Absolute performance guarantees (`guarantee`, `guarantees`, `guaranteed`, `risk-free`, `100% success`), deceptive urgency (`act now or miss out`), and unauthorized superlative claims.
* **Deterministic Output**: Flags exact character spans, assigns `STRICT` enforcement severity, and provides templated, legally vetted replacement language.

### B. Truthful Advertising & Approved Fact Discrepancy
* **Mechanism**: Entity and numerical claim extractor coupled with fuzzy and relational comparison against the organization's `ApprovedFact` repository.
* **Pricing Verification**: Extracts currency symbols (`₹`, `$`, `€`, `£`) and integer/floating-point values. If a price deviates from approved facts (e.g., claiming `₹799` when the approved price is `₹999`), a critical discrepancy finding is generated with the exact discrepancy delta.
* **Empirical Claim Ceilings**: Identifies percentage improvements and metric assertions (e.g., `95% higher productivity`). Verifies the claim against empirical trial benchmark ceilings (e.g., approved benchmark max: `35%`).
* **Population Cohort Verification**: Flags universal population generalizations (`every business`, `all users`, `guaranteed for anyone`) when product capabilities are validated only for specific test cohorts.

### C. Visual Brand Compliance & Euclidean Color Distance
* **Mechanism**: Mathematical color distance calculations (`app/visual/service.py`) in 3-dimensional RGB space:
  $$\Delta E_{RGB} = \sqrt{(R_1 - R_2)^2 + (G_1 - G_2)^2 + (B_1 - B_2)^2}$$
* **Palette Matching**: Compares detected asset hex colors against approved brand palette colors (`primary`, `secondary`, `accent`).
* **Thresholds**:
  * Distance $\le 30.0$: Exact or perceptual match (Compliant).
  * Distance between $30.0$ and $80.0$: Noticeable drift (Flagged as moderate recommendation).
  * Distance $> 80.0$: Off-brand color usage (Flagged as guideline deviation).

### D. Invariant Scoring and Tier Capping
* **Scoring Bounds**: Governance score is normalized to $[0, 100]$.
* **Strict Penalty Caps**:
  * Any single `STRICT` enforcement violation (e.g., unauthorized price or illegal guarantee) caps the overall score at **maximum 45**.
  * Two or more `STRICT` violations collapse the score to $\le 30$ (or $0$), forcing the review into the `CRITICAL` risk tier.
  * Score $\ge 85$: `LOW` risk.
  * Score $60 - 84$: `MEDIUM` risk.
  * Score $31 - 59$: `HIGH` risk.
  * Score $\le 30$: `CRITICAL` risk.

---

## 2. Multi-Model LLM Layer (Optional Enhancement)

When external API keys are configured in the environment, Custodia can utilize frontier LLMs for advanced narrative tone analysis, stylistic suggestions, and creative rewriting:

```
+-------------------------------------------------------------+
|                      Content Input                          |
+-------------------------------------------------------------+
                              |
       +----------------------+----------------------+
       |                                             |
       v                                             v
+-----------------------------+        +---------------------------+
| Deterministic Rules Engine  |        |  Frontier LLM Reasoning   |
| (RegEx, Facts, Math, Color) |        | (Gemini / GPT-4o / Claude)|
+-----------------------------+        +---------------------------+
       |                                             |
       | Absolute Findings                           | Contextual Tone
       | Invariant Score Ceiling                     | Stylistic Nuance
       | Approved Fact Discrepancies                 | Alternative Phrasings
       \                                             /
        \                                           /
         v                                         v
       +---------------------------------------------+
       |          Unified Preflight Review           |
       |  (Deterministic Invariants Always Prevail)  |
       +---------------------------------------------+
                              |
                              v
       +---------------------------------------------+
       |   Human-in-the-Loop Reviewer Sign-Off       |
       +---------------------------------------------+
```

### Supported Providers
1. **Google Gemini (Gemini 1.5 Pro / Flash)**: Deep context window for parsing full 200+ page brand style guides and extracting DNA rules.
2. **OpenAI (GPT-4o)**: Fast natural language correction and multi-lingual tone matching.
3. **Anthropic (Claude 3.5 Sonnet)**: Nuanced legal and regulatory reasoning for highly regulated sectors (fintech, healthcare, edtech).

### Invariant Safety Rule: LLMs Cannot Overturn Deterministic Findings
Even if an LLM assesses a promotional copy as "persuasive and engaging", the deterministic engine's findings (such as an unapproved price or false guarantee) **cannot be silenced, downgraded, or overridden** by the LLM. Only an authenticated human reviewer (`REVIEWER` or `ADMIN`) can grant an exemption.

---

## 3. Automated Copy Correction Architecture

Custodia does not merely flag errors; it provides instant, non-destructive remediation:
1. **Span-Level Replacement**: Each finding contains `original_snippet` and `suggested_snippet`.
2. **Sequential Replacement Pipeline**: `apply_finding_correction()` applies fixes from the highest-confidence finding to lowest, adjusting string offsets to prevent truncation.
3. **Audit Tracking**: The original copy, corrected copy, applied corrections, and before/after compliance scores are preserved in the database and logged to the immutable audit trail.
