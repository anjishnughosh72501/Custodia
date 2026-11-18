"""Data models for Brand DNA, organizations, guidelines, rules, and approved enterprise facts."""
from __future__ import annotations

import datetime
import uuid
from enum import Enum
from typing import Any, Optional
from pydantic import BaseModel, Field


class OrgRole(str, Enum):
    ADMIN = "ADMIN"
    BRAND_MANAGER = "BRAND_MANAGER"
    CREATOR = "CREATOR"
    REVIEWER = "REVIEWER"


class RuleCategory(str, Enum):
    TONE = "TONE"
    TERMINOLOGY = "TERMINOLOGY"
    MESSAGING = "MESSAGING"
    FACTS = "FACTS"
    CLAIMS = "CLAIMS"
    LEGAL = "LEGAL"
    VISUAL = "VISUAL"
    ACCESSIBILITY = "ACCESSIBILITY"


class EnforcementLevel(str, Enum):
    STRICT = "STRICT"       # Hard block: cannot be approved without fix or override
    WARNING = "WARNING"     # Moderate risk: requires explicit reviewer acknowledgement
    ADVISORY = "ADVISORY"   # Suggestion/guidance for brand alignment


class RuleStatus(str, Enum):
    EXTRACTED = "EXTRACTED"           # AI/Parser proposed, awaits brand manager approval
    ACTIVE = "ACTIVE"                 # In force across preflight checks
    INACTIVE = "INACTIVE"             # Deactivated by brand manager
    DRAFT = "DRAFT"                   # Manual draft under review


class FactCategory(str, Enum):
    PRICING = "PRICING"
    METRIC = "METRIC"
    PRODUCT = "PRODUCT"
    DISCLAIMER = "DISCLAIMER"
    COHORT = "COHORT"
    DATES = "DATES"


class AssetType(str, Enum):
    LOGO = "LOGO"
    IMAGE = "IMAGE"
    PALETTE = "PALETTE"
    FONT = "FONT"
    TEMPLATE = "TEMPLATE"


class Organization(BaseModel):
    id: str = Field(default_factory=lambda: f"org_{uuid.uuid4().hex[:10]}")
    name: str
    slug: str
    plan: str = "enterprise"
    created_at: str = Field(default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat())


class Membership(BaseModel):
    id: str = Field(default_factory=lambda: f"mem_{uuid.uuid4().hex[:10]}")
    org_id: str
    user_id: str
    role: OrgRole = OrgRole.CREATOR
    created_at: str = Field(default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat())


class BrandProfile(BaseModel):
    id: str = Field(default_factory=lambda: f"bp_{uuid.uuid4().hex[:10]}")
    org_id: str
    name: str
    tagline: str = ""
    description: str = ""
    tone_guidelines: list[str] = Field(default_factory=list)      # e.g. ["Empathetic", "Direct", "Confident", "No jargon"]
    target_audience: str = ""
    primary_colors: list[str] = Field(default_factory=list)       # Hex codes, e.g. ["#14213D", "#00F0FF"]
    font_families: list[str] = Field(default_factory=list)        # e.g. ["Fraunces", "Hanken Grotesk"]
    is_active: bool = True
    created_at: str = Field(default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat())


class BrandRule(BaseModel):
    id: str = Field(default_factory=lambda: f"rule_{uuid.uuid4().hex[:10]}")
    org_id: str
    brand_profile_id: str
    category: RuleCategory
    enforcement: EnforcementLevel = EnforcementLevel.WARNING
    title: str
    rule_text: str
    explanation: str = ""
    forbidden_patterns: list[str] = Field(default_factory=list)    # Substrings or regex patterns to flag
    preferred_alternatives: list[str] = Field(default_factory=list)# Replacement words/phrases
    required_disclaimers: list[str] = Field(default_factory=list)  # Mandatory legal text if condition met
    source_document: Optional[str] = None
    source_location: Optional[str] = None
    status: RuleStatus = RuleStatus.ACTIVE
    version: int = 1
    created_at: str = Field(default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat())


class BrandRuleVersion(BaseModel):
    id: str = Field(default_factory=lambda: f"rv_{uuid.uuid4().hex[:10]}")
    rule_id: str
    version: int
    rule_text: str
    enforcement: EnforcementLevel
    changed_by: str
    reason: str = ""
    created_at: str = Field(default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat())


class ApprovedFact(BaseModel):
    id: str = Field(default_factory=lambda: f"fact_{uuid.uuid4().hex[:10]}")
    org_id: str
    brand_profile_id: str
    category: FactCategory
    entity_name: str                                              # e.g. "Pro Subscription Price", "Study Productivity Gain"
    canonical_value: str                                          # e.g. "₹999", "35%", "120 clinics"
    canonical_number: Optional[float] = None                      # Numerical value for exact frame validation (e.g. 999.0, 35.0)
    canonical_unit: Optional[str] = None                          # e.g. "INR", "%", "users"
    statement: str                                                # Approved marketing sentence verbatim
    proof_citation: str = ""                                      # e.g. "Master Pricing Sheet 2026", "Clinical Study Report p. 4"
    valid_from: Optional[str] = None
    valid_to: Optional[str] = None
    is_active: bool = True
    created_at: str = Field(default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat())


class BrandAsset(BaseModel):
    id: str = Field(default_factory=lambda: f"asset_{uuid.uuid4().hex[:10]}")
    org_id: str
    brand_profile_id: str
    name: str
    asset_type: AssetType
    file_path: Optional[str] = None
    file_url: Optional[str] = None
    mime_type: str = "image/png"
    sha256: str = ""
    hex_colors: list[str] = Field(default_factory=list)           # Primary hex colors detected or defined
    dimensions: dict[str, int] = Field(default_factory=dict)      # width, height
    usage_guidelines: str = ""
    is_active: bool = True
    created_at: str = Field(default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat())
