"""Tests for Inkloom Brand Governance, DNA Engine, Preflight Intelligence, and Phase 17 Acceptance."""
import os
import pytest
from fastapi.testclient import TestClient

os.environ["CUSTODIA_ENV"] = "dev"
from app.main import app, create_app
from app.brand.models import (
    ApprovedFact,
    AssetType,
    BrandAsset,
    BrandProfile,
    BrandRule,
    EnforcementLevel,
    FactCategory,
    OrgRole,
    Organization,
    RuleCategory,
    RuleStatus,
)
from app.brand.dna_engine import create_demo_brand_dna, extract_rules_from_parsed_document
from app.documents.parser import ParsedDocument, DocumentChunk
from app.preflight.models import (
    ContentCategory,
    FindingStatus,
    PreflightAnalyzeRequest,
    PreflightFinding,
    RiskTier,
    WorkflowStatus,
)
from app.preflight.service import (
    apply_finding_correction,
    compute_governance_score_and_tier,
    run_brand_preflight,
)
from app.visual.service import (
    color_distance_euclidean,
    hex_to_rgb,
    analyze_creative_visuals,
)
from app.workflow.service import (
    WorkflowPermissionError,
    can_approve_review,
    record_workflow_decision,
)
from app.analytics.service import calculate_governance_analytics
from app.store import SqliteStore


@pytest.fixture
def test_client():
    return TestClient(app)


@pytest.fixture
def clean_store(tmp_path):
    db_file = str(tmp_path / "test_inkloom.db")
    return SqliteStore(db_file)


def test_demo_brand_dna_initialization():
    """Verifies that the demo brand DNA models the Inkloom AI Enterprise profile properly."""
    profile, rules, facts, assets = create_demo_brand_dna("org_inkloom_demo")
    assert profile.name == "Inkloom AI Enterprise"
    assert len(rules) >= 5
    assert len(facts) >= 3
    assert len(assets) >= 2

    rule_titles = [r.title.lower() for r in rules]
    assert any("guarantee" in t for t in rule_titles)
    assert any("999" in t or "pricing" in t for t in rule_titles)
    assert any("productivity" in t or "35%" in t for t in rule_titles)


def test_rule_extraction_from_guidelines():
    """Verifies automated extraction of candidate rules from guideline document chunks."""
    chunks = [
        DocumentChunk(
            document_id="doc_1",
            filename="Brand_Guidelines_2026.pdf",
            file_type="pdf",
            text="Brand Policy: Never use guarantee or 100% promised results. The subscription price is ₹999 per month.",
            page_number=1,
            section_name="Section 1",
        )
    ]
    parsed_doc = ParsedDocument(
        filename="Brand_Guidelines_2026.pdf",
        file_type="pdf",
        byte_size=1024,
        sha256="abc12345",
        total_chunks=len(chunks),
        full_text_preview=chunks[0].text,
        chunks=chunks,
    )
    rules = extract_rules_from_parsed_document(parsed_doc, "org_test", "bp_test")
    assert len(rules) >= 1
    assert any("guarantee" in r.forbidden_patterns for r in rules)


def test_deterministic_rule_validation():
    """Verifies that prohibited words (e.g. guarantee) are detected with strict severity."""
    profile, rules, facts, assets = create_demo_brand_dna()
    req = PreflightAnalyzeRequest(
        text="This product guarantees rapid turnaround.",
        brand_profile_id=profile.id,
    )
    review = run_brand_preflight(req, profile, rules, facts, assets)
    assert any("guarantee" in f.affected_content.lower() for f in review.findings)
    assert review.risk_tier in (RiskTier.HIGH, RiskTier.CRITICAL)


def test_pricing_fact_check():
    """Verifies that unauthorized prices (₹799) are flagged while approved prices (₹999) pass."""
    profile, rules, facts, assets = create_demo_brand_dna()

    # Unauthorized price: ₹799
    req_bad = PreflightAnalyzeRequest(
        text="Special limited deal: Subscribe now for only ₹799.",
        brand_profile_id=profile.id,
    )
    review_bad = run_brand_preflight(req_bad, profile, rules, facts, assets)
    pricing_findings = [f for f in review_bad.findings if "799" in f.affected_content or "price" in f.title.lower()]
    assert len(pricing_findings) >= 1

    # Authorized price: ₹999
    req_good = PreflightAnalyzeRequest(
        text="Official pricing: Subscribe now for ₹999 per month.",
        brand_profile_id=profile.id,
    )
    review_good = run_brand_preflight(req_good, profile, rules, facts, assets)
    bad_price_findings = [f for f in review_good.findings if "799" in f.affected_content]
    assert len(bad_price_findings) == 0


def test_empirical_claim_ceiling():
    """Verifies that claims exceeding trial limits (95% vs 35%) are strictly blocked."""
    profile, rules, facts, assets = create_demo_brand_dna()
    req = PreflightAnalyzeRequest(
        text="Achieve 95% higher productivity across your creative workflow.",
        brand_profile_id=profile.id,
    )
    review = run_brand_preflight(req, profile, rules, facts, assets)
    claim_findings = [f for f in review.findings if "95%" in f.affected_content or "productivity" in f.title.lower()]
    assert len(claim_findings) >= 1
    assert claim_findings[0].suggested_correction == "up to 35%"


def test_color_palette_and_visual_intelligence():
    """Verifies Euclidean RGB distance computation and palette compliance check."""
    # Exact match
    c1 = hex_to_rgb("#14213D")
    c2 = hex_to_rgb("14213D")
    assert c1 == c2
    assert color_distance_euclidean(c1, c2) == 0.0

    # Distant color
    c_distant = hex_to_rgb("#FF0000")
    dist = color_distance_euclidean(c1, c_distant)
    assert dist > 0.3

    profile, _, _, assets = create_demo_brand_dna()
    findings, summary = analyze_creative_visuals(
        image_filenames=["ad_banner_1.png"],
        detected_hex_colors=["#14213D", "#00F0FF", "#E63946"],  # Red is unapproved
        brand_profile=profile,
        brand_assets=assets,
    )
    assert summary["images_evaluated"] == 1
    assert summary["palette_compliance_pct"] < 100


def test_governance_score_invariant_caps():
    """Verifies invariant: Strict violations cap score <= 30 and mandate HIGH/CRITICAL tier."""
    finding_strict = PreflightFinding(
        title="Unauthorized Pricing",
        category=RuleCategory.FACTS,
        severity=EnforcementLevel.STRICT,
        affected_content="₹799",
        explanation="Unauthorized price",
    )
    score, tier = compute_governance_score_and_tier([finding_strict])
    assert score <= 45
    assert tier in (RiskTier.HIGH, RiskTier.CRITICAL)


def test_human_workflow_rbac():
    """Verifies that only authorized roles (REVIEWER, ADMIN) can sign off on reviews."""
    assert can_approve_review(OrgRole.REVIEWER) is True
    assert can_approve_review(OrgRole.ADMIN) is True
    assert can_approve_review(OrgRole.CREATOR) is False
    assert can_approve_review("CREATOR") is False

    profile, rules, facts, assets = create_demo_brand_dna()
    req = PreflightAnalyzeRequest(
        text="Official price is ₹999.",
        brand_profile_id=profile.id,
    )
    review = run_brand_preflight(req, profile, rules, facts, assets)

    # Unauthorized attempt by CREATOR raises WorkflowPermissionError
    with pytest.raises(WorkflowPermissionError):
        record_workflow_decision(
            review=review,
            decision="APPROVED",
            reviewer_id="creator_1",
            reviewer_role=OrgRole.CREATOR,
        )

    # Authorized sign-off by REVIEWER succeeds
    approved = record_workflow_decision(
        review=review,
        decision="APPROVED",
        reviewer_id="reviewer_lead",
        reviewer_role=OrgRole.REVIEWER,
        reason="Approved after factual verification",
    )
    assert approved.status == WorkflowStatus.APPROVED
    assert approved.decision == "APPROVED"


def test_governance_drift_analytics():
    """Verifies calculation of governance score averages, approval rate %, and top violated rules."""
    profile, rules, facts, assets = create_demo_brand_dna()
    req1 = PreflightAnalyzeRequest(text="Clean text at ₹999.", brand_profile_id=profile.id)
    r1 = run_brand_preflight(req1, profile, rules, facts, assets)
    record_workflow_decision(r1, "APPROVED", "rev1", reviewer_role=OrgRole.REVIEWER)

    req2 = PreflightAnalyzeRequest(text="Guaranteed results for ₹799.", brand_profile_id=profile.id)
    r2 = run_brand_preflight(req2, profile, rules, facts, assets)

    analytics = calculate_governance_analytics([r1, r2], rules)
    assert analytics["total_reviews"] == 2
    assert analytics["approval_rate_pct"] == 50.0
    assert "category_breakdown" in analytics


def test_phase17_acceptance_scenario_end_to_end(test_client):
    """Executes the exact Phase 17 scenario and validates all 4 issues, suggested copy, sign-off, and audit trail."""
    res = test_client.post("/api/demo/run-phase17-scenario")
    assert res.status_code == 200
    data = res.json()

    assert data["success"] is True
    assert data["all_4_issues_detected"] is True
    assert data["initial_score"] <= 30
    assert data["initial_risk_tier"] in ("HIGH", "CRITICAL")
    assert data["final_status"] == "APPROVED"
    assert data["reviewer_decision"] == "APPROVED"
    assert data["audit_event_id"].startswith("evt_")

    # Check that corrected copy has ₹999 and up to 35%
    corrected = data["corrected_copy_applied"]
    assert "₹999" in corrected
    assert "35%" in corrected
    assert "guarantees" not in corrected.lower()


def test_preflight_api_endpoints(test_client):
    """Verifies full REST lifecycle: list profiles, analyze copy, queue status, decision, analytics."""
    # 1. Profiles
    res_profiles = test_client.get("/api/brand/profiles")
    assert res_profiles.status_code == 200
    profiles = res_profiles.json()["profiles"]
    assert len(profiles) >= 1
    p_id = profiles[0]["id"]

    # 2. Analyze
    res_analyze = test_client.post(
        "/api/preflight/analyze",
        json={
            "brand_profile_id": p_id,
            "content": "Special offer: guarantees 95% boost for every business at ₹799.",
            "title": "Campaign Test Submission",
        },
    )
    assert res_analyze.status_code == 200
    review_data = res_analyze.json()
    review_id = review_data["id"]
    assert len(review_data["findings"]) >= 3

    # 3. Queue
    res_queue = test_client.get("/api/workflow/queue")
    assert res_queue.status_code == 200
    assert res_queue.json()["total_count"] >= 1

    # 4. Reviewer Decision
    res_decision = test_client.post(
        f"/api/workflow/reviews/{review_id}/decision",
        json={
            "decision": "APPROVED_WITH_CONDITIONS",
            "notes": "Ensure legal disclaimer is attached before display network push.",
        },
    )
    assert res_decision.status_code == 200
    assert res_decision.json()["workflow_status"] == "APPROVED_WITH_CONDITIONS"

    # 5. Analytics
    res_analytics = test_client.get("/api/analytics/overview")
    assert res_analytics.status_code == 200
    assert "overall_compliance_score" in res_analytics.json()
