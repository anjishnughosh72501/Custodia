"""Reproducible benchmark and validation script for Custodia's NLI model.

Evaluates the quantized INT8 ONNX checkpoint (cross-encoder/nli-MiniLM2-L6-H768)
on CPU inference for:
1. Model loading latency and memory footprint (RSS)
2. Per-pair inference latency (median, mean, min, max, p95)
3. Peak resident set size (RSS)
4. Classification accuracy and confusion matrix against ground truth labels
5. Truncation rate and failure rate

Usage:
    python scripts/benchmark_nli.py
    python scripts/benchmark_nli.py --dataset bench/nli_benchmark_cases.json
"""
from __future__ import annotations
import argparse
import json
import logging
import os
import sys
import time
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List
import numpy as np

# Ensure app is importable
REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from app.extraction.nli import NliClassifier, NliConfig

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("nli_benchmark")


def get_current_rss_mb() -> float:
    try:
        import psutil
        return psutil.Process(os.getpid()).memory_info().rss / (1024 * 1024)
    except ImportError:
        return 0.0


def run_benchmark(
    dataset_path: Path,
    model_path: Path,
    tokenizer_path: Path,
    config_path: Path,
    output_path: Path,
    repeats: int = 3,
) -> Dict[str, Any]:
    log.info("Loading benchmark dataset from: %s", dataset_path)
    with open(dataset_path, "r", encoding="utf-8") as f:
        cases = json.load(f)

    log.info("Total test cases: %d", len(cases))

    # 1. Measure baseline memory
    base_rss = get_current_rss_mb()

    # 2. Measure model load time and post-load memory
    t_load_start = time.perf_counter()
    nli_cfg = NliConfig(
        enabled=True,
        model_path=str(model_path),
        tokenizer_path=str(tokenizer_path),
        config_path=str(config_path),
    )
    clf = NliClassifier(nli_cfg)
    loaded = clf.load()
    if not loaded:
        log.error("Failed to load NLI model! Aborting benchmark.")
        sys.exit(1)

    t_load_ms = (time.perf_counter() - t_load_start) * 1000
    post_load_rss = get_current_rss_mb()

    log.info("Model loaded in %.2f ms | Baseline RSS: %.1f MB | Post-load RSS: %.1f MB (Delta: +%.1f MB)",
             t_load_ms, base_rss, post_load_rss, post_load_rss - base_rss)

    # Warmup
    log.info("Warming up inference engine...")
    for _ in range(3):
        clf.classify("Warmup evidence text for benchmarking.", "Warmup claim text.")

    # 3. Run inference on all cases
    labels = ["entailment", "neutral", "contradiction"]
    matrix = {true_lbl: {pred_lbl: 0 for pred_lbl in labels} for true_lbl in labels}

    results: List[Dict[str, Any]] = []
    latencies: List[float] = []
    truncation_count = 0
    failure_count = 0
    correct_count = 0

    log.info("Executing benchmark runs (%d repeat per case)...", repeats)
    for idx, case in enumerate(cases):
        evidence = case["evidence"]
        claim = case["claim"]
        expected = case["expected_label"]

        case_latencies = []
        last_res = None
        for _ in range(repeats):
            t0 = time.perf_counter()
            res = clf.classify(evidence, claim)
            t1 = time.perf_counter()
            case_latencies.append((t1 - t0) * 1000)
            last_res = res

        median_case_lat = float(np.median(case_latencies))
        latencies.extend(case_latencies)

        if not last_res or not last_res.available:
            failure_count += 1
            pred = "ERROR"
        else:
            pred = last_res.predicted_label
            if last_res.truncated:
                truncation_count += 1

        is_correct = (pred == expected)
        if is_correct:
            correct_count += 1

        if expected in matrix and pred in matrix[expected]:
            matrix[expected][pred] += 1

        results.append({
            "id": case.get("id", f"case-{idx}"),
            "category": case.get("category", "general"),
            "expected": expected,
            "predicted": pred,
            "correct": is_correct,
            "entailment_score": round(last_res.entailment_score, 4) if last_res and last_res.entailment_score else None,
            "neutral_score": round(last_res.neutral_score, 4) if last_res and last_res.neutral_score else None,
            "contradiction_score": round(last_res.contradiction_score, 4) if last_res and last_res.contradiction_score else None,
            "latency_ms": round(median_case_lat, 2),
            "truncated": last_res.truncated if last_res else False,
        })

    peak_rss = get_current_rss_mb()

    # Calculate statistics
    total_cases = len(cases)
    accuracy = (correct_count / total_cases) * 100 if total_cases > 0 else 0.0
    truncation_rate = (truncation_count / total_cases) * 100 if total_cases > 0 else 0.0

    # Per-class metrics
    per_class_metrics = {}
    for lbl in labels:
        tp = matrix[lbl][lbl]
        fp = sum(matrix[other][lbl] for other in labels if other != lbl)
        fn = sum(matrix[lbl][other] for other in labels if other != lbl)
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
        per_class_metrics[lbl] = {
            "support": sum(matrix[lbl].values()),
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "f1": round(f1, 4),
        }

    summary = {
        "model_id": clf.config.model_id,
        "revision": clf.config.revision,
        "model_path": str(model_path),
        "total_cases": total_cases,
        "accuracy_pct": round(accuracy, 2),
        "correct_predictions": correct_count,
        "failure_count": failure_count,
        "truncation_count": truncation_count,
        "truncation_rate_pct": round(truncation_rate, 2),
        "memory": {
            "baseline_rss_mb": round(base_rss, 2),
            "post_load_rss_mb": round(post_load_rss, 2),
            "peak_rss_mb": round(peak_rss, 2),
            "model_memory_delta_mb": round(post_load_rss - base_rss, 2),
        },
        "latency_ms": {
            "load_time_ms": round(t_load_ms, 2),
            "min_ms": round(float(np.min(latencies)), 2),
            "median_ms": round(float(np.median(latencies)), 2),
            "mean_ms": round(float(np.mean(latencies)), 2),
            "max_ms": round(float(np.max(latencies)), 2),
            "p95_ms": round(float(np.percentile(latencies, 95)), 2),
        },
        "confusion_matrix": matrix,
        "per_class_metrics": per_class_metrics,
        "results": results,
    }

    # Print Report
    print("\n" + "=" * 65)
    print("           CUSTODIA NLI BENCHMARK REPORT")
    print("=" * 65)
    print(f"Model: {summary['model_id']}")
    print(f"Quantization: INT8 ONNX CPU | Checkpoint size: {model_path.stat().st_size / (1024*1024):.1f} MB")
    print("-" * 65)
    print(f"Total Cases:     {total_cases}")
    print(f"Accuracy:        {accuracy:.2f}% ({correct_count}/{total_cases})")
    print(f"Failures:        {failure_count}")
    print(f"Truncated:       {truncation_count} ({truncation_rate:.1f}%)")
    print("-" * 65)
    print("MEMORY FOOTPRINT (RSS):")
    print(f"  Baseline RSS:          {base_rss:.1f} MB")
    print(f"  Post-Load RSS:         {post_load_rss:.1f} MB (Delta: +{post_load_rss - base_rss:.1f} MB)")
    print(f"  Peak RSS:              {peak_rss:.1f} MB (Headroom vs 512 MB: {512 - peak_rss:.1f} MB)")
    print("-" * 65)
    print("LATENCY (CPU):")
    print(f"  Model Load:            {t_load_ms:.1f} ms")
    print(f"  Per-Pair Min:          {summary['latency_ms']['min_ms']:.2f} ms")
    print(f"  Per-Pair Median:       {summary['latency_ms']['median_ms']:.2f} ms")
    print(f"  Per-Pair Mean:         {summary['latency_ms']['mean_ms']:.2f} ms")
    print(f"  Per-Pair P95:          {summary['latency_ms']['p95_ms']:.2f} ms")
    print("-" * 65)
    print("CONFUSION MATRIX:")
    print("                 Pred: Entailment | Neutral | Contradiction")
    for true_lbl in labels:
        row = matrix[true_lbl]
        print(f"  True {true_lbl:13s}: {row['entailment']:10d} | {row['neutral']:7d} | {row['contradiction']:13d}")
    print("-" * 65)
    print("PER-CLASS METRICS:")
    for lbl in labels:
        m = per_class_metrics[lbl]
        print(f"  {lbl:14s} -> Support: {m['support']:2d} | Precision: {m['precision']:.3f} | Recall: {m['recall']:.3f} | F1: {m['f1']:.3f}")
    print("=" * 65 + "\n")

    # Save output
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
    log.info("Full benchmark results saved to: %s", output_path)

    return summary


def main():
    parser = argparse.ArgumentParser(description="Custodia NLI Benchmark Suite")
    parser.add_argument("--dataset", default=str(REPO_ROOT / "bench" / "nli_benchmark_cases.json"))
    parser.add_argument("--model-path", default=str(REPO_ROOT / "models" / "model_int8.onnx"))
    parser.add_argument("--tokenizer-path", default=str(REPO_ROOT / "models" / "tokenizer.json"))
    parser.add_argument("--config-path", default=str(REPO_ROOT / "models" / "config.json"))
    parser.add_argument("--output", default=str(REPO_ROOT / "bench" / "nli_benchmark_results.json"))
    parser.add_argument("--repeats", type=int, default=3)
    args = parser.parse_args()

    run_benchmark(
        dataset_path=Path(args.dataset),
        model_path=Path(args.model_path),
        tokenizer_path=Path(args.tokenizer_path),
        config_path=Path(args.config_path),
        output_path=Path(args.output),
        repeats=args.repeats,
    )


if __name__ == "__main__":
    main()
