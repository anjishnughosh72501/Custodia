import { useEffect, useState } from "react";
import type { Review } from "../types";
import { VERDICT_TITLE, VERDICT_TONE } from "../labels";

interface MiniVerdictBarProps {
  review: Review | null;
  onJumpToVerdict: () => void;
}

export function MiniVerdictBar({ review, onJumpToVerdict }: MiniVerdictBarProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!review) {
      setVisible(false);
      return;
    }

    const checkScroll = () => {
      const verdictEl = document.getElementById("verdict-card");
      if (!verdictEl) {
        setVisible(false);
        return;
      }
      const rect = verdictEl.getBoundingClientRect();
      // When the bottom of the verdict card has scrolled above the viewport (e.g. rect.bottom < 60px)
      setVisible(rect.bottom < 60);
    };

    window.addEventListener("scroll", checkScroll, { passive: true });
    checkScroll();
    return () => window.removeEventListener("scroll", checkScroll);
  }, [review]);

  if (!review || !visible) return null;

  const tone = VERDICT_TONE[review.verdict.status] ?? "warn";
  const title = VERDICT_TITLE[review.verdict.status] ?? review.verdict.status;

  const counts = review.comparisons.reduce(
    (acc, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1;
      return acc;
    },
    { supported: 0, contradicted: 0, abstain: 0 } as Record<string, number>
  );

  return (
    <div className="mini-verdict-bar" role="region" aria-label="Quick verdict status">
      <div className="mini-verdict-inner">
        <div className="mini-verdict-status">
          <span className={`sticker ${tone} mini-sticker`}>{title}</span>
          <span className="mini-verdict-counts">
            <span className="count-dot supported" title="Supported dimensions">
              {counts.supported} supported
            </span>
            {counts.contradicted > 0 && (
              <span className="count-dot contradicted" title="Contradicted dimensions">
                · {counts.contradicted} contradicted
              </span>
            )}
            {counts.abstain > 0 && (
              <span className="count-dot abstain" title="Abstained dimensions">
                · {counts.abstain} abstain
              </span>
            )}
          </span>
        </div>

        <button
          type="button"
          className="btn small mini-verdict-jump-btn"
          onClick={onJumpToVerdict}
        >
          Jump to verdict ↑
        </button>
      </div>
    </div>
  );
}
