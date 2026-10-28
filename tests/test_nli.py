"""Unit tests for the NLI module (app.extraction.nli).

Tests mock the ONNX session and tokenizer so tests run fast and offline
without requiring model weight downloads.
"""
import math
import numpy as np
import pytest
from unittest.mock import MagicMock

from app.extraction.nli import NliClassifier, NliConfig, NliResult


class MockInput:
    def __init__(self, name: str):
        self.name = name


class MockEncoding:
    def __init__(self, length: int = 10):
        self.ids = list(range(length))
        self.attention_mask = [1] * length
        self.type_ids = [0] * length


class MockTokenizer:
    def __init__(self, token_count: int = 10):
        self.token_count = token_count
        self.calls = []
        self.max_length = 256

    def enable_truncation(self, max_length: int):
        self.max_length = max_length

    def encode(self, premise: str, hypothesis: str):
        self.calls.append((premise, hypothesis))
        # If input is very long, simulate high token count
        length = self.token_count
        if len(premise) > 1000 or len(hypothesis) > 1000:
            length = 500
        return MockEncoding(min(length, self.max_length) if len(self.calls) > 1 else length)


class MockSession:
    def __init__(self, logits=None, input_names=None):
        self.logits = logits if logits is not None else [[-2.0, 3.0, -1.0]]
        self.input_names = input_names or ["input_ids", "attention_mask"]
        self.run_calls = []

    def get_inputs(self):
        return [MockInput(name) for name in self.input_names]

    def run(self, output_names, input_feed):
        self.run_calls.append(input_feed)
        return [np.array(self.logits, dtype=np.float32)]


@pytest.fixture
def classifier():
    config = NliConfig(
        enabled=True,
        max_length=256,
        max_input_chars=2000,
        entailment_threshold=0.70,
        contradiction_threshold=0.60,
    )
    # id2label for cross-encoder/nli-MiniLM2-L6-H768: 0=contradiction, 1=entailment, 2=neutral
    id2label = {0: "contradiction", 1: "entailment", 2: "neutral"}
    session = MockSession(logits=[[-2.0, 3.0, -1.0]])
    tokenizer = MockTokenizer()
    return NliClassifier(config=config, session=session, tokenizer=tokenizer, id2label=id2label)


def test_evidence_claim_ordering(classifier):
    """Premise must be the evidence and hypothesis must be the claim."""
    evidence = "Clinical trial showed 30% reduction in symptoms."
    claim = "Symptoms were reduced by 30%."

    res = classifier.classify(evidence_text=evidence, claim_text=claim)
    assert res.available is True

    # Check that tokenizer was called with (premise=evidence, hypothesis=claim)
    first_call = classifier._tokenizer.calls[0]
    assert first_call[0] == evidence
    assert first_call[1] == claim


def test_label_mapping_entailment(classifier):
    """Logits favoring index 1 should predict entailment."""
    # Index 1 is entailment in cross-encoder/nli-MiniLM2-L6-H768
    classifier._session.logits = [[-3.0, 5.0, -2.0]]
    res = classifier.classify("Evidence", "Claim")

    assert res.available is True
    assert res.predicted_label == "entailment"
    assert res.entailment_score > 0.95
    assert res.contradiction_score < 0.05
    assert res.neutral_score < 0.05
    assert math.isclose(res.entailment_score + res.neutral_score + res.contradiction_score, 1.0, abs_tol=1e-4)


def test_label_mapping_contradiction(classifier):
    """Logits favoring index 0 should predict contradiction."""
    classifier._session.logits = [[5.0, -3.0, -2.0]]
    res = classifier.classify("Evidence", "Claim")

    assert res.available is True
    assert res.predicted_label == "contradiction"
    assert res.contradiction_score > 0.95


def test_label_mapping_neutral(classifier):
    """Logits favoring index 2 should predict neutral."""
    classifier._session.logits = [[-2.0, -3.0, 5.0]]
    res = classifier.classify("Evidence", "Claim")

    assert res.available is True
    assert res.predicted_label == "neutral"
    assert res.neutral_score > 0.95


def test_softmax_numerical_stability(classifier):
    """Softmax should handle extreme logits without overflow."""
    extreme_logits = np.array([1000.0, 999.0, 990.0])
    probs = classifier._softmax(extreme_logits)

    assert len(probs) == 3
    assert np.all(probs >= 0.0)
    assert np.all(probs <= 1.0)
    assert math.isclose(np.sum(probs), 1.0, abs_tol=1e-6)
    assert probs[0] > probs[1] > probs[2]


def test_softmax_non_finite_rejection(classifier):
    """Softmax must raise ValueError on NaN or Inf."""
    with pytest.raises(ValueError, match="Non-finite"):
        classifier._softmax(np.array([1.0, np.nan, 2.0]))

    with pytest.raises(ValueError, match="Non-finite"):
        classifier._softmax(np.array([np.inf, 1.0, 2.0]))


def test_empty_or_whitespace_input(classifier):
    """Empty or whitespace inputs must return available=False with error."""
    res1 = classifier.classify("", "Claim")
    assert res1.available is False
    assert "empty" in res1.error.lower()

    res2 = classifier.classify("Evidence", "   ")
    assert res2.available is False
    assert "empty" in res2.error.lower()


def test_character_truncation(classifier):
    """Inputs exceeding max_input_chars should be marked truncated."""
    long_evidence = "word " * 600  # 3000 chars > 2000 limit
    res = classifier.classify(long_evidence, "Normal claim")

    assert res.available is True
    assert res.truncated is True
    assert res.warning is not None
    assert "truncated" in res.warning.lower()


def test_sequence_token_truncation():
    """Inputs exceeding max_length tokens should be marked truncated."""
    config = NliConfig(enabled=True, max_length=128, max_input_chars=5000)
    session = MockSession()
    # MockTokenizer that simulates 200 tokens (which exceeds 128)
    tok = MockTokenizer(token_count=200)
    id2label = {0: "contradiction", 1: "entailment", 2: "neutral"}
    clf = NliClassifier(config=config, session=session, tokenizer=tok, id2label=id2label)

    res = clf.classify("Some evidence", "Some claim")
    assert res.available is True
    assert res.truncated is True


def test_inference_exception_handling(classifier):
    """Exceptions raised during inference must be caught and handled safely."""
    classifier._session.run = MagicMock(side_effect=RuntimeError("GPU OOM or CPU fault"))

    res = classifier.classify("Evidence", "Claim")
    assert res.available is False
    assert "RuntimeError" in res.error


def test_disabled_model():
    """When disabled, classify returns available=False without loading."""
    config = NliConfig(enabled=False)
    clf = NliClassifier(config=config)

    assert clf.is_available is False
    res = clf.classify("Evidence", "Claim")
    assert res.available is False


def test_missing_model_files():
    """Non-existent files fail safely when loading."""
    config = NliConfig(
        enabled=True,
        model_path="nonexistent_dir/model.onnx",
        tokenizer_path="nonexistent_dir/tokenizer.json",
    )
    clf = NliClassifier(config=config)

    assert clf.load() is False
    assert clf.is_available is False
    res = clf.classify("Evidence", "Claim")
    assert res.available is False
    assert "not found" in res.error.lower()
