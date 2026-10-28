"""Preparation and verification script for Custodia's lightweight NLI model.

Model: cross-encoder/nli-MiniLM2-L6-H768
Architecture: RobertaForSequenceClassification (MiniLM2-L6-H768 distilled from RoBERTa-Large)
Revision: b95119ce93d3e065de6214e38cd4a97b0f2f2c6d
License: Apache-2.0
Quantization: INT8 / UINT8 dynamic quantization for CPU inference (~82 MB)

This script downloads the pinned checkpoint files, verifies their SHA-256 checksums,
and performs a local smoke test to verify label mappings and inference accuracy.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import logging
import os
import sys
from pathlib import Path
import httpx
import numpy as np

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("prepare_nli")

MODEL_ID = "cross-encoder/nli-MiniLM2-L6-H768"
PINNED_REVISION = "b95119ce93d3e065de6214e38cd4a97b0f2f2c6d"
LICENSE = "Apache-2.0"
BASE_URL = f"https://huggingface.co/{MODEL_ID}/resolve/{PINNED_REVISION}"

FILES_TO_DOWNLOAD = {
    "config.json": {
        "url": f"{BASE_URL}/config.json",
        "expected_sha256": "8b0e41caff7567c0f53e6983f35591c3dec59507c9173ab125c5823394fb57f3",
    },
    "tokenizer.json": {
        "url": f"{BASE_URL}/tokenizer.json",
        "expected_sha256": "82139106e603ee4e1d5bc99d056ccbed5a92bc24848b1b5a7137c26e00d0dbf6",
    },
    "special_tokens_map.json": {
        "url": f"{BASE_URL}/special_tokens_map.json",
        "expected_sha256": None,
    },
    "model_int8.onnx": {
        "url": f"{BASE_URL}/onnx/model_quint8_avx2.onnx",
        "expected_sha256": "44391a5241a62e0083c1a8899a71e69a092b95aea5ba89e14062925468eceac7",
    },
}


def compute_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(1024 * 1024):
            h.update(chunk)
    return h.hexdigest()


def download_file(url: str, dest: Path, expected_sha: str | None = None, force: bool = False):
    if dest.exists() and not force:
        actual_sha = compute_sha256(dest)
        if expected_sha is None or actual_sha == expected_sha:
            log.info("File %s already exists and hash matches (%s).", dest.name, actual_sha[:10])
            return
        log.warning("File %s exists but hash mismatch. Re-downloading...", dest.name)

    dest.parent.mkdir(parents=True, exist_ok=True)
    log.info("Downloading %s from %s ...", dest.name, url)
    with httpx.stream("GET", url, follow_redirects=True, timeout=120.0) as r:
        r.raise_for_status()
        with open(dest, "wb") as f:
            for chunk in r.iter_bytes(chunk_size=1024 * 1024):
                f.write(chunk)

    actual_sha = compute_sha256(dest)
    if expected_sha and actual_sha != expected_sha:
        raise ValueError(
            f"Checksum mismatch for {dest.name}! Expected: {expected_sha}, Got: {actual_sha}"
        )
    log.info("Successfully saved %s (sha256=%s, size=%.2f MB)",
             dest.name, actual_sha, dest.stat().st_size / (1024 * 1024))


def smoke_test(model_dir: Path):
    import onnxruntime as ort
    from tokenizers import Tokenizer

    config_path = model_dir / "config.json"
    tok_path = model_dir / "tokenizer.json"
    onnx_path = model_dir / "model_int8.onnx"

    with open(config_path, "r", encoding="utf-8") as f:
        config = json.load(f)

    id2label = {int(k): v for k, v in config.get("id2label", {}).items()}
    log.info("Verified id2label from config: %s", id2label)
    assert id2label.get(0) == "contradiction", f"Expected label 0 to be contradiction, got {id2label.get(0)}"
    assert id2label.get(1) == "entailment", f"Expected label 1 to be entailment, got {id2label.get(1)}"
    assert id2label.get(2) == "neutral", f"Expected label 2 to be neutral, got {id2label.get(2)}"

    log.info("Loading tokenizer from %s ...", tok_path)
    tok = Tokenizer.from_file(str(tok_path))
    tok.enable_truncation(max_length=256)

    log.info("Creating ONNX Runtime CPU session from %s ...", onnx_path)
    session = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])

    test_cases = [
        ("Evidence: sales grew by 25%.", "Sales increased by 25%.", "entailment"),
        ("Evidence: sales grew by 25%.", "Sales decreased by 25%.", "contradiction"),
        ("Evidence: sales grew by 25%.", "Customer ratings rose significantly.", "neutral"),
    ]

    for premise, hypothesis, expected in test_cases:
        enc = tok.encode(premise, hypothesis)
        inputs = {
            "input_ids": np.array([enc.ids], dtype=np.int64),
            "attention_mask": np.array([enc.attention_mask], dtype=np.int64),
        }
        logits = session.run(None, inputs)[0][0]
        exp_l = np.exp(logits - np.max(logits))
        probs = exp_l / exp_l.sum()
        pred_idx = int(np.argmax(probs))
        pred_label = id2label[pred_idx]
        log.info("Smoke test: '%s' vs '%s' => %s (prob=%.4f) [Expected: %s]",
                 premise, hypothesis, pred_label, probs[pred_idx], expected)
        assert pred_label == expected, f"Smoke test failed! Expected {expected}, got {pred_label}"

    log.info("All smoke tests passed successfully!")


def main():
    parser = argparse.ArgumentParser(description="Prepare quantized NLI model for Custodia")
    parser.add_argument("--dir", default="models", help="Target directory for model artifacts")
    parser.add_argument("--force", action="store_true", help="Force re-download even if files exist")
    args = parser.parse_args()

    target_dir = Path(args.dir)
    target_dir.mkdir(parents=True, exist_ok=True)

    log.info("Preparing NLI model from %s (revision: %s)", MODEL_ID, PINNED_REVISION)

    for filename, info in FILES_TO_DOWNLOAD.items():
        dest = target_dir / filename
        download_file(info["url"], dest, info["expected_sha256"], force=args.force)

    smoke_test(target_dir)

    metadata = {
        "model_id": MODEL_ID,
        "revision": PINNED_REVISION,
        "license": LICENSE,
        "base_model": "nreimers/MiniLMv2-L6-H768-distilled-from-RoBERTa-Large",
        "quantization": "dynamic_int8_avx2",
        "label_mapping": {"0": "contradiction", "1": "entailment", "2": "neutral"},
        "files": {
            fname: {
                "sha256": compute_sha256(target_dir / fname),
                "size_bytes": (target_dir / fname).stat().st_size,
            }
            for fname in FILES_TO_DOWNLOAD
        },
    }
    with open(target_dir / "nli_metadata.json", "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    log.info("Model preparation complete. Metadata written to %s", target_dir / "nli_metadata.json")


if __name__ == "__main__":
    main()
