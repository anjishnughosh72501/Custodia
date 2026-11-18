"""Human Approval & Governance Workflow: Assignments, discussion threads, and decision sign-offs."""
from __future__ import annotations

import datetime
import logging
import uuid
from typing import Optional

from app.brand.models import OrgRole
from app.preflight.models import PreflightReview, ReviewComment, WorkflowStatus

log = logging.getLogger("custodia.workflow")


class WorkflowPermissionError(Exception):
    pass


class WorkflowStateError(Exception):
    pass


def can_approve_review(user_role: OrgRole | str) -> bool:
    """Verifies that the user role has sign-off authority (ADMIN, BRAND_MANAGER, REVIEWER)."""
    role_str = str(user_role).upper().replace("ORGROLE.", "")
    return role_str in ("ADMIN", "BRAND_MANAGER", "REVIEWER")


def record_workflow_decision(
    review: PreflightReview,
    decision: str,
    reviewer_id: str,
    reviewer_role: OrgRole | str = OrgRole.REVIEWER,
    reviewer_email: str = "reviewer@inkloom.ai",
    reason: str = "",
    notes: str = "",
) -> PreflightReview:
    """Records a formal human compliance decision with strict RBAC enforcement."""
    if not can_approve_review(reviewer_role):
        raise WorkflowPermissionError(
            f"User role '{reviewer_role}' does not possess sign-off authority. Only REVIEWER, BRAND_MANAGER, or ADMIN may sign off."
        )

    decision_norm = decision.strip().upper()
    if decision_norm not in ("APPROVED", "APPROVED_WITH_CONDITIONS", "REJECTED"):
        raise WorkflowStateError(f"Invalid review decision: '{decision}'. Must be APPROVED, APPROVED_WITH_CONDITIONS, or REJECTED.")

    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    review.decision = decision_norm
    review.reviewer_decision = decision_norm
    review.decision_reason = (reason or notes).strip()
    review.reviewer_notes = (reason or notes).strip()
    review.decision_timestamp = now_iso
    review.assigned_reviewer_id = reviewer_id
    review.reviewer_id = reviewer_id
    review.assigned_reviewer_email = reviewer_email
    review.updated_at = now_iso

    if decision_norm == "APPROVED":
        review.status = WorkflowStatus.APPROVED
        review.workflow_status = WorkflowStatus.APPROVED
    elif decision_norm == "APPROVED_WITH_CONDITIONS":
        review.status = WorkflowStatus.APPROVED_WITH_CONDITIONS
        review.workflow_status = WorkflowStatus.APPROVED_WITH_CONDITIONS
    else:
        review.status = WorkflowStatus.REJECTED
        review.workflow_status = WorkflowStatus.REJECTED

    return review


def create_review_comment(
    review_id: str,
    user_id: str,
    user_email: str = "reviewer@inkloom.ai",
    user_role: str = "REVIEWER",
    comment_text: str = "",
    user_name: Optional[str] = None,
    comment: Optional[str] = None,
) -> ReviewComment:
    """Creates a new comment in the audit discussion thread."""
    text = (comment_text or comment or "").strip()
    return ReviewComment(
        id=f"cmt_{uuid.uuid4().hex[:10]}",
        review_id=review_id,
        user_id=user_id,
        user_email=user_email or (user_name if user_name and "@" in user_name else "user@inkloom.ai"),
        user_role=user_role,
        comment_text=text,
        created_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
    )
