"""Data models for Brand Preflight content analysis, findings, and correction tracking."""
from __future__ import annotations

import datetime
import uuid
from enum import Enum
from typing import Any, Optional
from pydantic import BaseModel, Field

from app.brand.models import EnforcementLevel, RuleCategory


class ContentCategory(str, Enum):
    AD = "AD"
    ADVERTISEMENT = "ADVERTISEMENT"
    SOCIAL_MEDIA = "SOCIAL_MEDIA"
    LANDING_PAGE = "LANDING_PAGE"
    PRESS_RELEASE = "PRESS_RELEASE"
    PRODUCT_COPY = "PRODUCT_COPY"
    EMAIL = "EMAIL"
    PACKAGING = "PACKAGING"


class WorkflowStatus(str, Enum):
    DRAFT = "DRAFT"
    PROCESSING = "PROCESSING"
    NEEDS_REVISION = "NEEDS_REVISION"
    REVISION_REQUESTED = "REVISION_REQUESTED"
    PENDING_REVIEW = "PENDING_REVIEW"
    FLAGGED_FOR_LEGAL = "FLAGGED_FOR_LEGAL"
    APPROVED = "APPROVED"
    APPROVED_WITH_CONDITIONS = "APPROVED_WITH_CONDITIONS"
    REJECTED = "REJECTED"


class RiskTier(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class FindingStatus(str, Enum):
    OPEN = "OPEN"
    ACCEPTED = "ACCEPTED"
    DISMISSED = "DISMISSED"
    EDITED = "EDITED"


class PreflightFinding(BaseModel):
    id: str = Field(default_factory=lambda: f"fnd_{uuid.uuid4().hex[:10]}")
    title: str
    category: RuleCategory
    severity: EnforcementLevel
    enforcement: Optional[EnforcementLevel] = None
    confidence: float = 1.0                                        # 0.0 to 1.0
    affected_content: str = ""                                     # Verbatim excerpt in the submitted copy
    highlighted_text: Optional[str] = None
    span_start: Optional[int] = None
    span_end: Optional[int] = None
    explanation: str = ""
    rule_id: Optional[str] = None
    rule_title: Optional[str] = None
    source_reference: Optional[str] = None                         # Citation to approved fact, guideline doc, or trial report
    suggested_correction: Optional[str] = None                     # Concrete replacement text
    suggested_fix: Optional[str] = None
    status: FindingStatus = FindingStatus.OPEN
    reviewer_notes: Optional[str] = None

    def model_post_init(self, __context: Any) -> None:
        if self.enforcement is None:
            self.enforcement = self.severity
        if not self.highlighted_text and self.affected_content:
            self.highlighted_text = self.affected_content
        elif self.highlighted_text and not self.affected_content:
            self.affected_content = self.highlighted_text
        if not self.suggested_fix and self.suggested_correction:
            self.suggested_fix = self.suggested_correction
        elif self.suggested_fix and not self.suggested_correction:
            self.suggested_correction = self.suggested_fix


class ContentItem(BaseModel):
    id: str = Field(default_factory=lambda: f"cnt_{uuid.uuid4().hex[:10]}")
    org_id: str
    user_id: str
    title: str
    category: ContentCategory = ContentCategory.ADVERTISEMENT
    body_text: str
    attached_documents: list[str] = Field(default_factory=list)    # SHA-256 or doc filenames
    attached_images: list[str] = Field(default_factory=list)       # Image URLs / filenames
    created_at: str = Field(default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat())


class PreflightReview(BaseModel):
    id: str = Field(default_factory=lambda: f"prev_{uuid.uuid4().hex[:12]}")
    org_id: str
    user_id: str = "creator"
    created_by: Optional[str] = None
    content_id: Optional[str] = None
    brand_profile_id: str
    content_category: ContentCategory = ContentCategory.ADVERTISEMENT
    category: Optional[ContentCategory] = None
    title: str = "Draft Marketing Submission"
    channels: list[str] = Field(default_factory=list)
    original_text: str = ""
    content_raw: Optional[str] = None
    current_text: str = ""                                         # Text after applying corrections
    status: WorkflowStatus = WorkflowStatus.NEEDS_REVISION
    workflow_status: Optional[WorkflowStatus] = None
    governance_score: int = 100                                    # 0 to 100 overall factual & brand fit
    overall_score: Optional[int] = None
    risk_tier: RiskTier = RiskTier.LOW
    findings: list[PreflightFinding] = Field(default_factory=list)
    suggested_rewrite: Optional[str] = None                        # Unified corrected version
    corrected_content: Optional[str] = None
    assigned_reviewer_id: Optional[str] = None
    reviewer_id: Optional[str] = None
    assigned_reviewer_email: Optional[str] = None
    decision: Optional[str] = None                                 # APPROVED | APPROVED_WITH_CONDITIONS | REJECTED
    reviewer_decision: Optional[str] = None
    decision_reason: Optional[str] = None
    reviewer_notes: Optional[str] = None
    decision_timestamp: Optional[str] = None
    visual_analysis_summary: Optional[str] = None
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: str = Field(default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat())

    def model_post_init(self, __context: Any) -> None:
        if self.created_by is None:
            self.created_by = self.user_id
        elif not self.user_id:
            self.user_id = self.created_by

        if self.category is None:
            self.category = self.content_category
        else:
            self.content_category = self.category

        if not self.content_raw and self.original_text:
            self.content_raw = self.original_text
        elif self.content_raw and not self.original_text:
            self.original_text = self.content_raw
        if not self.current_text and self.content_raw:
            self.current_text = self.content_raw

        if self.overall_score is None:
            self.overall_score = self.governance_score
        else:
            self.governance_score = self.overall_score

        if self.workflow_status is None:
            self.workflow_status = self.status
        else:
            self.status = self.workflow_status

        if not self.corrected_content and self.suggested_rewrite:
            self.corrected_content = self.suggested_rewrite
        elif self.corrected_content and not self.suggested_rewrite:
            self.suggested_rewrite = self.corrected_content

        if not self.reviewer_id and self.assigned_reviewer_id:
            self.reviewer_id = self.assigned_reviewer_id
        elif self.reviewer_id and not self.assigned_reviewer_id:
            self.assigned_reviewer_id = self.reviewer_id

        if not self.reviewer_decision and self.decision:
            self.reviewer_decision = self.decision
        elif self.reviewer_decision and not self.decision:
            self.decision = self.reviewer_decision

        if not self.reviewer_notes and self.decision_reason:
            self.reviewer_notes = self.decision_reason
        elif self.reviewer_notes and not self.decision_reason:
            self.decision_reason = self.reviewer_notes


class ReviewComment(BaseModel):
    id: str = Field(default_factory=lambda: f"cmt_{uuid.uuid4().hex[:10]}")
    review_id: str
    user_id: str
    user_email: str = "user@inkloom.ai"
    user_name: Optional[str] = None
    user_role: str = "REVIEWER"
    comment_text: str = ""
    comment: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat())

    def model_post_init(self, __context: Any) -> None:
        if not self.user_name and self.user_email:
            self.user_name = self.user_email
        if not self.comment_text and self.comment:
            self.comment_text = self.comment
        elif self.comment_text and not self.comment:
            self.comment = self.comment_text


class PreflightAnalyzeRequest(BaseModel):
    text: str = ""
    content: Optional[str] = None
    brand_profile_id: str
    org_id: Optional[str] = None
    content_category: ContentCategory = ContentCategory.ADVERTISEMENT
    category: Optional[str] = None
    title: str = "Draft Marketing Submission"
    channels: list[str] = Field(default_factory=list)
    document_texts: list[str] = Field(default_factory=list)
    image_filenames: list[str] = Field(default_factory=list)
    image_hex_colors: list[str] = Field(default_factory=list)
    detected_hex_colors: list[str] = Field(default_factory=list)

    def model_post_init(self, __context: Any) -> None:
        if not self.text and self.content:
            self.text = self.content
        elif self.text and not self.content:
            self.content = self.text
        if self.category and isinstance(self.category, str):
            try:
                self.content_category = ContentCategory(self.category)
            except ValueError:
                pass
        if not self.detected_hex_colors and self.image_hex_colors:
            self.detected_hex_colors = self.image_hex_colors
        elif self.detected_hex_colors and not self.image_hex_colors:
            self.image_hex_colors = self.detected_hex_colors
