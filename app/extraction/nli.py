"""Lightweight Natural Language Inference (NLI) module for Custodia.

Uses an ONNX INT8 quantized cross-encoder model (cross-encoder/nli-MiniLM2-L6-H768)
via ONNX Runtime CPU inference and tokenizers for fast, lightweight inference within
strict memory limits (~150 MB total RSS).

Safety Rules:
- Evidence is always the premise; marketing claim is always the hypothesis.
- NLI outputs are semantic diagnostics, never the final authority on claim truth.
- Deterministic rules maintain authoritative control over final verdicts.
- Model failure, truncation, or absence fails conservatively to rule-based evaluation.
"""
from __future__ import annotations
import json
import logging
import math
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional
import numpy as np

log = logging.getLogger("custodia.nli")

DEFAULT_MODEL_ID = "cross-encoder/nli-MiniLM2-L6-H768"
DEFAULT_REVISION = "b95119ce93d3e065de6214e38cd4a97b0f2f2c6d"
DEFAULT_LICENSE = "Apache-2.0"


def _get_env(key: str, default: Optional[str] = None) -> Optional[str]:
    """Helper to read CUSTODIA_* or fallback SCOPELOCK_* environment variables."""
    return os.getenv(f"CUSTODIA_{key}", os.getenv(f"SCOPELOCK_{key}", default))


@dataclass
class NliConfig:
    enabled: bool = False
    model_path: str = "models/model_int8.onnx"
    tokenizer_path: str = "models/tokenizer.json"
    config_path: str = "models/config.json"
    model_id: str = DEFAULT_MODEL_ID
    revision: str = DEFAULT_REVISION
    max_length: int = 256
    max_input_chars: int = 2000
    entailment_threshold: float = 0.70
    contradiction_threshold: float = 0.60

    @classmethod
    def from_env(cls) -> NliConfig:
        env_enabled = _get_env("NLI_ENABLED", "0").strip().lower() in ("1", "true", "yes", "on")
        return cls(
            enabled=env_enabled,
            model_path=_get_env("NLI_MODEL_PATH", "models/model_int8.onnx"),
            tokenizer_path=_get_env("NLI_TOKENIZER_PATH", "models/tokenizer.json"),
            config_path=_get_env("NLI_CONFIG_PATH", "models/config.json"),
            max_length=int(_get_env("NLI_MAX_LENGTH", "256")),
            max_input_chars=int(_get_env("NLI_MAX_INPUT_CHARS", "2000")),
            entailment_threshold=float(_get_env("NLI_ENTAILMENT_THRESHOLD", "0.70")),
            contradiction_threshold=float(_get_env("NLI_CONTRADICTION_THRESHOLD", "0.60")),
        )


@dataclass
class NliResult:
    available: bool
    model_id: str
    predicted_label: Optional[str] = None  # "entailment" | "neutral" | "contradiction"
    entailment_score: Optional[float] = None
    neutral_score: Optional[float] = None
    contradiction_score: Optional[float] = None
    truncated: bool = False
    execution_time_ms: Optional[float] = None
    error: Optional[str] = None
    warning: Optional[str] = None

    def to_diagnostic_dict(self) -> dict[str, Any]:
        return {
            "available": self.available,
            "model_id": self.model_id,
            "predicted_label": self.predicted_label,
            "entailment_score": round(self.entailment_score, 4) if self.entailment_score is not None else None,
            "neutral_score": round(self.neutral_score, 4) if self.neutral_score is not None else None,
            "contradiction_score": round(self.contradiction_score, 4) if self.contradiction_score is not None else None,
            "truncated": self.truncated,
            "latency_ms": round(self.execution_time_ms, 2) if self.execution_time_ms is not None else None,
        }


class NliClassifier:
    """Manages tokenizer, ONNX session, and execution for 3-class NLI inference."""

    def __init__(
        self,
        config: Optional[NliConfig] = None,
        session: Any = None,
        tokenizer: Any = None,
        id2label: Optional[dict[int, str]] = None,
    ):
        self.config = config or NliConfig()
        self._session = session
        self._tokenizer = tokenizer
        self._id2label = id2label
        self._loaded = session is not None and tokenizer is not None and id2label is not None
        self._load_error: Optional[str] = None

    @property
    def is_available(self) -> bool:
        if not self.config.enabled:
            return False
        if not self._loaded and self._load_error is None:
            self.load()
        return self._loaded

    def load(self) -> bool:
        """Loads tokenizer, config, and ONNX runtime session safely. Returns True if successful."""
        if not self.config.enabled:
            return False

        if self._loaded:
            return True

        t0 = time.perf_counter()
        try:
            # 1. Validate files exist
            model_file = Path(self.config.model_path)
            tok_file = Path(self.config.tokenizer_path)
            cfg_file = Path(self.config.config_path)

            if not model_file.is_file():
                raise FileNotFoundError(f"ONNX model file not found at: {model_file}")
            if not tok_file.is_file():
                raise FileNotFoundError(f"Tokenizer file not found at: {tok_file}")

            # 2. Load label mapping from config.json if present
            if cfg_file.is_file():
                with open(cfg_file, "r", encoding="utf-8") as f:
                    cfg_data = json.load(f)
                    raw_id2label = cfg_data.get("id2label", {})
                    self._id2label = {int(k): str(v).lower() for k, v in raw_id2label.items()}
            else:
                # Default mapping for cross-encoder/nli-MiniLM2-L6-H768
                self._id2label = {0: "contradiction", 1: "entailment", 2: "neutral"}

            # Validate that all 3 required labels exist
            known_labels = set(self._id2label.values())
            required = {"entailment", "neutral", "contradiction"}
            if not required.issubset(known_labels):
                raise ValueError(f"Model label mapping missing required NLI classes. Found: {known_labels}")

            # 3. Load tokenizer
            from tokenizers import Tokenizer
            self._tokenizer = Tokenizer.from_file(str(tok_file))
            self._tokenizer.enable_truncation(max_length=self.config.max_length)

            # 4. Load ONNX Runtime session
            import onnxruntime as ort
            sess_options = ort.SessionOptions()
            sess_options.intra_op_num_threads = 1
            sess_options.inter_op_num_threads = 1
            sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

            self._session = ort.InferenceSession(
                str(model_file),
                sess_options=sess_options,
                providers=["CPUExecutionProvider"],
            )

            load_ms = (time.perf_counter() - t0) * 1000
            self._loaded = True
            log.info("Loaded NLI model from %s in %.1f ms (labels: %s)", model_file, load_ms, self._id2label)
            return True

        except Exception as ex:
            self._load_error = f"{type(ex).__name__}: {ex}"
            self._loaded = False
            log.warning("Failed to load NLI model (%s); continuing with NLI disabled.", self._load_error)
            return False

    def _softmax(self, logits: np.ndarray) -> np.ndarray:
        """Numerically stable softmax with non-finite validation."""
        if not np.all(np.isfinite(logits)):
            raise ValueError(f"Non-finite logits encountered: {logits}")
        shifted = logits - np.max(logits)
        exp_vals = np.exp(shifted)
        sum_exp = np.sum(exp_vals)
        if sum_exp == 0 or not math.isfinite(sum_exp):
            raise ValueError(f"Invalid sum of exponentials in softmax: {sum_exp}")
        return exp_vals / sum_exp

    def classify(self, evidence_text: str, claim_text: str) -> NliResult:
        """Classifies the NLI relationship between evidence (premise) and claim (hypothesis)."""
        if not self.is_available:
            return NliResult(
                available=False,
                model_id=self.config.model_id,
                error=self._load_error or "NLI model not enabled or not loaded",
            )

        # Validate inputs
        if not evidence_text or not evidence_text.strip():
            return NliResult(
                available=False,
                model_id=self.config.model_id,
                error="Evidence text is empty",
            )
        if not claim_text or not claim_text.strip():
            return NliResult(
                available=False,
                model_id=self.config.model_id,
                error="Claim text is empty",
            )

        t_start = time.perf_counter()

        # Check character limit to prevent resource exhaustion
        char_truncated = False
        premise = evidence_text.strip()
        hypothesis = claim_text.strip()

        if len(premise) > self.config.max_input_chars:
            premise = premise[: self.config.max_input_chars]
            char_truncated = True

        if len(hypothesis) > self.config.max_input_chars:
            hypothesis = hypothesis[: self.config.max_input_chars]
            char_truncated = True

        try:
            # Tokenize: premise = evidence, hypothesis = claim
            # Check if sequence truncation occurs
            # We measure un-truncated length by encoding without truncation
            untruncated = self._tokenizer.encode(premise, hypothesis)
            token_truncated = len(untruncated.ids) > self.config.max_length

            # Now encode with truncation enabled
            encoding = untruncated
            if token_truncated:
                self._tokenizer.enable_truncation(max_length=self.config.max_length)
                encoding = self._tokenizer.encode(premise, hypothesis)

            truncated = char_truncated or token_truncated

            # Prepare ONNX inputs
            input_ids = np.array([encoding.ids], dtype=np.int64)
            attention_mask = np.array([encoding.attention_mask], dtype=np.int64)
            inputs = {
                "input_ids": input_ids,
                "attention_mask": attention_mask,
            }

            expected_inputs = [i.name for i in self._session.get_inputs()]
            if "token_type_ids" in expected_inputs:
                inputs["token_type_ids"] = np.array([encoding.type_ids], dtype=np.int64)

            # Run CPU inference
            raw_outputs = self._session.run(None, inputs)
            logits = np.array(raw_outputs[0][0], dtype=np.float64)

            # Softmax
            probs = self._softmax(logits)

            # Map to labels using dynamic id2label
            scores: dict[str, float] = {}
            for idx, p in enumerate(probs):
                label_name = self._id2label.get(idx, f"unknown_{idx}")
                scores[label_name] = float(p)

            pred_idx = int(np.argmax(probs))
            predicted_label = self._id2label.get(pred_idx, "unknown")

            elapsed_ms = (time.perf_counter() - t_start) * 1000

            warning = None
            if truncated:
                warning = (
                    "Input text exceeded the maximum sequence length and was truncated; "
                    "semantic inference may not reflect omitted qualifiers."
                )

            return NliResult(
                available=True,
                model_id=self.config.model_id,
                predicted_label=predicted_label,
                entailment_score=scores.get("entailment", 0.0),
                neutral_score=scores.get("neutral", 0.0),
                contradiction_score=scores.get("contradiction", 0.0),
                truncated=truncated,
                execution_time_ms=elapsed_ms,
                warning=warning,
            )

        except Exception as ex:
            elapsed_ms = (time.perf_counter() - t_start) * 1000
            log.warning("NLI inference failed: %s (%s)", type(ex).__name__, ex)
            return NliResult(
                available=False,
                model_id=self.config.model_id,
                error=f"Inference error: {type(ex).__name__}",
                execution_time_ms=elapsed_ms,
            )
