import type { Review } from "../types";
import { DIM_LABEL, VERDICT_TITLE, VERDICT_TONE } from "../labels";
import { Icon, StatusTag, statusTone } from "../ui";
import { ActionBar } from "./ActionBar";
import { CHECKER_COPY } from "./copy.checker";

interface CaseRailProps {
  review: Review;
  selected: string | null;
  onSelect: (id: string | null) => void;
  consideredCount: number;
  totalRisks: number;
  onToast: (text: string, tone?: "ok" | "warn" | "bad") => void;
  onEditAndRerun: () => void;
  consideredRisks?: Record<string, boolean>;
  onDeleteReview?: () => void;
  className?: string;
}

export function CaseRail({
  review,
  selected,
  onSelect,
  consideredCount,
  totalRisks,
  onToast,
  onEditAndRerun,
  consideredRisks,
  onDeleteReview,
  className = "",
}: CaseRailProps) {
  const verdictTone = VERDICT_TONE[review.verdict.status] ?? "warn";
  const verdictTitle = VERDICT_TITLE[review.verdict.status] ?? review.verdict.status;

  const supportedCount = review.comparisons.filter((c) => c.status === "supported").length;
  const contradictedCount = review.comparisons.filter((c) => c.status === "contradicted").length;
  const reviewCount = review.comparisons.filter((c) => c.status === "unknown").length;

  return (
    <aside className={`panel case-rail-panel ${className}`} aria-label="Case file">
      <div className="case-rail-head">
        <div className="case-rail-title-row">
          <span className="case-rail-eyebrow">{CHECKER_COPY.caseRail.title}</span>
          <span className={`sticker ${verdictTone} case-verdict-sticker`}>
            {verdictTitle}
          </span>
        </div>

        <div className="case-counts-row">
          <div className="case-count bad">
            <span className="count-num">{contradictedCount}</span>
            <span className="count-lbl">Contradicted</span>
          </div>
          <div className="case-count warn">
            <span className="count-num">{reviewCount}</span>
            <span className="count-lbl">Needs review</span>
          </div>
          <div className="case-count ok">
            <span className="count-num">{supportedCount}</span>
            <span className="count-lbl">Supported</span>
          </div>
        </div>

        {totalRisks > 0 && (
          <div className="case-checklist-progress">
            <div className="checklist-label-row">
              <span className="checklist-label">{CHECKER_COPY.caseRail.reviewedCounter}</span>
              <span className="checklist-val">
                {consideredCount} of {totalRisks} considered
              </span>
            </div>
            <div className="progress-bar-track" aria-hidden="true">
              <div
                className="progress-bar-fill"
                style={{
                  width: `${totalRisks > 0 ? (consideredCount / totalRisks) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="case-rail-dims">
        <span className="case-dims-header">{CHECKER_COPY.caseRail.findingsCount}</span>
        <ul className="case-dims-list" role="list">
          {review.comparisons.map((c) => {
            const isSel = selected === c.dimension;
            const tone = statusTone(c.status);
            return (
              <li key={c.dimension} role="listitem">
                <button
                  type="button"
                  className={`case-dim-btn ${tone}${isSel ? " sel" : ""}`}
                  onClick={() => onSelect(isSel ? null : c.dimension)}
                  aria-pressed={isSel}
                >
                  <span className={`case-dim-icon ${tone}`}>
                    <Icon tone={tone} size={13} />
                  </span>
                  <span className="case-dim-name">{DIM_LABEL[c.dimension]}</span>
                  <StatusTag status={c.status} />
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="case-rail-actions">
        <ActionBar
          review={review}
          onToast={onToast}
          onEditAndRerun={onEditAndRerun}
          consideredRisks={consideredRisks}
          onDeleteReview={onDeleteReview}
        />
      </div>
    </aside>
  );
}
