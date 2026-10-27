import { useEffect, useState } from "react";
import type { Review } from "../types";
import { generateMarkdownReport } from "./report";
import { CHECKER_COPY } from "./copy.checker";

interface ActionBarProps {
  review: Review;
  onToast: (text: string, tone?: "ok" | "warn" | "bad") => void;
  onEditAndRerun: () => void;
  consideredRisks?: Record<string, boolean>;
  className?: string;
}

export function ActionBar({
  review,
  onToast,
  onEditAndRerun,
  consideredRisks,
  className = "",
}: ActionBarProps) {
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  const handleCopyLink = async () => {
    try {
      const url = `${window.location.origin}/r/${review.id}`;
      await navigator.clipboard.writeText(url);
      onToast(CHECKER_COPY.actions.copiedLinkToast, "ok");
    } catch {
      onToast(CHECKER_COPY.actions.clipboardError, "warn");
    }
  };

  const handleCopyReport = async () => {
    try {
      const md = generateMarkdownReport(review, { consideredRisks });
      await navigator.clipboard.writeText(md);
      onToast(CHECKER_COPY.actions.copiedReportToast, "ok");
    } catch {
      onToast(CHECKER_COPY.actions.clipboardError, "warn");
    }
  };

  const handleDownloadMd = () => {
    try {
      const md = generateMarkdownReport(review, { consideredRisks });
      const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `custodia-report-${review.id}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onToast("Report downloaded (.md)", "ok");
    } catch {
      onToast("Could not download report file", "warn");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    if (!canShare) return;
    try {
      await navigator.share({
        title: "Custodia Claim Verification",
        text: `Claim verification: ${review.claim_text.slice(0, 100)}`,
        url: `${window.location.origin}/r/${review.id}`,
      });
    } catch {
      // ignore user cancel
    }
  };

  return (
    <div className={`action-bar ${className}`} role="toolbar" aria-label="Review actions">
      <button
        type="button"
        className="btn small action-btn"
        onClick={handleCopyLink}
        title="Copy shareable link to this verification"
      >
        <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
          <path d="M7.775 3.275a.75.75 0 001.06 1.06l1.25-1.25a2 2 0 112.83 2.83l-2.5 2.5a2 2 0 01-2.83 0 .75.75 0 00-1.06 1.06 3.5 3.5 0 004.95 0l2.5-2.5a3.5 3.5 0 00-4.95-4.95l-1.25 1.25zm-4.69 9.64a2 2 0 010-2.83l2.5-2.5a2 2 0 012.83 0 .75.75 0 001.06-1.06 3.5 3.5 0 00-4.95 0l-2.5 2.5a3.5 3.5 0 004.95 4.95l1.25-1.25a.75.75 0 00-1.06-1.06l-1.25 1.25a2 2 0 01-2.83 0z" />
        </svg>
        {CHECKER_COPY.actions.copyLink}
      </button>

      <button
        type="button"
        className="btn small action-btn"
        onClick={handleCopyReport}
        title="Copy complete markdown summary to clipboard"
      >
        <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
          <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z" />
          <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z" />
        </svg>
        {CHECKER_COPY.actions.copyReport}
      </button>

      <button
        type="button"
        className="btn small action-btn"
        onClick={handleDownloadMd}
        title="Download review as Markdown file"
      >
        <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
          <path d="M2.75 14A1.75 1.75 0 011 12.25v-2.5a.75.75 0 011.5 0v2.5c0 .138.112.25.25.25h10.5a.25.25 0 00.25-.25v-2.5a.75.75 0 011.5 0v2.5A1.75 1.75 0 0113.25 14H2.75z" />
          <path d="M7.25 7.689V2a.75.75 0 011.5 0v5.689l1.97-1.969a.749.749 0 111.06 1.06l-3.25 3.25a.749.749 0 01-1.06 0L4.22 6.78a.749.749 0 111.06-1.06l1.97 1.969z" />
        </svg>
        {CHECKER_COPY.actions.downloadReport}
      </button>

      <button
        type="button"
        className="btn small action-btn"
        onClick={handlePrint}
        title="Print this verification"
      >
        <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
          <path d="M4 1.75C4 .784 4.784 0 5.75 0h4.5C11.216 0 12 .784 12 1.75V3h1.5A1.75 1.75 0 0115 4.75v5.5A1.75 1.75 0 0113.25 12H12v2.25A1.75 1.75 0 0110.25 16h-4.5A1.75 1.75 0 014 14.25V12H2.75A1.75 1.75 0 011 10.25v-5.5A1.75 1.75 0 012.75 3H4V1.75zm1.5 1.25h5V1.75a.25.25 0 00-.25-.25h-4.5a.25.25 0 00-.25.25V3zm-2.75 1.5a.25.25 0 00-.25.25v5.5c0 .138.112.25.25.25h10.5a.25.25 0 00.25-.25v-5.5a.25.25 0 00-.25-.25H2.75zm2.75 6.5v3.25c0 .138.112.25.25.25h4.5a.25.25 0 00.25-.25V11h-5z" />
        </svg>
        {CHECKER_COPY.actions.printReport}
      </button>

      {canShare && (
        <button
          type="button"
          className="btn small action-btn"
          onClick={handleShare}
          title="Share verification link"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
            <path d="M13.5 5.5a2.5 2.5 0 10-1.854 4.18l-5.074 2.537a2.5 2.5 0 100 1.566l5.074-2.537A2.5 2.5 0 1013.5 5.5z" />
          </svg>
          {CHECKER_COPY.actions.share}
        </button>
      )}

      <button
        type="button"
        className="btn small action-btn edit-rerun-btn"
        onClick={onEditAndRerun}
        title="Keep wording and focus claim input to edit and re-evaluate"
      >
        <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
          <path d="M11.013 1.427a1.75 1.75 0 012.474 0l1.086 1.086a1.75 1.75 0 010 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 01-.927-.928l.929-3.25a1.75 1.75 0 01.445-.758l8.61-8.61zm1.414 1.06a.25.25 0 00-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 000-.354l-1.086-1.086zM9.75 4.81L2.812 11.75a.25.25 0 00-.063.108l-.547 1.916 1.916-.547a.25.25 0 00.108-.063L11.19 6.25 9.75 4.81z" />
        </svg>
        {CHECKER_COPY.actions.editAndRerun}
      </button>
    </div>
  );
}
