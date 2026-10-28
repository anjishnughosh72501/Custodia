# Custodia Evaluation & Benchmark Methodology

This document outlines the evaluation methodology, dataset structure, split distribution, and design rationale for Custodia's verification suite.

---

## 1. Objective and Contract

Custodia's core premise is deterministic safety for marketing and compliance claims:

1. **Non-negotiable contract**: A marketing claim is approved (`SUPPORTED_BY_SUPPLIED_EVIDENCE`) **only if** every factual dimension (metric, value, unit, population, timeframe, conditions, strength) strictly stays within the bounds of the provided evidence.
2. **Deterministic authority**: Code decides final verdicts. Large Language Models (LLMs) or NLI models may only propose text spans, quote character offsets, or flag risk categories. Any model proposal is rigorously checked against the original text character-by-character.
3. **Fail-closed posture**: If evidence is ambiguous, missing, or contradictory, Custodia withholds approval (`NOT_SUPPORTED` or `NEEDS_HUMAN_REVIEW`). `unknown` is never promoted to `supported`.

---

## 2. Dataset (`bench/cases.jsonl`)

The evaluation suite consists of 65 carefully authored test cases covering realistic and adversarial scenarios encountered in software, SaaS, healthcare, and enterprise marketing claims.

### Stratified Splits (60/40)

- **`dev` (38 cases, 58.5%)**: Used for iterative tuning of deterministic rule patterns and heuristics.
- **`heldout` (27 cases, 41.5%)**: Sealed validation cases to verify that rule logic does not overfit to specific prompt wordings or syntactic forms.

### Category Coverage

| Category | Description | Primary Failure Mode |
| :--- | :--- | :--- |
| `faithful` | Exact or reordered restatements of evidence | False rejection |
| `number_inflation` | Number stretched beyond evidence (e.g. 30% -> 40%) | False approval |
| `unit_swap` | Swapping units (e.g. 30 days -> 30 hours, $100 -> €100) | False approval |
| `statistic_swap` | Conflating statistical measures (e.g. average vs median) | False approval |
| `population_widening` | Generalizing subset to entire population (e.g. Pro users -> all users) | False approval |
| `time_window_stretch` | Shortening or changing observation duration | False approval |
| `dropped_condition` | Omitting required prerequisites or configurations | False approval |
| `direction_flip` | Inverting measurement trend (e.g. decrease vs increase) | False approval |
| `superlatives` | Introducing absolute superlatives ("fastest", "first") | False approval |
| `causal_leaps` | Conflating correlation with direct causation | False approval |
| `guarantees` | Turning observed findings into promises or guarantees | False approval |
| `second_person_promises` | Promising future results to reader ("you will save") | False approval |
| `hedged_evidence` | Evidence itself includes uncertainty or preliminary caveats | False approval |
| `multi_number_evidence` | Distractor numbers in evidence | False approval |
| `residue_assertion` | Adding claims unsupported by any evidence span | False approval |
| `injection_strings` | Adversarial prompt injection attacks embedded in evidence | Security bypass |

---

## 3. Metrics

- **False Approvals**: Approving a claim when the evidence does not support it (`expected_not_approved=True`). Target: **0**.
- **False Rejections**: Withholding approval when the claim is strictly faithful (`expected_not_approved=False`). Target: **0**.
- **Latency**: Evaluation time per case in milliseconds on CPU without network overhead.

---

## 4. Running the Benchmark

```bash
# Run the evaluation suite
python bench/run.py

# Regenerate frontend metrics payload
python scripts/gen_benchmark_json.py
```

Results are saved to:
- `bench/results.json`: Machine-readable results and category stats.
- `bench/RESULTS.md`: Human-readable summary table.
- `frontend/src/landing/benchmark.json`: Consumed by the landing page benchmark counter.

---

## 5. Honest Disclaimers & Limitations

- **Not an open-web benchmark**: This suite tests known deterministic failure modes and edge cases. Real-world marketing claims vary in grammar, domain-specific terminology, and complexity.
- **English only**: Custodia is tested and verified for English text only.
- **Evidence accuracy**: Custodia verifies whether a claim matches the supplied text. It cannot judge whether the evidence itself is truthful, peer-reviewed, or fabricated.
