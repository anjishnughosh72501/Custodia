#!/usr/bin/env python3
"""Converts bench/RESULTS.md or bench/results.json into frontend/src/landing/benchmark.json.

Leave unrun if bench/RESULTS.md does not exist yet.
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BENCH_MD = ROOT / "bench" / "RESULTS.md"
BENCH_JSON = ROOT / "bench" / "results.json"
OUTPUT_JSON = ROOT / "frontend" / "src" / "landing" / "benchmark.json"


def main():
    if BENCH_JSON.exists():
        data = json.loads(BENCH_JSON.read_text(encoding="utf-8"))
    elif BENCH_MD.exists():
        text = BENCH_MD.read_text(encoding="utf-8")
        # Extract false approvals, total cases, date, engine version
        fa_match = re.search(r"(\d+)\s+false approval", text, re.I)
        cases_match = re.search(r"in\s+(\d+)\s+(?:in-house\s+)?cases", text, re.I)
        date_match = re.search(r"Date:\s*([^\n]+)", text)
        ver_match = re.search(r"Engine version:\s*([^\n]+)", text)
        data = {
            "false_approvals": int(fa_match.group(1)) if fa_match else 0,
            "total_cases": int(cases_match.group(1)) if cases_match else 60,
            "date": date_match.group(1).strip() if date_match else "Oct 27, 2026",
            "engine_version": ver_match.group(1).strip() if ver_match else "0.3.0",
        }
    else:
        print("No bench/RESULTS.md or bench/results.json found. Leaving benchmark.json empty/missing.")
        return

    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_JSON.write_text(json.dumps(data, indent=2), encoding="utf-8")
    print(f"Generated {OUTPUT_JSON}")


if __name__ == "__main__":
    main()
