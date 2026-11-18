# Testing Strategy & Test Verification Matrix

## Overview

Custodia maintains a multi-layered automated testing suite covering Python backend services, the Rust security gateway, the React frontend application, and end-to-end integration workflows.

---

## 1. Test Verification Summary

| Component | Test Runner | Total Tests | Status | Execution Time |
|---|---|---|---|---|
| **Python Backend** | `pytest` | **183** | **100% Passed** | ~23s |
| **Frontend UI** | `vitest` | **67** | **100% Passed** | ~3.5s |
| **Rust Security Gateway** | `cargo test` | **19** | **100% Passed** | ~2s |
| **Phase 17 Acceptance Scenario** | Integration | **1** (Full End-to-End) | **100% Passed** | Sub-second |

---

## 2. Running the Test Suites

### A. Python Backend Tests
Run the complete Python test suite:
```bash
python -m pytest -v
# Or for summary:
python -m pytest -q
```

To run specifically the Inkloom Brand Governance and Phase 17 test suite:
```bash
python -m pytest tests/test_inkloom_brand_governance.py -v
```

### B. Frontend Vitest Tests
Run the React frontend test suite:
```bash
npm --prefix frontend test -- --run
```

To run type checking and production build verification:
```bash
npm --prefix frontend run build
```

### C. Rust Security Gateway Tests
Run formatting checks, Clippy linter, and unit tests:
```bash
cargo fmt --check --manifest-path gateway/Cargo.toml
cargo test --manifest-path gateway/Cargo.toml
```

---

## 3. Phase 17 Acceptance Criteria Test Matrix

The benchmark test in `tests/test_inkloom_brand_governance.py::test_phase17_benchmark_scenario` verifies the full end-to-end workflow:

### Benchmark Input Copy
> *"Our AI platform guarantees 95% higher productivity for every business. Subscribe today for ₹799."*

### Verified Assertions:
1. **Four Distinct Violations Detected**:
   * Violation 1: **Prohibited Guarantee Language** (Flagged: `guarantees`, Category: `CLAIM_SUBSTANTIATION`, Enforcement: `STRICT`).
   * Violation 2: **Unauthorized Pricing Claim** (Flagged: `₹799`, Approved Price: `₹999`, Delta: `-₹200`, Category: `LEGAL_COMPLIANCE`, Enforcement: `STRICT`).
   * Violation 3: **Empirical Claim Ceiling Discrepancy** (Flagged: `95%`, Verified Trial Ceiling: `35%`, Category: `CLAIM_SUBSTANTIATION`, Enforcement: `STRICT`).
   * Violation 4: **Universal Population Generalization** (Flagged: `every business`, Approved Target: `verified enterprise trial participants`, Category: `BRAND_VOICE`, Enforcement: `GUIDELINE`).

2. **Invariant Scoring & Risk Tier Capping**:
   * Score strictly capped at **$\le 30$** (computed score: `0`).
   * Risk tier assigned: **`CRITICAL`**.
   * Requires human reviewer escalation.

3. **Automated Copy Correction**:
   * Generates legally compliant alternative copy:
     > *"Our AI platform delivers up to 35% higher productivity for verified enterprise trial participants. Subscribe today for ₹999."*
   * Replaced:
     * `guarantees` $\rightarrow$ `delivers up to`
     * `95%` $\rightarrow$ `35%`
     * `every business` $\rightarrow$ `verified enterprise trial participants`
     * `₹799` $\rightarrow$ `₹999`

4. **Human Reviewer Sign-Off Enforcement**:
   * Creator user cannot self-approve (`HTTP 403 Forbidden` / rejected).
   * Authorized reviewer (`REVIEWER` or `ADMIN`) applies decision (`APPROVED`).
   * Final status transitions to `APPROVED`.

5. **Cryptographic Audit Event Generation**:
   * Generated audit log entries with action types `PREFLIGHT_ANALYZED`, `FINDING_CORRECTED`, and `REVIEW_APPROVED`.
   * Each entry possesses a non-empty SHA-256 hash verifying payload integrity.
