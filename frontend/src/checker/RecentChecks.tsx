import { useState } from "react";
import { Link } from "../router";
import { useLocalList, type LocalReviewItem } from "./useLocalList";
import { CHECKER_COPY } from "./copy.checker";
import { VERDICT_TITLE, VERDICT_TONE } from "../labels";
import type { VerdictStatus } from "../types";

interface RecentChecksProps {
  onLoadText?: (claim: string, evidence: string) => void;
  className?: string;
}

export function RecentChecks({ onLoadText, className = "" }: RecentChecksProps) {
  const { items, clearAll } = useLocalList();
  const [confirmingClear, setConfirmingClear] = useState(false);

  const handleClear = () => {
    if (confirmingClear) {
      clearAll();
      setConfirmingClear(false);
    } else {
      setConfirmingClear(true);
      setTimeout(() => setConfirmingClear(false), 4000);
    }
  };

  return (
    <div className={`panel recent-checks-panel ${className}`} aria-label="Recent checks">
      <div className="recent-head">
        <h3 className="recent-title">{CHECKER_COPY.recent.title}</h3>
        {items.length > 0 && (
          <button
            type="button"
            className="btn-link clear-all-btn"
            onClick={handleClear}
            aria-label="Clear all recent checks"
          >
            {confirmingClear ? "Confirm clear?" : CHECKER_COPY.recent.clearAll}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="recent-empty">
          <p>{CHECKER_COPY.recent.empty}</p>
        </div>
      ) : (
        <ul className="recent-list" role="list">
          {items.map((item: LocalReviewItem) => {
            const tone = VERDICT_TONE[item.verdictStatus as VerdictStatus] ?? "warn";
            const title = VERDICT_TITLE[item.verdictStatus as VerdictStatus] ?? item.verdictStatus;
            return (
              <li key={item.id} className="recent-item">
                <div className="recent-item-main">
                  <div className="recent-item-header">
                    <span className={`sticker ${tone} small-sticker`}>{title}</span>
                    <span className="recent-item-time">
                      {new Date(item.timestamp).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  <Link href={`/r/${item.id}`} className="recent-snippet-link">
                    “{item.claimSnippet}…”
                  </Link>
                </div>
                {onLoadText && item.claimFull && (
                  <button
                    type="button"
                    className="load-again-btn"
                    onClick={() => onLoadText(item.claimFull, item.evidenceFull)}
                    title="Load claim and evidence text back into fields"
                  >
                    {CHECKER_COPY.recent.loadAgain}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="recent-local-note">{CHECKER_COPY.recent.localNote}</p>
    </div>
  );
}
