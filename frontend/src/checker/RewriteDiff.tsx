import { useState, useMemo } from "react";
import { computeWordDiff } from "./diff";
import { CHECKER_COPY } from "./copy.checker";

interface RewriteDiffProps {
  originalClaim: string;
  suggestedText: string;
  onUseAsDraft?: (text: string) => void;
  onCopy?: (text: string) => void;
}

export function RewriteDiff({
  originalClaim,
  suggestedText,
  onUseAsDraft,
  onCopy,
}: RewriteDiffProps) {
  const [viewMode, setViewMode] = useState<"diff" | "clean">("diff");
  const [copied, setCopied] = useState(false);

  const diffTokens = useMemo(() => {
    return computeWordDiff(originalClaim, suggestedText);
  }, [originalClaim, suggestedText]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(suggestedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onCopy?.(suggestedText);
    } catch {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = suggestedText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onCopy?.(suggestedText);
    }
  };

  return (
    <div className="rewrite-diff-panel panel" aria-label="Wording diff">
      <div className="diff-header">
        <div className="diff-title-row">
          <span className="diff-badge sticker">Comparison</span>
          <span className="diff-legend">
            <span className="legend-sample del" aria-hidden="true">— removed</span>
            <span className="legend-sample ins" aria-hidden="true">+ added</span>
          </span>
        </div>

        <div className="diff-controls">
          <div className="diff-mode-toggle" role="radiogroup" aria-label="Diff view mode">
            <button
              type="button"
              className={`chip small-chip ${viewMode === "diff" ? "selected" : ""}`}
              onClick={() => setViewMode("diff")}
              role="radio"
              aria-checked={viewMode === "diff"}
            >
              {CHECKER_COPY.diff.diffView}
            </button>
            <button
              type="button"
              className={`chip small-chip ${viewMode === "clean" ? "selected" : ""}`}
              onClick={() => setViewMode("clean")}
              role="radio"
              aria-checked={viewMode === "clean"}
            >
              {CHECKER_COPY.diff.cleanView}
            </button>
          </div>

          <div className="diff-actions">
            <button
              type="button"
              className="btn small"
              onClick={handleCopy}
              aria-label="Copy suggested wording"
            >
              {copied ? "Copied!" : CHECKER_COPY.diff.copyWording}
            </button>
            {onUseAsDraft && (
              <button
                type="button"
                className="btn primary small"
                onClick={() => onUseAsDraft(suggestedText)}
                aria-label="Apply suggested wording to draft"
              >
                {CHECKER_COPY.diff.useAsDraft}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="diff-display" tabIndex={0} role="region" aria-label="Wording comparison">
        {viewMode === "clean" ? (
          <p className="clean-text">{suggestedText}</p>
        ) : (
          <p className="diff-text">
            {diffTokens.map((tok, idx) => {
              if (tok.type === "insert") {
                return (
                  <ins key={idx} className="diff-ins" title="Added in suggestion">
                    {tok.text}
                  </ins>
                );
              }
              if (tok.type === "delete") {
                return (
                  <del key={idx} className="diff-del" title="Removed from original">
                    {tok.text}
                  </del>
                );
              }
              return <span key={idx}>{tok.text}</span>;
            })}
          </p>
        )}
      </div>
    </div>
  );
}
