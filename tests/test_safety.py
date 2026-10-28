import pytest
from app.language.risk import analyze_language
from app.models import Status
from app.service import ReviewService
from app.store import Store
from .conftest import EVIDENCE

CRITICAL_ENDINGS = [
    ("", "SUPPORTED_BY_SUPPLIED_EVIDENCE"),
    (" because our AI is smarter.", "NEEDS_HUMAN_REVIEW"),
    (" as a result of switching to us.", "NEEDS_HUMAN_REVIEW"),
    (", proving our product works.", "NEEDS_HUMAN_REVIEW"),
    (", and customers love it.", "NEEDS_HUMAN_REVIEW"),
    (", guaranteeing faster onboarding for you.", "NEEDS_HUMAN_REVIEW"),
    (", so you will save time too.", "NEEDS_HUMAN_REVIEW"),
]


@pytest.mark.parametrize("ending,expected_status", CRITICAL_ENDINGS)
def test_safety_critical_endings(ending, expected_status):
    base = EVIDENCE[:-1] if ending else EVIDENCE
    claim = base + ending
    review = ReviewService(Store(":memory:")).review(claim, EVIDENCE)
    assert review.verdict.status.value == expected_status, (
        f"Ending '{ending}' gave status {review.verdict.status.value}, expected {expected_status}"
    )


def test_causal_and_promise_patterns():
    # bare because
    rs = analyze_language("Median setup fell by 30% because our system is fast.", EVIDENCE)
    assert any(r.category == "CAUSAL" and r.severity == "review" and "because" in r.claim_span.quote for r in rs)

    # as a result of
    rs = analyze_language("Median setup fell by 30% as a result of our tool.", EVIDENCE)
    assert any(r.category == "CAUSAL" and r.severity == "review" for r in rs)

    # gerunds
    for gerund in ("proving our product works", "showing that our system works", "guaranteeing fast setup", "ensuring smooth rollout", "making setup faster"):
        rs = analyze_language(f"Median setup fell by 30%, {gerund}.", EVIDENCE)
        assert any(r.severity == "review" for r in rs), f"Gerund '{gerund}' did not trigger review"

    # second-person future promises
    for promise in ("you will save time", "you'll see results", "your team will onboard faster"):
        rs = analyze_language(f"Median setup fell by 30%, so {promise}.", EVIDENCE)
        assert any(r.severity == "review" for r in rs), f"Promise '{promise}' did not trigger review"


def test_residue_check_unverified_assertion():
    claim = EVIDENCE[:-1] + ", and customers love it."
    rs = analyze_language(claim, EVIDENCE)
    unverified = [r for r in rs if r.category == "UNVERIFIED_ASSERTION"]
    assert len(unverified) == 1
    r = unverified[0]
    assert r.severity == "review"
    assert r.claim_span is not None
    assert claim[r.claim_span.start:r.claim_span.end] == r.claim_span.quote
    assert "love" in r.claim_span.quote

    # Conservative: faithful claim must not trigger residue check
    faithful_rephrase = "In a 30-day test of 120 small-business customers using Pro, median setup time fell by 30%."
    rs_faithful = analyze_language(faithful_rephrase, EVIDENCE)
    assert not any(r.category == "UNVERIFIED_ASSERTION" for r in rs_faithful)


def test_unicode_normalization_and_span_fidelity():
    # Non-breaking hyphen: U+2011
    claim_nb_hyphen = "In a 30\u2011day test of 120 small\u2011business customers using Pro, median setup time fell by 30%."
    review = ReviewService(Store(":memory:")).review(claim_nb_hyphen, EVIDENCE)
    assert review.verdict.status.value == "SUPPORTED_BY_SUPPLIED_EVIDENCE"
    # Every returned span quote must equal text[start:end] of the original
    for c in review.comparisons:
        if c.claim_span:
            s, e, q = c.claim_span.start, c.claim_span.end, c.claim_span.quote
            assert claim_nb_hyphen[s:e] == q

    # nbsp: U+00A0 and curly quotes: U+201C, U+201D
    claim_unicode = "\u201cIn a 30-day test of 120 small-business customers using Pro, median setup time fell by 30%.\u201d"
    ev_unicode = "\u201cIn a 30-day test of 120 small-business customers using Pro, median setup time fell by 30%.\u201d"
    review_u = ReviewService(Store(":memory:")).review(claim_unicode, ev_unicode)
    for c in review_u.comparisons:
        if c.claim_span:
            assert claim_unicode[c.claim_span.start:c.claim_span.end] == c.claim_span.quote


def test_spacing_and_number_words():
    # "30 %" with space
    claim_sp = "In a 30-day test of 120 small-business customers using Pro, median setup time fell by 30 %."
    review_sp = ReviewService(Store(":memory:")).review(claim_sp, EVIDENCE)
    assert review_sp.verdict.status.value == "SUPPORTED_BY_SUPPLIED_EVIDENCE"

    # number words: "thirty percent"
    claim_words = "In a 30-day test of 120 small-business customers using Pro, median setup time fell by thirty percent."
    review_words = ReviewService(Store(":memory:")).review(claim_words, EVIDENCE)
    assert review_words.verdict.status.value == "SUPPORTED_BY_SUPPLIED_EVIDENCE"
