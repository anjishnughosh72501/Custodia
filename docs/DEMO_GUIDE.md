# Inkloom AI Hackathon — Demo & Evaluation Guide

## Welcome Judges & Evaluators!

Custodia is an intelligent, full-stack brand governance and content intelligence platform built for modern enterprise marketing and legal compliance teams.

This guide provides a rapid 3-minute walkthrough demonstrating Custodia's capabilities, UI workflows, and automated governance engine.

---

## Quick Start (30 Seconds)

1. Ensure the backend is running on `http://localhost:8001`.
2. Open your browser and navigate to:
   ```text
   http://localhost:8001
   ```
3. You will be greeted by the Custodia UI. The pre-seeded demo organization (`Acme Global Technologies`) and active brand rules are already loaded.

---

## Feature 1: The One-Click Phase 17 Benchmark Showcase

The Phase 17 scenario demonstrates the benchmark ad copy challenge evaluated under zero-key deterministic execution.

### Step-by-Step:
1. In the top navigation bar, click the **"Phase 17 Showcase"** button (or click **"Phase 17 Demo"** in the action bar).
2. The interactive modal opens displaying the challenge input copy:
   > *"Our AI platform guarantees 95% higher productivity for every business. Subscribe today for ₹799."*
3. Click **"Run Phase 17 Benchmark Scenario"**.
4. **Observe the Results**:
   * **4 Distinct Violations Flagged**:
     1. `PROHIBITED GUARANTEE LANGUAGE`: "guarantees" detected (`CLAIM_SUBSTANTIATION`, `STRICT`).
     2. `UNAUTHORIZED PRICING`: Claimed "₹799" vs Approved "₹999" (`LEGAL_COMPLIANCE`, `STRICT`).
     3. `EMPIRICAL CLAIM CEILING EXCEEDED`: Claimed "95%" vs Verified trial ceiling "35%" (`CLAIM_SUBSTANTIATION`, `STRICT`).
     4. `UNIVERSAL COHORT CLAIM`: "every business" generalizes beyond verified cohort (`BRAND_VOICE`, `GUIDELINE`).
   * **Invariant Score Capping**: Score drops to **0 / 100** (`CRITICAL` Risk Tier).
   * **Instant Auto-Correction**: View the suggested compliant copy side-by-side:
     > *"Our AI platform delivers up to 35% higher productivity for verified enterprise trial participants. Subscribe today for ₹999."*
   * **Workflow Sign-off**: The demo automatically simulates creator fix submission and human reviewer (`LEGAL_DIRECTOR`) sign-off.
   * **Cryptographic Audit Event**: Displays the SHA-256 hash verifying the immutable audit record.

---

## Feature 2: Enterprise Brand DNA Engine

1. In the top navigation bar, click **"Brand DNA"**.
2. **Brand Rules Tab**:
   * Inspect extracted brand rules across categories (`BRAND_VOICE`, `LEGAL_COMPLIANCE`, `CLAIM_SUBSTANTIATION`, `VISUAL_IDENTITY`).
   * Click any rule's **Active / Inactive toggle switch** to dynamically enable or disable enforcement in real-time.
3. **Approved Facts Repository**:
   * Review verified organization facts (Product name, approved pricing tiers, empirical benchmark trial results, verified target audiences).
   * Notice the verified facts against which all preflight copy is mathematically compared.
4. **Brand Assets & Palette**:
   * View brand visual assets (logos, banners) and the primary/secondary color palette (`#0F172A`, `#3B82F6`, `#10B981`) used for Euclidean color drift detection.

---

## Feature 3: Live Content Studio & Preflight Check

1. In the Brand Governance Workspace modal, click the **"Content Studio"** tab.
2. Enter your own custom promotional copy in the draft editor or modify the text:
   * Try typing: *"Get our AI suite with 100% guarantee for just $49."*
3. Click **"Run Preflight Analysis"**.
4. The engine instantly evaluates the text against the active Brand DNA and displays:
   * Real-time Governance Compliance Score and Risk Badge.
   * Granular finding cards with exact character offsets, explanation, and severity.
   * One-click **"Apply Fix"** button for instant copy remediation.

---

## Feature 4: Human-in-the-Loop Review Queue

1. Switch to the **"Review Queue"** tab.
2. View pending content reviews requiring human sign-off.
3. Notice that `CREATOR` users cannot self-approve.
4. Select a review and inspect:
   * Original content vs auto-corrected draft.
   * Finding breakdown and category risk scores.
   * Approver action buttons: **"Approve"**, **"Request Revision"**, or **"Reject"**.
5. Entering an approval comment immediately stamps the review as `APPROVED`, updates the workflow status, and logs a tamper-evident audit event.

---

## Feature 5: Governance Drift Analytics

1. Switch to the **"Drift Analytics"** tab.
2. View real-time organizational compliance telemetry:
   * Overall compliance score average across all reviews.
   * Category breakdown bars (`Brand Voice`, `Legal Compliance`, `Claim Substantiation`, `Visual Identity`).
   * Risk tier distribution (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`).
   * Audit event history with event types, actors, and cryptographic timestamps.
