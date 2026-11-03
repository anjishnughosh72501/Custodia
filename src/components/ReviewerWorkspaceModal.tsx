import React, { useState, useEffect } from 'react';
import type { AuditRevision, Review } from '../types';
import { getRevisions, recordDecision } from '../api';
import { History, CheckCircle2, XCircle, Scale, Loader2, MessageSquare } from 'lucide-react';

interface Props {
  review: Review;
  isOpen: boolean;
  onClose: () => void;
  onDecisionRecorded?: () => void;
}

export const ReviewerWorkspaceModal: React.FC<Props> = ({
  review,
  isOpen,
  onClose,
  onDecisionRecorded,
}) => {
  const [revisions, setRevisions] = useState<AuditRevision[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notes, setNotes] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && review.id) {
      loadRevisions();
    }
  }, [isOpen, review.id]);

  const loadRevisions = async () => {
    setIsLoading(true);
    try {
      const revs = await getRevisions(review.id);
      setRevisions(revs);
    } catch (err) {
      console.error('Failed to load audit revisions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDecision = async (
    decision: 'APPROVED' | 'REJECTED' | 'FLAGGED_FOR_LEGAL' | 'REVISED_EVIDENCE'
  ) => {
    setIsSubmitting(true);
    setFeedbackMsg(null);
    try {
      const newRev = await recordDecision(review.id, decision, notes);
      setRevisions((prev) => [...prev, newRev]);
      setFeedbackMsg(`Decision successfully logged: ${decision.replace(/_/g, ' ')}`);
      setNotes('');
      if (onDecisionRecorded) onDecisionRecorded();
    } catch (err: any) {
      setFeedbackMsg(err.message || 'Failed to record compliance decision.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="reviewer-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="reviewer-modal-title">
      <div className="reviewer-modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="reviewer-modal-header">
          <div className="benchmark-modal-header-left">
            <div className="benchmark-icon-badge">
              <History style={{ width: 22, height: 22, color: 'var(--ink)' }} />
            </div>
            <div>
              <h2 id="reviewer-modal-title" className="benchmark-modal-title">
                Compliance Audit &amp; Reviewer Workspace
              </h2>
              <p className="benchmark-modal-sub">
                Immutable version history &amp; human reviewer sign-off trail
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="benchmark-modal-close-btn"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        {/* Content body */}
        <div className="reviewer-modal-body">
          {/* Review Details summary */}
          <div className="reviewer-claim-summary">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '12px' }}>
              <span style={{ fontWeight: 700 }}>Review ID: <code style={{ color: 'var(--ink)' }}>{review.id}</code></span>
              <span style={{ color: 'var(--ink-3)' }}>Engine: {review.engine_version}</span>
            </div>
            <div>
              <span style={{ fontWeight: 650, color: 'var(--ink-2)', fontSize: '12px' }}>Claim:</span>
              <p style={{ fontStyle: 'italic', marginTop: 4, color: 'var(--ink)' }}>{review.claim_text}</p>
            </div>
          </div>

          {/* Audit Revisions Timeline */}
          <div>
            <h3 style={{ font: '700 13px/1.2 var(--sans)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, color: 'var(--ink)' }}>
              Version History ({revisions.length} revision{revisions.length === 1 ? '' : 's'})
            </h3>

            {isLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 0', color: 'var(--ink-3)' }}>
                <Loader2 style={{ width: 20, height: 20 }} className="animate-spin" />
                <span style={{ marginLeft: 8, fontSize: '13px' }}>Loading audit revisions...</span>
              </div>
            ) : revisions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--ink-3)', fontSize: '13px', border: '1.5px dashed var(--rule-strong)', borderRadius: 'var(--r-nb)' }}>
                No prior revisions recorded for this review yet.
              </div>
            ) : (
              <div className="reviewer-timeline">
                {revisions.map((rev) => {
                  return (
                    <div key={rev.id || rev.version} className="reviewer-timeline-item">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--ink)' }}>
                          Rev #{rev.version}: {rev.reviewer_action.replace(/_/g, ' ')}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--ink-3)' }}>
                          {new Date(rev.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--ink-2)' }}>
                        Reviewer: <strong>{rev.reviewer_id || 'System'}</strong>
                      </div>
                      {rev.notes && (
                        <p style={{ marginTop: 6, fontStyle: 'italic', background: 'var(--sunk)', padding: '6px 10px', borderRadius: 4, border: '1px solid var(--rule)' }}>
                          "{rev.notes}"
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Action Sign-Off Box */}
          <div className="reviewer-form-box">
            <h3 style={{ font: '700 13px/1.2 var(--sans)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, color: 'var(--ink)' }}>
              Log Compliance Action
            </h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add audit rationale, clinical reference notes, or legal feedback (optional)..."
              style={{ width: '100%', minHeight: '70px', padding: '10px 12px', borderRadius: '6px', border: '1.5px solid var(--rule-strong)', background: 'var(--ivory)', fontSize: '13px', outline: 'none' }}
            />

            {feedbackMsg && (
              <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 6, fontSize: '12.5px', background: 'var(--ok-bg)', color: 'var(--ok-ink)', border: '1px solid var(--ok)' }}>
                {feedbackMsg}
              </div>
            )}

            <div className="reviewer-decision-buttons">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleDecision('APPROVED')}
                className="reviewer-btn approve"
              >
                <CheckCircle2 style={{ width: 14, height: 14 }} />
                <span>Approve</span>
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleDecision('REJECTED')}
                className="reviewer-btn reject"
              >
                <XCircle style={{ width: 14, height: 14 }} />
                <span>Reject</span>
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleDecision('FLAGGED_FOR_LEGAL')}
                className="reviewer-btn legal"
              >
                <Scale style={{ width: 14, height: 14 }} />
                <span>Flag Legal</span>
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleDecision('REVISED_EVIDENCE')}
                className="reviewer-btn revise"
              >
                <MessageSquare style={{ width: 14, height: 14 }} />
                <span>Revise</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="benchmark-modal-footer">
          <button
            type="button"
            onClick={onClose}
            className="benchmark-footer-close-btn"
          >
            Close Workspace
          </button>
        </div>
      </div>
    </div>
  );
};
