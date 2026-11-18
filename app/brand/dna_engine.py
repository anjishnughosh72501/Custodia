"""Brand DNA Engine: Extracts, normalizes, and manages organization brand policies and approved facts."""
from __future__ import annotations

import logging
import re
import uuid
from typing import Optional

from .models import (
    ApprovedFact,
    AssetType,
    BrandAsset,
    BrandProfile,
    BrandRule,
    BrandRuleVersion,
    EnforcementLevel,
    FactCategory,
    Organization,
    RuleCategory,
    RuleStatus,
)
from app.documents.parser import ParsedDocument, parse_uploaded_document

log = logging.getLogger("custodia.brand_dna")


# Extraction pattern heuristics for guideline documents
RULE_EXTRACTION_PATTERNS = [
    # Prohibited words / phrases: "Do not use...", "Never say...", "Avoid...", "Prohibited: ..."
    (
        RuleCategory.TERMINOLOGY,
        EnforcementLevel.STRICT,
        r"(?:never\s+use|do\s+not\s+use|avoid\s+using|strictly\s+prohibited|forbidden(?:\s+words?)?)\s*[:\-]?\s*([\"'‘“][^\"'’”]+[\"'’”]|(?:guarantee|100%|cure|miracle|bulletproof|unbreakable|foolproof|cheap)[a-zA-Z0-9\s,]*)",
        "Prohibited terminology identified in guideline",
    ),
    # Guarantee restrictions
    (
        RuleCategory.LEGAL,
        EnforcementLevel.STRICT,
        r"(?:no\s+guarantees?|guarantee\s+language\s+is\s+prohibited|do\s+not\s+guarantee|never\s+guarantee[^\.\n]*)",
        "Absolute guarantee language is prohibited without legal exemption",
    ),
    # Approved pricing claims
    (
        RuleCategory.FACTS,
        EnforcementLevel.STRICT,
        r"(?:price\s+is|pricing\s+is|subscription\s+(?:rate|fee|price)\s+is|cost\s+is)\s*[:\-]?\s*([₹$€£]\s*\d+(?:,\d+)*(?:\.\d+)?|\d+\s*(?:INR|USD|EUR))",
        "Official approved pricing guideline",
    ),
    # Approved productivity / benchmark claims
    (
        RuleCategory.CLAIMS,
        EnforcementLevel.STRICT,
        r"(?:productivity\s+(?:gain|increase|improvement)|setup\s+time\s+reduction|efficiency\s+(?:gain|improvement))\s*(?:is|was|of)\s*(\d+(?:\.\d+)?%?)",
        "Approved empirical efficacy / productivity claim limit",
    ),
    # Tone specifications
    (
        RuleCategory.TONE,
        EnforcementLevel.WARNING,
        r"(?:brand\s+tone|voice\s+and\s+tone|our\s+tone)\s*(?:should\s+be|must\s+be|is)\s*[:\-]?\s*([^\.\n]+)",
        "Brand voice and tone requirement",
    ),
    # Required disclaimers
    (
        RuleCategory.LEGAL,
        EnforcementLevel.STRICT,
        r"(?:mandatory\s+disclaimer|required\s+footnote|all\s+ads\s+must\s+include)\s*[:\-]?\s*([\"'‘“][^\"'’”]+[\"'’”]|[^\.\n]+)",
        "Mandatory regulatory or trademark disclaimer",
    ),
]


def extract_rules_from_parsed_document(
    parsed_doc: ParsedDocument,
    org_id: str,
    brand_profile_id: str,
) -> list[BrandRule]:
    """Parse text chunks in an uploaded guideline document into candidate brand rules."""
    extracted_rules: list[BrandRule] = []

    for chunk in parsed_doc.chunks:
        text = chunk.text
        provenance = chunk.provenance_citation

        for cat, enforcement, pattern, default_title in RULE_EXTRACTION_PATTERNS:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                matched_str = match.group(0).strip()
                extracted_param = match.group(1).strip() if match.groups() else matched_str
                extracted_param_clean = extracted_param.strip("\"'‘“’”")

                forbidden: list[str] = []
                alternatives: list[str] = []
                required: list[str] = []

                if cat in (RuleCategory.TERMINOLOGY, RuleCategory.LEGAL) and "guarantee" in matched_str.lower():
                    forbidden = ["guarantee", "guaranteed", "guarantees", "guaranteeing"]
                    alternatives = ["designed to help", "aims to improve", "can achieve"]
                elif cat == RuleCategory.FACTS and ("₹" in matched_str or "$" in matched_str):
                    forbidden = []
                elif cat == RuleCategory.TERMINOLOGY:
                    words = [w.strip() for w in extracted_param_clean.split(",") if w.strip()]
                    forbidden = words

                rule = BrandRule(
                    id=f"rule_{uuid.uuid4().hex[:10]}",
                    org_id=org_id,
                    brand_profile_id=brand_profile_id,
                    category=cat,
                    enforcement=enforcement,
                    title=f"{default_title}: {extracted_param_clean[:36]}",
                    rule_text=f"Guideline requirement: {matched_str}",
                    explanation=f"Extracted from {parsed_doc.filename} ({provenance})",
                    forbidden_patterns=forbidden,
                    preferred_alternatives=alternatives,
                    required_disclaimers=required,
                    source_document=parsed_doc.filename,
                    source_location=provenance,
                    status=RuleStatus.ACTIVE,
                    version=1,
                )
                extracted_rules.append(rule)

    # If no structural regex matched, construct a general guideline rule from the document summary
    if not extracted_rules and parsed_doc.chunks:
        sample = parsed_doc.chunks[0].text[:200]
        extracted_rules.append(
            BrandRule(
                id=f"rule_{uuid.uuid4().hex[:10]}",
                org_id=org_id,
                brand_profile_id=brand_profile_id,
                category=RuleCategory.MESSAGING,
                enforcement=EnforcementLevel.WARNING,
                title=f"General Messaging Policy: {parsed_doc.filename}",
                rule_text=f"Adhere to messaging principles outlined in: {sample}...",
                explanation=f"Extracted from {parsed_doc.filename}",
                source_document=parsed_doc.filename,
                source_location=parsed_doc.chunks[0].provenance_citation,
                status=RuleStatus.ACTIVE,
                version=1,
            )
        )

    return extracted_rules


def create_demo_brand_dna(org_id: str = "org_inkloom_demo") -> tuple[BrandProfile, list[BrandRule], list[ApprovedFact], list[BrandAsset]]:
    """Generates the official demo Brand DNA satisfying the exact Phase 17 acceptance scenario."""
    bp_id = f"bp_{uuid.uuid4().hex[:10]}"

    profile = BrandProfile(
        id=bp_id,
        org_id=org_id,
        name="Inkloom AI Enterprise",
        tagline="Empowering Content Teams with Intelligent Guardrails",
        description="Enterprise brand guidelines for advertising, social media, and product marketing.",
        tone_guidelines=[
            "Confident but rigorously grounded in empirical evidence",
            "Clear and accessible; avoid hyperbolic superlatives (never say 'miracle' or 'unbreakable')",
            "No absolute guarantees without written regulatory sign-off",
        ],
        target_audience="Enterprise marketing leaders, compliance officers, and creative agencies",
        primary_colors=["#14213D", "#00F0FF", "#2F7F79", "#FBF8F1"],
        font_families=["Fraunces", "Hanken Grotesk", "Inter"],
    )

    rules = [
        # 1. Prohibited Guarantee Language (Phase 17 Requirement)
        BrandRule(
            id="rule_no_guarantees",
            org_id=org_id,
            brand_profile_id=bp_id,
            category=RuleCategory.LEGAL,
            enforcement=EnforcementLevel.STRICT,
            title="Prohibited Guarantee Language",
            rule_text="Marketing statements must never use absolute guarantee language such as 'guarantees', 'guaranteed', or 'guarantee' for performance, uptime, or outcome metrics.",
            explanation="Consumer protection and FTC guidelines prohibit unhedged outcome guarantees.",
            forbidden_patterns=["guarantee", "guaranteed", "guarantees", "guaranteeing", "100% guaranteed"],
            preferred_alternatives=["demonstrated to deliver", "aims to achieve", "designed to help"],
            source_document="Inkloom_Brand_Governance_Playbook_2026.pdf",
            source_location="Section 4.1 Legal Claims (p. 12)",
            status=RuleStatus.ACTIVE,
            version=1,
        ),
        # 2. Approved Product Price: ₹999 (Phase 17 Requirement)
        BrandRule(
            id="rule_approved_price",
            org_id=org_id,
            brand_profile_id=bp_id,
            category=RuleCategory.FACTS,
            enforcement=EnforcementLevel.STRICT,
            title="Approved Subscription Pricing: ₹999",
            rule_text="The authorized entry subscription price is strictly ₹999 per month. All advertising must quote ₹999; unauthorized discounts or lower figures like ₹799 are prohibited.",
            explanation="Brand pricing consistency prevents unauthorized promotions and revenue leakage.",
            forbidden_patterns=["₹799", "799 INR", "Rs. 799", "Rs 799", "$799"],
            preferred_alternatives=["₹999", "₹999/month"],
            source_document="FY26_Master_Commercial_Pricing.xlsx",
            source_location="Sheet: Subscriptions!R2C4",
            status=RuleStatus.ACTIVE,
            version=1,
        ),
        # 3. Approved Productivity Claim: 35% in Specified Study (Phase 17 Requirement)
        BrandRule(
            id="rule_productivity_claim",
            org_id=org_id,
            brand_profile_id=bp_id,
            category=RuleCategory.CLAIMS,
            enforcement=EnforcementLevel.STRICT,
            title="Approved Productivity Improvement Claim (Max 35%)",
            rule_text="Productivity claims must cite the authorized clinical trial benchmark of up to 35% improvement. Claims asserting 95% or higher productivity are ungrounded and strictly prohibited.",
            explanation="Overstating trial metrics from 35% to 95% constitutes critical false advertising.",
            forbidden_patterns=["95%", "95 percent", "90%", "99%", "double productivity"],
            preferred_alternatives=["up to 35% higher productivity in our 2026 benchmark study"],
            source_document="Clinical_Productivity_Benchmark_Report_2026.pdf",
            source_location="p. 8, Table 3.2",
            status=RuleStatus.ACTIVE,
            version=1,
        ),
        # 4. Preferred Terminology (Phase 17 Requirement)
        BrandRule(
            id="rule_preferred_terminology",
            org_id=org_id,
            brand_profile_id=bp_id,
            category=RuleCategory.TERMINOLOGY,
            enforcement=EnforcementLevel.WARNING,
            title="Preferred Terminology: 'Intelligent Brand Governance'",
            rule_text="Refer to our product as an 'Intelligent Brand Governance Platform' rather than generic terms like 'AI bot', 'cheap checker', or 'auto-editor'.",
            explanation="Positioning integrity requires using enterprise category terminology.",
            forbidden_patterns=["cheap", "cheap checker", "basic bot", "quick hack"],
            preferred_alternatives=["intelligent brand governance platform", "compliance automation engine"],
            source_document="Inkloom_Messaging_Architecture.docx",
            source_location="Section 2: Lexicon",
            status=RuleStatus.ACTIVE,
            version=1,
        ),
        # 5. Over-Generalization: Universal Population Prohibition
        BrandRule(
            id="rule_population_qualification",
            org_id=org_id,
            brand_profile_id=bp_id,
            category=RuleCategory.MESSAGING,
            enforcement=EnforcementLevel.WARNING,
            title="Cohort Qualification: Avoid 'Every Business'",
            rule_text="Claims must specify target enterprise cohorts rather than claiming universal applicability 'for every business' or 'for all companies'.",
            explanation="Evidence is bounded by trial sample size (120 small-business cohorts).",
            forbidden_patterns=["for every business", "for all businesses", "for any company", "works for everyone"],
            preferred_alternatives=["for small and mid-sized teams", "across evaluated enterprise cohorts"],
            source_document="Clinical_Productivity_Benchmark_Report_2026.pdf",
            source_location="p. 14, Methodology Limitations",
            status=RuleStatus.ACTIVE,
            version=1,
        ),
        # 6. Approved Logo & Visual Identity
        BrandRule(
            id="rule_approved_logo",
            org_id=org_id,
            brand_profile_id=bp_id,
            category=RuleCategory.VISUAL,
            enforcement=EnforcementLevel.STRICT,
            title="Authorized Brand Logo & Dark Background",
            rule_text="All campaign imagery must incorporate the verified primary logo mark with high-contrast background (#14213D). Outdated monochrome icons are deprecated.",
            explanation="Visual recognition demands unified logo placement and palette compliance.",
            forbidden_patterns=[],
            preferred_alternatives=["Primary Horizontal Logo Mark (Cyan on Navy)"],
            source_document="Inkloom_Visual_Guidelines_2026.pdf",
            source_location="Section 5.2 Logo Safety Zones",
            status=RuleStatus.ACTIVE,
            version=1,
        ),
    ]

    facts = [
        ApprovedFact(
            id="fact_price_999",
            org_id=org_id,
            brand_profile_id=bp_id,
            category=FactCategory.PRICING,
            entity_name="Monthly Subscription Fee",
            canonical_value="₹999",
            canonical_number=999.0,
            canonical_unit="INR",
            statement="Inkloom AI platform subscription is priced at ₹999 per month for professional teams.",
            proof_citation="FY26 Master Pricing Schedule, approved by Commercial Finance",
        ),
        ApprovedFact(
            id="fact_productivity_35",
            org_id=org_id,
            brand_profile_id=bp_id,
            category=FactCategory.METRIC,
            entity_name="Productivity Improvement",
            canonical_value="35%",
            canonical_number=35.0,
            canonical_unit="%",
            statement="In a controlled 90-day trial of 120 customer cohorts, median team productivity increased by 35%.",
            proof_citation="Benchmark Report 2026, Section 4 Results",
        ),
        ApprovedFact(
            id="fact_platform_identity",
            org_id=org_id,
            brand_profile_id=bp_id,
            category=FactCategory.PRODUCT,
            entity_name="Core Product Identity",
            canonical_value="Intelligent Brand Governance Platform",
            statement="Custodia by Inkloom is an intelligent brand-governance and content-intelligence platform.",
            proof_citation="Product Catalog 2026",
        ),
    ]

    assets = [
        BrandAsset(
            id="asset_primary_logo",
            org_id=org_id,
            brand_profile_id=bp_id,
            name="Inkloom Primary Vector Logo (Cyan/Navy)",
            asset_type=AssetType.LOGO,
            file_url="/assets/logo_primary.svg",
            hex_colors=["#14213D", "#00F0FF", "#2F7F79"],
            usage_guidelines="Use with minimum 24px clear space on dark navy backgrounds.",
        ),
        BrandAsset(
            id="asset_brand_palette",
            org_id=org_id,
            brand_profile_id=bp_id,
            name="Inkloom Core Brand Color Palette",
            asset_type=AssetType.PALETTE,
            hex_colors=["#14213D", "#00F0FF", "#2F7F79", "#FBF8F1"],
            usage_guidelines="Primary navy (#14213D) with electric cyan (#00F0FF) accents.",
        ),
    ]

    return profile, rules, facts, assets
