import { useEffect, useId, useState } from "react";
import type { Review } from "../types";
import {
  computeFit,
  FIT_SCORE_DISCLAIMER,
  FIT_SCORE_LABEL,
  type FitResult,
} from "../fitScore";
import { DIM_LABEL, STATUS_LABEL, VERDICT_TONE } from "../labels";
import { useReducedMotion } from "../motion/useReducedMotion";
import { animate } from "../motion/anime";

interface FitRingProps {
  review: Review;
  className?: string;
}

export function FitRing({ review, className = "" }: FitRingProps) {
  const [expanded, setExpanded] = useState(false);
  const [displayScore, setDisplayScore] = useState(0);
  const [strokeProgress, setStrokeProgress] = useState(0);
  const reducedMotion = useReducedMotion();
  const disclosureId = useId();

  const fit: FitResult = computeFit(review);
  const tone = VERDICT_TONE[review.verdict.status] ?? "warn";
  const targetScore = fit.score;

  // SVG ring parameters
  // Desktop: 132px, radius ~52, viewBox 0 0 132 132.
  const size = 132;
  const strokeWidth = 9;
  const radius = (size - strokeWidth) / 2; // 61.5
  const circumference = 2 * Math.PI * radius; // ~386.4

  useEffect(() => {
    if (targetScore === null) {
      setDisplayScore(0);
      setStrokeProgress(0);
      return;
    }

    if (reducedMotion) {
      setDisplayScore(targetScore);
      setStrokeProgress(targetScore);
      return;
    }

    // Animate stroke and number counter
    const obj = { val: 0, progress: 0 };
    const anim = animate(obj, {
      val: targetScore,
      progress: targetScore,
      duration: 800,
      ease: "outQuad",
      onUpdate: () => {
        setDisplayScore(Math.round(obj.val));
        setStrokeProgress(obj.progress);
      },
    });

    return () => {
      anim.pause();
    };
  }, [targetScore, reducedMotion]);

  const dashOffset =
    targetScore === null
      ? circumference
      : circumference - (strokeProgress / 100) * circumference;

  const accessibleName =
    targetScore !== null
      ? `${FIT_SCORE_LABEL}: ${targetScore} out of 100`
      : `${FIT_SCORE_LABEL}: score unavailable`;

  return (
    <div
      className={`fit-ring-card panel ${className}`}
      role="region"
      aria-label={accessibleName}
    >
      <div className="fit-ring-header">
        <span className="fit-ring-badge sticker">Analysis</span>
        <span className={`sticker ${tone} small-sticker`}>
          {review.verdict.status.replace(/_/g, " ").toLowerCase()}
        </span>
      </div>

      <div className="fit-ring-visual-wrap">
        <svg
          className="fit-ring-svg"
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          aria-hidden="true"
        >
          {/* Background Track */}
          <circle
            className="fit-ring-track"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
          />
          {/* Progress Circle */}
          {targetScore !== null && (
            <circle
              className={`fit-ring-progress stroke-${tone}`}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          )}
        </svg>

        <div className="fit-ring-center-content" aria-hidden="true">
          {targetScore !== null ? (
            <>
              <div className="fit-ring-number-row">
                <span className="fit-ring-number">{displayScore}</span>
                <span className="fit-ring-max">/ 100</span>
              </div>
              <span className="fit-ring-label">{FIT_SCORE_LABEL}</span>
            </>
          ) : (
            <>
              <span className="fit-ring-emdash">—</span>
              <span className="fit-ring-label">Unavailable</span>
            </>
          )}
        </div>
      </div>

      {targetScore === null && fit.unavailableReason && (
        <p className="fit-ring-unavailable-note code">
          {fit.unavailableReason}
        </p>
      )}

      <p className="fit-ring-disclaimer">{FIT_SCORE_DISCLAIMER}</p>

      {targetScore !== null && (
        <div className="fit-ring-calculation-wrap">
          <button
            type="button"
            className="btn-link fit-calc-toggle"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            aria-controls={disclosureId}
          >
            <span className="toggle-caret" aria-hidden="true">
              {expanded ? "▾" : "▸"}
            </span>
            <span>How is this calculated?</span>
          </button>

          {expanded && (
            <div id={disclosureId} className="fit-calc-details panel">
              <table className="fit-breakdown-table" aria-label="Evidence fit score components">
                <thead>
                  <tr>
                    <th scope="col">Dimension</th>
                    <th scope="col">Status</th>
                    <th scope="col" style={{ textAlign: "right" }}>Points</th>
                  </tr>
                </thead>
                <tbody>
                  {fit.parts.map((part) => (
                    <tr key={part.dimension}>
                      <th scope="row" style={{ fontWeight: 550 }}>
                        {DIM_LABEL[part.dimension] ?? part.dimension}
                      </th>
                      <td>
                        <span className={`fit-status-tag ${part.status}`}>
                          {STATUS_LABEL[part.status] ?? part.status}
                        </span>
                      </td>
                      <td style={{ textAlign: "right", fontFamily: "var(--mono)" }}>
                        {part.points.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                  {fit.languageRiskDeduction > 0 && (
                    <tr className="fit-adjustment-row">
                      <th scope="row" colSpan={2}>
                        Language risks deduction ({fit.reviewRiskCount} flagged)
                      </th>
                      <td style={{ textAlign: "right", fontFamily: "var(--mono)", color: "var(--bad)" }}>
                        −{fit.languageRiskDeduction}
                      </td>
                    </tr>
                  )}
                  {fit.capApplied !== "none" && (
                    <tr className="fit-adjustment-row">
                      <th scope="row" colSpan={2}>
                        Verdict cap applied ({fit.capApplied === "not_supported" ? "Not supported" : "Needs review"})
                      </th>
                      <td style={{ textAlign: "right", fontFamily: "var(--mono)", color: "var(--warn-ink)" }}>
                        ≤ {fit.capApplied === "not_supported" ? 49 : 79}
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row" colSpan={2}>
                      Final {FIT_SCORE_LABEL}
                    </th>
                    <td style={{ textAlign: "right", fontWeight: 700, fontFamily: "var(--mono)" }}>
                      {fit.score} / 100
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function FitRingSkeleton() {
  return (
    <div className="fit-ring-card panel fit-ring-skeleton" aria-hidden="true">
      <div className="fit-ring-header">
        <div className="skel-line" style={{ width: 60, height: 18 }} />
      </div>
      <div className="fit-ring-visual-wrap">
        <div className="skel-ring" />
      </div>
      <div className="skel-line" style={{ width: "90%", height: 12, margin: "12px auto 0" }} />
    </div>
  );
}
