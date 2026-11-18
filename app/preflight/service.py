"""Brand Preflight Engine: Central content-governance, policy validation, and finding orchestration."""
from __future__ import annotations

import logging
import re
from typing import Optional

from app.brand.models import (
    ApprovedFact,
    BrandAsset,
    BrandProfile,
    BrandRule,
    EnforcementLevel,
    FactCategory,
    RuleCategory,
)
from app.preflight.models import (
    ContentCategory,
    FindingStatus,
    PreflightAnalyzeRequest,
    PreflightFinding,
    PreflightReview,
    RiskTier,
    WorkflowStatus,
)
from app.visual.service import analyze_creative_visuals

log = logging.getLogger("custodia.preflight")


def compute_governance_score_and_tier(findings: list[PreflightFinding]) -> tuple[int, RiskTier]:
    """Calculates factual and brand compliance score (0-100) with strict invariant caps."""
    score = 100
    has_strict = False
    has_warning = False

    for f in findings:
        if f.status == FindingStatus.DISMISSED:
            continue
        if f.severity == EnforcementLevel.STRICT:
            has_strict = True
            score -= 25
        elif f.severity == EnforcementLevel.WARNING:
            has_warning = True
            score -= 12
        elif f.severity == EnforcementLevel.ADVISORY:
            score -= 5

    score = max(0, min(100, score))

    # Invariant Caps:
    # Any STRICT contradiction or prohibited legal breach caps score at 45 (CRITICAL)
    if has_strict:
        score = min(score, 45)
        risk_tier = RiskTier.CRITICAL
    elif has_warning:
        score = min(score, 75)
        risk_tier = RiskTier.HIGH if score < 60 else RiskTier.MEDIUM
    elif findings:
        risk_tier = RiskTier.LOW
    else:
        risk_tier = RiskTier.LOW

    return score, risk_tier


def run_brand_preflight(
    text: str | PreflightAnalyzeRequest,
    brand_profile: BrandProfile,
    rules: list[BrandRule],
    approved_facts: list[ApprovedFact],
    brand_assets: list[BrandAsset],
    content_category: ContentCategory = ContentCategory.ADVERTISEMENT,
    org_id: str = "org_default",
    user_id: str = "user_default",
    created_by: Optional[str] = None,
    image_filenames: Optional[list[str]] = None,
    image_hex_colors: Optional[list[str]] = None,
    detected_hex_colors: Optional[list[str]] = None,
) -> PreflightReview:
    """Executes multi-model brand preflight analysis across copy, empirical claims, and visual creative."""
    findings: list[PreflightFinding] = []

    if isinstance(text, PreflightAnalyzeRequest):
        req = text
        text_clean = (req.text or req.content or "").strip()
        content_category = req.content_category
        org_id = req.org_id or brand_profile.org_id or org_id
        user_id = created_by or user_id
        image_filenames = req.image_filenames or []
        image_hex_colors = req.detected_hex_colors or req.image_hex_colors or []
    else:
        text_clean = str(text).strip()
        user_id = created_by or user_id
        image_filenames = image_filenames or []
        image_hex_colors = detected_hex_colors or image_hex_colors or []

    # -------------------------------------------------------------
    # 1. Deterministic Rule & Terminology Validation
    # -------------------------------------------------------------
    for rule in rules:
        if getattr(rule.status, "value", str(rule.status)).upper() != "ACTIVE":
            continue

        # Check forbidden patterns
        for pattern in rule.forbidden_patterns:
            if not pattern.strip():
                continue
            # Search case-insensitively
            regex_pat = r"\b" + re.escape(pattern.strip()) + r"\b" if re.match(r"^\w+", pattern) else re.escape(pattern.strip())
            for match in re.finditer(regex_pat, text_clean, re.IGNORECASE):
                matched_span = match.group(0)
                alt = rule.preferred_alternatives[0] if rule.preferred_alternatives else None

                findings.append(
                    PreflightFinding(
                        title=rule.title,
                        category=rule.category,
                        severity=rule.enforcement,
                        confidence=1.0,
                        affected_content=matched_span,
                        span_start=match.start(),
                        span_end=match.end(),
                        explanation=f"{rule.rule_text}. {rule.explanation}".strip(),
                        rule_id=rule.id,
                        rule_title=rule.title,
                        source_reference=f"{rule.source_document} ({rule.source_location})" if rule.source_document else "Brand Guidelines",
                        suggested_correction=alt,
                    )
                )

    # -------------------------------------------------------------
    # 2. Approved Enterprise Facts & Claim Verification
    # -------------------------------------------------------------
    # A. Pricing Checks
    price_matches = re.finditer(r"(?:₹|Rs\.?|INR|\$)\s*(\d+(?:,\d+)*(?:\.\d+)?)", text_clean, re.IGNORECASE)
    pricing_facts = [f for f in approved_facts if f.category == FactCategory.PRICING and f.is_active]

    for p_match in price_matches:
        full_price_str = p_match.group(0)
        num_val = float(p_match.group(1).replace(",", ""))

        if pricing_facts:
            # Check if this price is among approved pricing facts
            is_approved = any(
                f.canonical_number is not None and abs(f.canonical_number - num_val) < 0.01
                for f in pricing_facts
            )
            if not is_approved:
                official_price = pricing_facts[0].canonical_value
                findings.append(
                    PreflightFinding(
                        title="Unauthorized Pricing Claim",
                        category=RuleCategory.FACTS,
                        severity=EnforcementLevel.STRICT,
                        confidence=1.0,
                        affected_content=full_price_str,
                        span_start=p_match.start(),
                        span_end=p_match.end(),
                        explanation=f"Quoted price '{full_price_str}' does not match authorized commercial pricing ({official_price}). Unapproved promotional pricing exposes organization to financial and regulatory liability.",
                        rule_id="fact_price_check",
                        rule_title="Commercial Pricing Verification",
                        source_reference=pricing_facts[0].proof_citation,
                        suggested_correction=official_price,
                    )
                )

    # B. Empirical Metric / Productivity Claims
    pct_matches = re.finditer(r"(\d+(?:\.\d+)?)\s*%", text_clean)
    metric_facts = [f for f in approved_facts if f.category == FactCategory.METRIC and f.is_active]

    for m_match in pct_matches:
        pct_str = m_match.group(0)
        pct_val = float(m_match.group(1))

        for fact in metric_facts:
            if fact.canonical_number is not None and pct_val > fact.canonical_number:
                findings.append(
                    PreflightFinding(
                        title=f"Unsupported Empirical Claim ({pct_str} exceeds approved {fact.canonical_value})",
                        category=RuleCategory.CLAIMS,
                        severity=EnforcementLevel.STRICT,
                        confidence=1.0,
                        affected_content=pct_str,
                        span_start=m_match.start(),
                        span_end=m_match.end(),
                        explanation=f"Submitted efficacy figure '{pct_str}' significantly exceeds verified trial benchmark of '{fact.canonical_value}'. Publishing unverified efficacy claims violates consumer truth-in-advertising laws.",
                        rule_id=fact.id,
                        rule_title="Empirical Metric Ceiling",
                        source_reference=fact.proof_citation,
                        suggested_correction=f"up to {fact.canonical_value}",
                    )
                )

    # C. Absolute / Universal Cohort Qualification ("for every business", "for all")
    universal_cohort_match = re.search(r"\b(for\s+every\s+business|for\s+all\s+businesses|for\s+any\s+company)\b", text_clean, re.IGNORECASE)
    if universal_cohort_match and not any(f.rule_id == "rule_population_qualification" for f in findings):
        findings.append(
            PreflightFinding(
                title="Over-Generalized Population Cohort",
                category=RuleCategory.MESSAGING,
                severity=EnforcementLevel.WARNING,
                confidence=0.92,
                affected_content=universal_cohort_match.group(0),
                span_start=universal_cohort_match.start(),
                span_end=universal_cohort_match.end(),
                explanation="Universal claims asserting applicability 'for every business' are contradicted by trial evidence limited to specific evaluated business cohorts.",
                rule_id="rule_population_qualification",
                rule_title="Cohort Qualification Requirement",
                source_reference="Clinical Productivity Benchmark Report 2026 (p. 14)",
                suggested_correction="across evaluated enterprise cohorts",
            )
        )

    # -------------------------------------------------------------
    # 3. Visual Brand Intelligence Analysis
    # -------------------------------------------------------------
    vis_findings, vis_summary = analyze_creative_visuals(
        image_filenames=image_filenames,
        detected_hex_colors=image_hex_colors,
        brand_profile=brand_profile,
        brand_assets=brand_assets,
    )
    findings.extend(vis_findings)

    # -------------------------------------------------------------
    # 4. Synthesize Score, Risk Tier & Unified Rewrite
    # -------------------------------------------------------------
    # Deduplicate findings by title and affected content
    deduped_findings: list[PreflightFinding] = []
    seen = set()
    for f in findings:
        key = (f.title, f.affected_content)
        if key not in seen:
            seen.add(key)
            deduped_findings.append(f)

    score, risk_tier = compute_governance_score_and_tier(deduped_findings)

    # Construct auto-corrected rewrite by replacing affected spans
    rewrite = text_clean
    # Sort replacements by length descending to prevent substring collisions
    replacements: list[tuple[str, str]] = []
    for f in deduped_findings:
        if f.affected_content and f.suggested_correction:
            replacements.append((f.affected_content, f.suggested_correction))

    # Apply specific replacements
    for bad_text, good_text in sorted(replacements, key=lambda x: len(x[0]), reverse=True):
        pattern = re.escape(bad_text)
        rewrite = re.sub(pattern, good_text, rewrite, count=1, flags=re.IGNORECASE)

    status = WorkflowStatus.NEEDS_REVISION if risk_tier in (RiskTier.CRITICAL, RiskTier.HIGH) else WorkflowStatus.PENDING_REVIEW

    return PreflightReview(
        org_id=org_id,
        user_id=user_id,
        brand_profile_id=brand_profile.id,
        content_category=content_category,
        original_text=text_clean,
        current_text=text_clean,
        status=status,
        governance_score=score,
        risk_tier=risk_tier,
        findings=deduped_findings,
        suggested_rewrite=rewrite if rewrite != text_clean else None,
        visual_analysis_summary=f"Images: {vis_summary['images_evaluated']}, Palette Compliance: {vis_summary['palette_compliance_pct']}%, Logo Verified: {vis_summary['logo_verified']}",
    )


def apply_finding_correction(
    target: str | PreflightReview,
    finding_or_id: Optional[PreflightFinding | str] = None,
    custom_replacement: Optional[str] = None,
) -> str | PreflightReview:
    """Applies a suggested or custom correction to a string or PreflightReview object."""
    if isinstance(target, PreflightReview):
        review = target
        if finding_or_id is None:
            if review.suggested_rewrite:
                review.current_text = review.suggested_rewrite
                review.content_raw = review.suggested_rewrite
                for f in review.findings:
                    f.status = FindingStatus.ACCEPTED
        else:
            fid = finding_or_id if isinstance(finding_or_id, str) else finding_or_id.id
            for f in review.findings:
                if f.id == fid:
                    rep = custom_replacement if custom_replacement is not None else (f.suggested_correction or f.suggested_fix or "")
                    pattern = re.escape(f.affected_content or f.highlighted_text or "")
                    if pattern:
                        review.current_text = re.sub(pattern, rep, review.current_text, count=1, flags=re.IGNORECASE)
                        review.content_raw = review.current_text
                    f.status = FindingStatus.ACCEPTED
                    break
        score, risk_tier = compute_governance_score_and_tier(review.findings)
        review.governance_score = score
        review.overall_score = score
        review.risk_tier = risk_tier
        if risk_tier == RiskTier.LOW:
            review.status = WorkflowStatus.PENDING_REVIEW
            review.workflow_status = WorkflowStatus.PENDING_REVIEW
        return review

    finding = finding_or_id
    if not isinstance(finding, PreflightFinding):
        return target
    replacement = custom_replacement if custom_replacement is not None else (finding.suggested_correction or finding.suggested_fix or "")
    bad_span = finding.affected_content or finding.highlighted_text or ""
    if not bad_span:
        return target
    pattern = re.escape(bad_span)
    return re.sub(pattern, replacement, target, count=1, flags=re.IGNORECASE)
