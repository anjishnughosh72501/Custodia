"""Evidence Confidence Map and deterministic confidence score calculation.

Provides an auditable, transparent breakdown across the 7 verification dimensions.
Never produces opaque, arbitrary percentages.
"""
from __future__ import annotations

from typing import Any, Optional
from pydantic import BaseModel, Field

from ..models import DimensionComparison, LanguageRisk, Status, Verdict, VerdictStatus

DIMENSION_WEIGHTS = {
    "metric": 0.20,
    "value": 0.25,
    "unit": 0.15,
    "population": 0.15,
    "time_window": 0.10,
    "conditions": 0.10,
    "strength": 0.05,
}


class DimensionConfidence(BaseModel):
    dimension: str
    status: str  # supported | contradicted | unknown
    weight: float
    score: float  # 0.0 to 1.0
    reason_code: str
    explanation: str
    claim_raw: Optional[str] = None
    evidence_raw: Optional[str] = None
    claim_span: Optional[Any] = None
    evidence_span: Optional[Any] = None
    source_citation: Optional[str] = None


class EvidenceConfidenceMap(BaseModel):
    overall_score: float  # 0.0 to 1.0 (auditable deterministic metric)
    overall_percentage: int  # 0 to 100
    verdict: str  # SUPPORTED | NOT_SUPPORTED | NEEDS_HUMAN_REVIEW
    supported_dimensions: list[str] = Field(default_factory=list)
    contradicted_dimensions: list[str] = Field(default_factory=list)
    unknown_dimensions: list[str] = Field(default_factory=list)
    missing_qualifiers: list[str] = Field(default_factory=list)
    sources_checked: list[str] = Field(default_factory=list)
    decision_reasons: list[str] = Field(default_factory=list)
    dimensions: list[DimensionConfidence] = Field(default_factory=list)
    calculation_breakdown: dict[str, Any] = Field(default_factory=dict)


def build_evidence_confidence_map(
    comparisons: list[DimensionComparison],
    verdict: Verdict,
    language_risks: Optional[list[LanguageRisk]] = None,
    sources_checked: Optional[list[str]] = None,
    degraded: bool = False,
    injection: bool = False,
) -> EvidenceConfidenceMap:
    """Computes a deterministic, mathematically grounded confidence score and detailed breakdown."""
    dim_confidences: list[DimensionConfidence] = []
    supported_dims: list[str] = []
    contradicted_dims: list[str] = []
    unknown_dims: list[str] = []
    missing_qualifiers: list[str] = []

    weighted_sum = 0.0
    total_weight = sum(DIMENSION_WEIGHTS.values())

    for comp in comparisons:
        w = DIMENSION_WEIGHTS.get(comp.dimension, 0.10)
        if comp.status == Status.supported:
            s_val = 1.0
            supported_dims.append(comp.dimension)
        elif comp.status == Status.contradicted:
            s_val = 0.0
            contradicted_dims.append(comp.dimension)
        else:
            s_val = 0.35  # partial / unknown
            unknown_dims.append(comp.dimension)
            if comp.reason_code in ("QUALIFIER_OMITTED", "CONDITION_OMITTED", "POPULATION_OMITTED"):
                missing_qualifiers.append(f"{comp.dimension}: {comp.explanation}")

        weighted_sum += w * s_val
        dim_confidences.append(
            DimensionConfidence(
                dimension=comp.dimension,
                status=comp.status.value,
                weight=w,
                score=round(s_val, 2),
                reason_code=comp.reason_code,
                explanation=comp.explanation,
                claim_raw=comp.claim_raw,
                evidence_raw=comp.evidence_raw,
                claim_span={"start": comp.claim_span.start, "end": comp.claim_span.end, "quote": comp.claim_span.quote} if comp.claim_span else None,
                evidence_span={"start": comp.evidence_span.start, "end": comp.evidence_span.end, "quote": comp.evidence_span.quote} if comp.evidence_span else None,
            )
        )

    # Base score
    base_score = weighted_sum / total_weight

    # Penalty deductions
    penalties = 0.0
    if contradicted_dims:
        # Severe penalty: a marketing claim with factual contradictions cannot be confident
        penalties += 0.40 * len(contradicted_dims)
    if degraded:
        penalties += 0.15
    if injection:
        penalties += 0.30

    open_risks = [r for r in (language_risks or []) if r.severity == "review"]
    penalties += 0.05 * len(open_risks)

    final_score = max(0.0, min(1.0, base_score - penalties))

    # Strict hard caps based on verdict
    if verdict.status == VerdictStatus.NOT_SUPPORTED or verdict.status.value == "NOT_SUPPORTED":
        final_score = min(final_score, 0.28)
        v_str = "NOT_SUPPORTED"
    elif verdict.status == VerdictStatus.NEEDS_HUMAN_REVIEW or verdict.status.value == "NEEDS_HUMAN_REVIEW":
        final_score = min(max(final_score, 0.30), 0.72)
        v_str = "NEEDS_HUMAN_REVIEW"
    else:
        final_score = max(final_score, 0.85)
        v_str = "SUPPORTED"

    reasons: list[str] = []
    if contradicted_dims:
        reasons.append(f"Contradictions detected in: {', '.join(contradicted_dims)}.")
    if unknown_dims:
        reasons.append(f"Unverified or missing dimensions: {', '.join(unknown_dims)}.")
    if missing_qualifiers:
        reasons.append(f"Dropped evidence qualifiers: {len(missing_qualifiers)} omitted condition(s).")
    if open_risks:
        reasons.append(f"Regulatory/Language risks identified: {len(open_risks)} open risk item(s).")
    if not reasons:
        reasons.append("All measured dimensions match verbatim evidence without qualifiers dropped.")

    return EvidenceConfidenceMap(
        overall_score=round(final_score, 3),
        overall_percentage=int(round(final_score * 100)),
        verdict=v_str,
        supported_dimensions=supported_dims,
        contradicted_dimensions=contradicted_dims,
        unknown_dimensions=unknown_dims,
        missing_qualifiers=missing_qualifiers,
        sources_checked=sources_checked or ["Supplied Evidence Document"],
        decision_reasons=reasons,
        dimensions=dim_confidences,
        calculation_breakdown={
            "dimension_weights": DIMENSION_WEIGHTS,
            "base_score": round(base_score, 3),
            "penalties": round(penalties, 3),
            "contradiction_count": len(contradicted_dims),
            "unknown_count": len(unknown_dims),
            "language_risks_count": len(open_risks),
        },
    )
