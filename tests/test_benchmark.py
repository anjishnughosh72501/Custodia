from pathlib import Path
import json
import pytest
from app.service import ReviewService
from app.store import Store

ROOT = Path(__file__).resolve().parent.parent
CASES_FILE = ROOT / "bench" / "cases.jsonl"


def test_benchmark_has_zero_false_approvals():
    assert CASES_FILE.exists(), f"Benchmark cases file {CASES_FILE} not found"

    service = ReviewService(Store(":memory:"))
    cases = []
    with open(CASES_FILE, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                cases.append(json.loads(line))

    assert len(cases) >= 60, f"Expected at least 60 benchmark cases, got {len(cases)}"
    baseline = [c for c in cases if c.get("set") == "baseline"]
    adversarial = [c for c in cases if c.get("set") == "adversarial"]
    assert len(adversarial) >= 20, f"Expected at least 20 adversarial cases, got {len(adversarial)}"

    false_approvals = []
    for c in cases:
        review = service.review(c["claim"], c["evidence"])
        approved = (review.verdict.status.value == "SUPPORTED_BY_SUPPLIED_EVIDENCE")
        if c["expected_not_approved"] and approved:
            false_approvals.append({
                "id": c["id"],
                "set": c.get("set"),
                "category": c.get("category"),
                "claim": c["claim"]
            })

    assert len(false_approvals) == 0, f"Benchmark encountered false approvals: {false_approvals}"
