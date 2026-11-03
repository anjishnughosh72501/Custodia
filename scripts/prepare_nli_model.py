"""Preparation and verification script for Custodia's lightweight NLI models.

Supported Model Registry:
1. cross-encoder/nli-MiniLM2-L6-H768 (legacy default, ~79 MB ONNX)
2. cross-encoder/nli-deberta-v3-xsmall (pruned & INT8 quantized, ~45.6 MB ONNX)

Downloads/verifies pinned files with SHA-256 checksums and performs a data-driven
smoke test ensuring label mappings, tokenizer, and optional id_map remap correctly.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import logging
import os
import sys
from pathlib import Path
from typing import Any, Dict, Optional
import httpx
import numpy as np

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("prepare_nli")

DEFAULT_RELEASE_BASE_URL = os.getenv(
    "CUSTODIA_NLI_RELEASE_URL",
    "https://github.com/anjishnughosh72501/Custodia/releases/download/v0.3.0-nli-xsmall"
)

REGISTRY: Dict[str, Dict[str, Any]] = {
    "cross-encoder/nli-MiniLM2-L6-H768": {
        "model_id": "cross-encoder/nli-MiniLM2-L6-H768",
        "pinned_revision": "b95119ce93d3e065de6214e38cd4a97b0f2f2c6d",
        "license": "Apache-2.0",
        "source": "huggingface",
        "base_url": "https://huggingface.co/cross-encoder/nli-MiniLM2-L6-H768/resolve/b95119ce93d3e065de6214e38cd4a97b0f2f2c6d",
        "has_id_map": False,
        "files": {
            "config.json": {
                "subpath": "config.json",
                "expected_sha256": "8b0e41caff7567c0f53e6983f35591c3dec59507c9173ab125c5823394fb57f3",
            },
            "tokenizer.json": {
                "subpath": "tokenizer.json",
                "expected_sha256": "82139106e603ee4e1d5bc99d056ccbed5a92bc24848b1b5a7137c26e00d0dbf6",
            },
            "special_tokens_map.json": {
                "subpath": "special_tokens_map.json",
                "expected_sha256": None,
            },
            "model_int8.onnx": {
                "subpath": "onnx/model_quint8_avx2.onnx",
                "expected_sha256": "44391a5241a62e0083c1a8899a71e69a092b95aea5ba89e14062925468eceac7",
            },
        },
    },
    "cross-encoder/nli-deberta-v3-xsmall": {
        "model_id": "cross-encoder/nli-deberta-v3-xsmall",
        "pinned_revision": "a150876415327c80daeff35ca6f68f5ed8cf5c24",
        "license": "Apache-2.0",
        "source": "release_asset",
        "base_url": DEFAULT_RELEASE_BASE_URL,
        "has_id_map": True,
        "files": {
            "model_int8.onnx": {
                "subpath": "model_int8.onnx",
                "expected_sha256": "639d27093342659208d4f830916b4b129347d7428308f3a1ab6f9a023f042ec0",
            },
            "id_map.npy": {
                "subpath": "id_map.npy",
                "expected_sha256": "c2b27e668b4a237ca6f4c232d70c7fc33a2fdca6570ec0ad02f70870b3819b37",
            },
            "config.json": {
                "subpath": "config.json",
                "expected_sha256": "c1453671f3b642b6f7636043c3433dd19c1da82e91c067c89534fb4772deb987",
            },
            "tokenizer.json": {
                "subpath": "tokenizer.json",
                "expected_sha256": "2c070ff353c36f85e20919da787a30e1e8e52b626d0e026e044f373378f6d0bf",
            },
        },
    },
}


def compute_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(1024 * 1024):
            h.update(chunk)
    return h.hexdigest()


def download_or_verify(
    url: str,
    dest: Path,
    expected_sha: Optional[str] = None,
    force: bool = False,
):
    if dest.exists() and not force:
        actual_sha = compute_sha256(dest)
        if expected_sha is None or actual_sha == expected_sha:
            log.info("File %s exists and SHA-256 matches (%s).", dest.name, actual_sha[:10])
            return
        log.warning("File %s exists but SHA-256 mismatch (%s != %s). Re-downloading...", dest.name, actual_sha[:10], expected_sha[:10] if expected_sha else "None")

    dest.parent.mkdir(parents=True, exist_ok=True)
    log.info("Downloading %s from %s ...", dest.name, url)
    with httpx.stream("GET", url, follow_redirects=True, timeout=120.0) as r:
        r.raise_for_status()
        with open(dest, "wb") as f:
            for chunk in r.iter_bytes(chunk_size=1024 * 1024):
                f.write(chunk)

    actual_sha = compute_sha256(dest)
    if expected_sha and actual_sha != expected_sha:
        raise ValueError(f"Checksum mismatch for {dest.name}! Expected: {expected_sha}, Got: {actual_sha}")
    log.info("Successfully verified %s (sha256=%s, size=%.2f MB)", dest.name, actual_sha, dest.stat().st_size / (1024 * 1024))


def smoke_test(model_dir: Path):
    """Data-driven smoke test verifying tokenizer, id_map (if present), session, and label orders."""
    import onnxruntime as ort
    from tokenizers import Tokenizer

    config_path = model_dir / "config.json"
    tok_path = model_dir / "tokenizer.json"
    onnx_path = model_dir / "model_int8.onnx"
    id_map_path = model_dir / "id_map.npy"

    with open(config_path, "r", encoding="utf-8") as f:
        config = json.load(f)

    # Read id2label data-driven
    raw_id2label = config.get("id2label", {})
    id2label = {int(k): str(v).lower() for k, v in raw_id2label.items()}
    log.info("Data-driven id2label from config: %s", id2label)

    # Ensure required labels exist
    required = {"entailment", "neutral", "contradiction"}
    assert required.issubset(set(id2label.values())), f"Missing NLI labels in id2label: {id2label}"

    # Load id_map if present
    id_map = None
    if id_map_path.is_file():
        id_map = np.load(str(id_map_path))
        log.info("Loaded id_map from %s (shape=%s)", id_map_path.name, id_map.shape)

    log.info("Loading tokenizer from %s ...", tok_path)
    tok = Tokenizer.from_file(str(tok_path))
    tok.enable_truncation(max_length=256)

    log.info("Creating ONNX Runtime CPU session from %s ...", onnx_path)
    session = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
    expected_inputs = [i.name for i in session.get_inputs()]

    test_cases = [
        ("Evidence: sales grew by 25%.", "Sales increased by 25%.", "entailment"),
        ("Evidence: sales grew by 25%.", "Sales decreased by 25%.", "contradiction"),
        ("Evidence: sales grew by 25%.", "Customer ratings rose significantly.", "neutral"),
    ]

    for premise, hypothesis, expected in test_cases:
        enc = tok.encode(premise, hypothesis)
        raw_ids = np.array(enc.ids, dtype=np.int64)

        if id_map is not None:
            map_len = len(id_map)
            unk_token_id = 3
            if hasattr(tok, "token_to_id"):
                tok_unk = tok.token_to_id("[UNK]")
                if tok_unk is not None:
                    unk_token_id = tok_unk
            unk_mapped = int(id_map[unk_token_id]) if 0 <= unk_token_id < map_len else 0
            valid_mask = (raw_ids >= 0) & (raw_ids < map_len)
            remapped = np.full_like(raw_ids, unk_mapped, dtype=np.int64)
            remapped[valid_mask] = id_map[raw_ids[valid_mask]]
            input_ids = np.array([remapped], dtype=np.int64)
        else:
            input_ids = np.array([raw_ids], dtype=np.int64)

        feed = {
            "input_ids": input_ids,
            "attention_mask": np.array([enc.attention_mask], dtype=np.int64),
        }
        if "token_type_ids" in expected_inputs:
            feed["token_type_ids"] = np.array([enc.type_ids], dtype=np.int64)

        logits = session.run(None, feed)[0][0]
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
    parser.add_argument(
        "--model",
        default=os.getenv("CUSTODIA_NLI_MODEL_ID", "cross-encoder/nli-MiniLM2-L6-H768"),
        choices=list(REGISTRY.keys()),
        help="Target model ID from registry",
    )
    parser.add_argument("--dir", default="models", help="Target directory for model artifacts")
    parser.add_argument("--release-url", default=None, help="Base URL for release assets (for models with release_asset source)")
    parser.add_argument("--force", action="store_true", help="Force re-download even if files exist")
    args = parser.parse_args()

    entry = REGISTRY[args.model]
    target_dir = Path(args.dir)
    target_dir.mkdir(parents=True, exist_ok=True)

    base_url = args.release_url or entry["base_url"]

    log.info("Preparing NLI model '%s' (revision: %s)", entry["model_id"], entry["pinned_revision"])

    for filename, finfo in entry["files"].items():
        dest = target_dir / filename
        subpath = finfo["subpath"]
        url = f"{base_url}/{subpath}"
        download_or_verify(url, dest, finfo["expected_sha256"], force=args.force)

    smoke_test(target_dir)

    metadata = {
        "model_id": entry["model_id"],
        "revision": entry["pinned_revision"],
        "license": entry["license"],
        "has_id_map": entry["has_id_map"],
        "files": {
            fname: {
                "sha256": compute_sha256(target_dir / fname),
                "size_bytes": (target_dir / fname).stat().st_size,
            }
            for fname in entry["files"]
            if (target_dir / fname).exists()
        },
    }
    meta_path = target_dir / "nli_metadata.json"
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    log.info("Model preparation complete. Metadata written to %s", meta_path)


if __name__ == "__main__":
    main()
