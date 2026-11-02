import React, { useState, useEffect } from 'react';
import type { AuditRevision, Review } from '../types';
import { getRevisions, recordDecision } from '../api';
import { History, CheckCircle2, XCircle, Scale, Clock, UserCheck, Loader2, MessageSquare } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Compliance Audit &amp; Reviewer Workspace</h2>
              <p className="text-xs text-slate-500">Immutable version history &amp; human reviewer sign-off trail</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg font-semibold px-2 py-1 rounded cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Review Details summary */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/70 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700">Review ID: <code className="text-indigo-600">{review.id}</code></span>
              <span className="text-slate-500">Engine: {review.engine_version}</span>
            </div>
            <div>
              <span className="font-semibold text-slate-600">Claim:</span>
              <p className="text-slate-900 italic mt-0.5">{review.claim_text}</p>
            </div>
          </div>

          {/* Audit Revisions Timeline */}
          <div>
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
              Version History ({revisions.length} revision{revisions.length === 1 ? '' : 's'})
            </h3>

            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                <span className="text-xs">Loading audit revisions...</span>
              </div>
            ) : revisions.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs border border-dashed rounded-lg">
                No prior revisions recorded for this review yet.
              </div>
            ) : (
              <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-200">
                {revisions.map((rev) => {
                  const isAuto = rev.reviewer_action === 'automated_check' || rev.reviewer_action === 'CREATE_REVIEW';
                  const isApprove = rev.reviewer_action === 'APPROVED';
                  const isReject = rev.reviewer_action === 'REJECTED';

                  return (
                    <div key={rev.id} className="relative pl-8 text-xs">
                      <div className="absolute left-2 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white -translate-x-1/2 bg-indigo-600" />
                      <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-2xs">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-bold text-slate-800">
                            Version {rev.version} ·{' '}
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                isApprove
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : isReject
                                  ? 'bg-rose-100 text-rose-800'
                                  : isAuto
                                  ? 'bg-slate-100 text-slate-700'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {rev.reviewer_action.replace(/_/g, ' ')}
                            </span>
                          </span>
                          <span className="text-[11px] text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(rev.created_at).toLocaleString()}
                          </span>
                        </div>

                        {rev.notes && (
                          <p className="text-slate-600 mt-1 italic bg-slate-50 p-2 rounded border border-slate-100">
                            "{rev.notes}"
                          </p>
                        )}

                        <div className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-2">
                          <span>Verdict: <strong>{rev.verdict?.status}</strong></span>
                          {rev.reviewer_id && (
                            <>
                              <span>•</span>
                              <span>Reviewer: {rev.reviewer_id}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Reviewer Action Sign-Off Box */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-indigo-600" />
              <span>Record Human Reviewer Decision</span>
            </h3>

            {feedbackMsg && (
              <div className="mb-3 p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg text-xs text-indigo-900 font-medium">
                {feedbackMsg}
              </div>
            )}

            <div className="mb-3">
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Audit / Compliance Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Document your reason for sign-off or requested revision..."
                rows={2}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-hidden"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleDecision('APPROVED')}
                className="py-2 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Approve Claim</span>
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleDecision('REJECTED')}
                className="py-2 px-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>Reject Claim</span>
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleDecision('FLAGGED_FOR_LEGAL')}
                className="py-2 px-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Scale className="w-3.5 h-3.5" />
                <span>Flag Legal</span>
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleDecision('REVISED_EVIDENCE')}
                className="py-2 px-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Revise Evidence</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/70 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Close Workspace
          </button>
        </div>
      </div>
    </div>
  );
};
