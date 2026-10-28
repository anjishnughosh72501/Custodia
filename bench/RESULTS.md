# Custodia Benchmark & Evaluation Results

**Date**: Oct 28, 2026  
**Engine Version**: rules-1.1  
**Total Cases**: 65  
**Execution Time**: 69.54 ms (1.07 ms/case)  

## Executive Summary

- **False Approvals**: **0** across all 65 test cases.
- **False Rejections**: **0** across all faithful test cases.
- **Contract Guarantee**: The deterministic engine strictly withholds approval whenever wording outgrows, contradicts, or drops conditions from the evidence.

## Split Breakdown (Dev vs Heldout)

| Split | Cases | Approved | Withheld | False Approvals | False Rejections | Safety Rate |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `dev` | 38 | 9 | 29 | 0 | 0 | 100.0% |
| `heldout` | 27 | 6 | 21 | 0 | 0 | 100.0% |

## Set Breakdown (Baseline vs Adversarial)

| Set | Cases | Approved | Withheld | False Approvals | False Rejections | Safety Rate |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `baseline` | 45 | 12 | 33 | 0 | 0 | 100.0% |
| `adversarial` | 20 | 3 | 17 | 0 | 0 | 100.0% |

## Category Performance

| Category | Cases | Approved | Withheld | False Approvals | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `causal_leaps` | 6 | 0 | 6 | 0 | ✅ Clean |
| `direction_flip` | 2 | 0 | 2 | 0 | ✅ Clean |
| `dropped_condition` | 2 | 0 | 2 | 0 | ✅ Clean |
| `faithful` | 15 | 15 | 0 | 0 | ✅ Clean |
| `guarantees` | 3 | 0 | 3 | 0 | ✅ Clean |
| `hedged_evidence` | 2 | 0 | 2 | 0 | ✅ Clean |
| `injection_strings` | 3 | 0 | 3 | 0 | ✅ Clean |
| `multi_number_evidence` | 1 | 0 | 1 | 0 | ✅ Clean |
| `number_inflation` | 4 | 0 | 4 | 0 | ✅ Clean |
| `population_widening` | 4 | 0 | 4 | 0 | ✅ Clean |
| `residue_assertion` | 9 | 0 | 9 | 0 | ✅ Clean |
| `second_person_promises` | 2 | 0 | 2 | 0 | ✅ Clean |
| `statistic_swap` | 3 | 0 | 3 | 0 | ✅ Clean |
| `superlatives` | 4 | 0 | 4 | 0 | ✅ Clean |
| `time_window_stretch` | 3 | 0 | 3 | 0 | ✅ Clean |
| `unit_swap` | 2 | 0 | 2 | 0 | ✅ Clean |

## Model Role Configuration & Rationale

Custodia supports role-based model configuration:

| Role | Env Var | Default | Why Kept |
| :--- | :--- | :--- | :--- |
| Quote extraction | `CUSTODIA_MODEL_EXTRACT` | `claude-haiku-5-5` | Fast, low latency, outputs verbatim quotes verified character-by-character by Python code |
| Language flags | `CUSTODIA_MODEL_FLAGS` | `claude-haiku-5-5` | Concise JSON classification, verified against exact text spans |
| Rewrite proposals | `CUSTODIA_MODEL_REWRITE` | `claude-sonnet-5-5` | Higher creative wording quality; all generated proposals are automatically re-checked by the rule engine before display |

If `ANTHROPIC_API_KEY` is not present, Custodia runs entirely on its deterministic heuristic extractor (`extractor_mode=heuristic`) without degrading rule verification semantics.

## Limitations & Honesty Statement

- **In-house test set**: These 65 test cases represent deliberate challenge problems covering known marketing failure modes (value inflation, dropped conditions, second-person promises, adversarial injections).
- **Not an open-world accuracy claim**: Custodia does not claim 100% accuracy on open-domain web text; rather, it guarantees that its deterministic rules will never promote unknown or unverified text to supported.
