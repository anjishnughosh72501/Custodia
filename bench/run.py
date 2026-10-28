#!/usr/bin/env python3
"""Deterministic benchmark runner.
Runs rule-based claim verification over bench/cases.jsonl and reports measured false approvals and false rejections.
No network calls, no model calls.
"""
from __future__ import annotations
import json
import sys
from datetime import datetime
from pathlib import Path

# Add project root to path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.service import ReviewService
from app.store import Store
from app.rules.engine import ENGINE_VERSION

CASES_FILE = ROOT / "bench" / "cases.jsonl"
RESULTS_FILE = ROOT / "bench" / "results.json"


def run_benchmark():
    if not CASES_FILE.exists():
        print(f"Error: {CASES_FILE} does not exist", file=sys.stderr)
        sys.exit(1)

    service = ReviewService(Store(":memory:"))

    cases = []
    with open(CASES_FILE, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                cases.append(json.loads(line))

    baseline_cases = [c for c in cases if c.get("set") == "baseline"]
    adversarial_cases = [c for c in cases if c.get("set") == "adversarial"]

    breakdowns = {
        "baseline": {"total": len(baseline_cases), "false_approvals": 0, "false_rejections": 0, "approved": 0, "withheld": 0},
        "adversarial": {"total": len(adversarial_cases), "false_approvals": 0, "false_rejections": 0, "approved": 0, "withheld": 0},
    }

    failures = []

    for c in cases:
        c_set = c.get("set", "baseline")
        review = service.review(c["claim"], c["evidence"])
        approved = (review.verdict.status.value == "SUPPORTED_BY_SUPPLIED_EVIDENCE")
        expected_not_approved = c["expected_not_approved"]

        if approved:
            breakdowns[c_set]["approved"] += 1
        else:
            breakdowns[c_set]["withheld"] += 1

        is_false_approval = approved and expected_not_approved
        is_false_rejection = (not approved) and (not expected_not_approved)

        if is_false_approval:
            breakdowns[c_set]["false_approvals"] += 1
            failures.append({
                "id": c["id"],
                "set": c_set,
                "type": "FALSE_APPROVAL",
                "category": c.get("category"),
                "claim": c["claim"],
                "verdict": review.verdict.status.value,
            })
        elif is_false_rejection:
            breakdowns[c_set]["false_rejections"] += 1
            failures.append({
                "id": c["id"],
                "set": c_set,
                "type": "FALSE_REJECTION",
                "category": c.get("category"),
                "claim": c["claim"],
                "verdict": review.verdict.status.value,
                "abstain_reasons": review.verdict.abstain_reasons,
            })

    total_false_approvals = breakdowns["baseline"]["false_approvals"] + breakdowns["adversarial"]["false_approvals"]
    total_false_rejections = breakdowns["baseline"]["false_rejections"] + breakdowns["adversarial"]["false_rejections"]

    results = {
        "total_cases": len(cases),
        "false_approvals": total_false_approvals,
        "false_rejections": total_false_rejections,
        "date": "Oct 28, 2026",
        "engine_version": ENGINE_VERSION,
        "baseline": {
            "total": breakdowns["baseline"]["total"],
            "false_approvals": breakdowns["baseline"]["false_approvals"],
            "false_rejections": breakdowns["baseline"]["false_rejections"],
            "approved": breakdowns["baseline"]["approved"],
            "withheld": breakdowns["baseline"]["withheld"],
        },
        "adversarial": {
            "total": breakdowns["adversarial"]["total"],
            "false_approvals": breakdowns["adversarial"]["false_approvals"],
            "false_rejections": breakdowns["adversarial"]["false_rejections"],
            "approved": breakdowns["adversarial"]["approved"],
            "withheld": breakdowns["adversarial"]["withheld"],
        },
        "failures": failures,
    }

    with open(RESULTS_FILE, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    print(f"Benchmark completed: {len(cases)} cases evaluated.")
    print(f"  False approvals: {total_false_approvals} (Baseline: {breakdowns['baseline']['false_approvals']}, Adversarial: {breakdowns['adversarial']['false_approvals']})")
    print(f"  False rejections: {total_false_rejections} (Baseline: {breakdowns['baseline']['false_rejections']}, Adversarial: {breakdowns['adversarial']['false_rejections']})")
    if failures:
        print("\nFailures:")
        for f in failures:
            print(f"  [{f['type']}] ({f['set']}) {f['id']}: category={f['category']} verdict={f['verdict']}")

    return results


if __name__ == "__main__":
    res = run_benchmark()
    if res["false_approvals"] > 0:
        sys.exit(1)
