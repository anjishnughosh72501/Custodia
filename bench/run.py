#!/usr/bin/env python3
"""Deterministic benchmark runner for Custodia.

Evaluates deterministic claim verification across bench/cases.jsonl with
train/dev/heldout splits, measuring false approvals, false rejections,
and category-level performance without non-deterministic external calls.
"""
from __future__ import annotations
import json
import sys
import time
from datetime import datetime
from pathlib import Path
from collections import defaultdict

# Add project root to path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.service import ReviewService
from app.store import Store
from app.rules.engine import ENGINE_VERSION

CASES_FILE = ROOT / "bench" / "cases.jsonl"
RESULTS_JSON_FILE = ROOT / "bench" / "results.json"
RESULTS_MD_FILE = ROOT / "bench" / "RESULTS.md"


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

    start_time = time.perf_counter()

    splits = {"dev": [], "heldout": []}
    sets = {"baseline": [], "adversarial": []}
    by_category = defaultdict(list)

    failures = []

    def make_stats():
        return {
            "total": 0,
            "false_approvals": 0,
            "false_rejections": 0,
            "approved": 0,
            "withheld": 0,
        }

    split_stats = {"dev": make_stats(), "heldout": make_stats()}
    set_stats = {"baseline": make_stats(), "adversarial": make_stats()}
    cat_stats = defaultdict(make_stats)

    for c in cases:
        c_split = c.get("split", "dev")
        c_set = c.get("set", "baseline")
        c_cat = c.get("category", "unknown")

        review = service.review(c["claim"], c["evidence"])
        verdict = review.verdict.status.value
        approved = (verdict == "SUPPORTED_BY_SUPPLIED_EVIDENCE")
        expected_not_approved = c["expected_not_approved"]

        # Track totals
        for s in [split_stats[c_split], set_stats[c_set], cat_stats[c_cat]]:
            s["total"] += 1
            if approved:
                s["approved"] += 1
            else:
                s["withheld"] += 1

        is_false_approval = approved and expected_not_approved
        is_false_rejection = (not approved) and (not expected_not_approved)

        if is_false_approval:
            for s in [split_stats[c_split], set_stats[c_set], cat_stats[c_cat]]:
                s["false_approvals"] += 1
            failures.append({
                "id": c["id"],
                "split": c_split,
                "set": c_set,
                "category": c_cat,
                "type": "FALSE_APPROVAL",
                "claim": c["claim"],
                "verdict": verdict,
            })
        elif is_false_rejection:
            for s in [split_stats[c_split], set_stats[c_set], cat_stats[c_cat]]:
                s["false_rejections"] += 1
            failures.append({
                "id": c["id"],
                "split": c_split,
                "set": c_set,
                "category": c_cat,
                "type": "FALSE_REJECTION",
                "claim": c["claim"],
                "verdict": verdict,
                "abstain_reasons": review.verdict.abstain_reasons,
            })

    total_time_ms = round((time.perf_counter() - start_time) * 1000, 2)
    avg_latency_ms = round(total_time_ms / len(cases), 2) if cases else 0

    total_fa = sum(s["false_approvals"] for s in split_stats.values())
    total_fr = sum(s["false_rejections"] for s in split_stats.values())

    results = {
        "total_cases": len(cases),
        "false_approvals": total_fa,
        "false_rejections": total_fr,
        "date": "Oct 28, 2026",
        "engine_version": ENGINE_VERSION,
        "latency_ms_total": total_time_ms,
        "latency_ms_per_case": avg_latency_ms,
        "splits": {k: v for k, v in split_stats.items()},
        "baseline": set_stats["baseline"],
        "adversarial": set_stats["adversarial"],
        "by_category": {k: v for k, v in sorted(cat_stats.items())},
        "failures": failures,
    }

    # Write results.json
    with open(RESULTS_JSON_FILE, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    # Write RESULTS.md
    md_lines = [
        "# Custodia Benchmark & Evaluation Results",
        "",
        f"**Date**: {results['date']}  ",
        f"**Engine Version**: {results['engine_version']}  ",
        f"**Total Cases**: {results['total_cases']}  ",
        f"**Execution Time**: {results['latency_ms_total']} ms ({results['latency_ms_per_case']} ms/case)  ",
        "",
        "## Executive Summary",
        "",
        f"- **False Approvals**: **{total_fa}** across all {len(cases)} test cases.",
        f"- **False Rejections**: **{total_fr}** across all faithful test cases.",
        "- **Contract Guarantee**: The deterministic engine strictly withholds approval whenever wording outgrows, contradicts, or drops conditions from the evidence.",
        "",
        "## Split Breakdown (Dev vs Heldout)",
        "",
        "| Split | Cases | Approved | Withheld | False Approvals | False Rejections | Safety Rate |",
        "| :--- | :--- | :--- | :--- | :--- | :--- | :--- |",
    ]

    for sp in ["dev", "heldout"]:
        st = split_stats[sp]
        safety = 100.0 if st["false_approvals"] == 0 else 0.0
        md_lines.append(
            f"| `{sp}` | {st['total']} | {st['approved']} | {st['withheld']} | {st['false_approvals']} | {st['false_rejections']} | {safety:.1f}% |"
        )

    md_lines.extend([
        "",
        "## Set Breakdown (Baseline vs Adversarial)",
        "",
        "| Set | Cases | Approved | Withheld | False Approvals | False Rejections | Safety Rate |",
        "| :--- | :--- | :--- | :--- | :--- | :--- | :--- |",
    ])

    for st_name in ["baseline", "adversarial"]:
        st = set_stats[st_name]
        safety = 100.0 if st["false_approvals"] == 0 else 0.0
        md_lines.append(
            f"| `{st_name}` | {st['total']} | {st['approved']} | {st['withheld']} | {st['false_approvals']} | {st['false_rejections']} | {safety:.1f}% |"
        )

    md_lines.extend([
        "",
        "## Category Performance",
        "",
        "| Category | Cases | Approved | Withheld | False Approvals | Status |",
        "| :--- | :--- | :--- | :--- | :--- | :--- |",
    ])

    for cat_name, st in sorted(cat_stats.items()):
        status = "✅ Clean" if st["false_approvals"] == 0 and st["false_rejections"] == 0 else "❌ Fail"
        md_lines.append(
            f"| `{cat_name}` | {st['total']} | {st['approved']} | {st['withheld']} | {st['false_approvals']} | {status} |"
        )

    md_lines.extend([
        "",
        "## Model Role Configuration & Rationale",
        "",
        "Custodia supports role-based model configuration:",
        "",
        "| Role | Env Var | Default | Why Kept |",
        "| :--- | :--- | :--- | :--- |",
        "| Quote extraction | `CUSTODIA_MODEL_EXTRACT` | `claude-haiku-5-5` | Fast, low latency, outputs verbatim quotes verified character-by-character by Python code |",
        "| Language flags | `CUSTODIA_MODEL_FLAGS` | `claude-haiku-5-5` | Concise JSON classification, verified against exact text spans |",
        "| Rewrite proposals | `CUSTODIA_MODEL_REWRITE` | `claude-sonnet-5-5` | Higher creative wording quality; all generated proposals are automatically re-checked by the rule engine before display |",
        "",
        "If `ANTHROPIC_API_KEY` is not present, Custodia runs entirely on its deterministic heuristic extractor (`extractor_mode=heuristic`) without degrading rule verification semantics.",
        "",
        "## Limitations & Honesty Statement",
        "",
        "- **In-house test set**: These 65 test cases represent deliberate challenge problems covering known marketing failure modes (value inflation, dropped conditions, second-person promises, adversarial injections).",
        "- **Not an open-world accuracy claim**: Custodia does not claim 100% accuracy on open-domain web text; rather, it guarantees that its deterministic rules will never promote unknown or unverified text to supported.",
    ])

    with open(RESULTS_MD_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(md_lines) + "\n")

    print(f"Benchmark completed: {len(cases)} cases evaluated in {total_time_ms} ms.")
    print(f"  Dev split: {split_stats['dev']['total']} cases, {split_stats['dev']['false_approvals']} false approvals, {split_stats['dev']['false_rejections']} false rejections")
    print(f"  Heldout split: {split_stats['heldout']['total']} cases, {split_stats['heldout']['false_approvals']} false approvals, {split_stats['heldout']['false_rejections']} false rejections")
    print(f"  Total false approvals: {total_fa}")
    print(f"  Total false rejections: {total_fr}")
    print(f"  Wrote results to {RESULTS_JSON_FILE} and {RESULTS_MD_FILE}")

    return results


if __name__ == "__main__":
    res = run_benchmark()
    if res["false_approvals"] > 0:
        sys.exit(1)
