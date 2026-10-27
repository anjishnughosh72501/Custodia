import { useState } from "react";
import type { LanguageRisk } from "../types";
import { CHECKER_COPY } from "./copy.checker";

const CATEGORY_LABEL: Record<string, string> = {
  causation_vs_correlation: "Causation vs correlation",
  hedging: "Hedged wording",
  superlative: "Absolute claim",
  scope_inflation: "Broad scope",
  unsupported_projection: "Forward projection",
  unquantified_comparison: "Unquantified comparison",
  context_omission: "Missing context",
};

interface RiskCardsProps {
  risks: LanguageRisk[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  consideredRisks?: Record<string, boolean>;
  onToggleConsidered?: (id: string) => void;
}

export function RiskCards({
  risks,
  selected,
  onSelect,
  consideredRisks = {},
  onToggleConsidered,
}: RiskCardsProps) {
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});

  if (!risks.length) {
    return (
      <div className="panel empty" role="region" aria-label="Language risks">
        <p>No wording risks found by the rule-based checks. That is not a guarantee: the rules cover a fixed list of patterns in English.</p>
      </div>
    );
  }

  const consideredCount = risks.reduce((count, _, i) => {
    return count + (consideredRisks[`risk:${i}`] ? 1 : 0);
  }, 0);
  const totalCount = risks.length;
  const percent = Math.round((consideredCount / totalCount) * 100);

  const toggleDetails = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedDetails((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="panel risk-section" role="region" aria-label="Language risks">
      {/* Review progress bar */}
      <div className="risk-progress-container" aria-label="Language risks consideration progress">
        <div className="risk-progress-meta">
          <span className="risk-progress-label">
            {CHECKER_COPY.risks.title} ({consideredCount}/{totalCount} {CHECKER_COPY.risks.considered.toLowerCase()})
          </span>
          <span className="risk-progress-percent">{percent}%</span>
        </div>
        <div className="risk-progress-track" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
          <div className="risk-progress-fill" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <div className="risk-cards-grid">
        {risks.map((r, i) => {
          const id = `risk:${i}`;
          const isSel = selected === id;
          const isConsidered = !!consideredRisks[id];
          const isExpanded = !!expandedDetails[id];

          return (
            <div
              key={id}
              className={`risk-card ${isSel ? "sel" : ""} ${isConsidered ? "considered" : ""}`}
            >
              <button
                type="button"
                className={`risk ${isSel ? "sel" : ""}`}
                aria-pressed={isSel}
                onClick={() => onSelect(isSel ? null : id)}
              >
                <div className="risk-card-top risk-head">
                  <span className="risk-title">{r.title}</span>
                  <span className={`sticker small-sticker ${r.severity === "review" ? "warn" : "sunk"}`}>
                    {r.severity === "review" ? "Review" : "Note"}
                  </span>
                </div>

                <div className="risk-card-category code">
                  {CATEGORY_LABEL[r.category] ?? r.category}
                  {r.source === "model" ? " · model-flagged, quote verified" : ""}
                </div>

                <p className="risk-card-explanation">{r.explanation}</p>
              </button>

              <div className="risk-card-footer">
                <button
                  type="button"
                  className="risk-resolve-toggle btn-link"
                  onClick={(e) => toggleDetails(id, e)}
                  aria-expanded={isExpanded}
                >
                  <span className="toggle-caret" aria-hidden="true">{isExpanded ? "▾" : "▸"}</span>
                  <span>{CHECKER_COPY.risks.resolve}</span>
                </button>

                {isExpanded && (
                  <div className="risk-resolve-body">
                    <p>{r.resolution}</p>
                  </div>
                )}

                {onToggleConsidered && (
                  <label className="risk-considered-checkbox">
                    <input
                      type="checkbox"
                      checked={isConsidered}
                      onChange={() => onToggleConsidered(id)}
                    />
                    <span>{CHECKER_COPY.risks.considered}</span>
                  </label>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
