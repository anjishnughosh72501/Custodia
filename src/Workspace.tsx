import React, { useRef, useState, useEffect, useMemo } from "react";
import type { Example, Health } from "./types";
import { useDraft } from "./checker/useDraft";
import { CHECKER_COPY } from "./checker/copy.checker";
import { ScenarioPicker } from "./checker/ScenarioPicker";
import { uploadDocument } from "./api";
import { Upload, Loader2 } from "lucide-react";

interface Props {
  claim: string;
  evidence: string;
  setClaim: (s: string) => void;
  setEvidence: (s: string) => void;
  limits: Health["limits"];
  examples: Example[];
  activeExample: string | null;
  onExample: (e: Example) => void;
  onSubmit: () => void;
  onReset: () => void;
  loading: boolean;
  stillWorking?: boolean;
  touched: boolean;
  onToast?: (msg: string, tone?: "ok" | "warn" | "bad") => void;
}

export function Workspace(p: Props) {
  const [showAll, setShowAll] = useState(false);
  const [isParsingDoc, setIsParsingDoc] = useState(false);
  const claimRef = useRef<HTMLTextAreaElement>(null);
  const evidenceRef = useRef<HTMLTextAreaElement>(null);
  const evidenceFileInputRef = useRef<HTMLInputElement>(null);

  const { showBanner, restore, dismiss } = useDraft(p.claim, p.evidence);

  const cOver = p.claim.length > p.limits.claim_chars;
  const eOver = p.evidence.length > p.limits.evidence_chars;
  const cEmpty = !p.claim.trim();
  const eEmpty = !p.evidence.trim();

  const cErr = cOver
    ? `Shorten the claim by ${p.claim.length - p.limits.claim_chars} characters.`
    : p.touched && cEmpty
    ? "Enter the marketing claim you want to check."
    : "";

  const eErr = eOver
    ? `Shorten the evidence by ${p.evidence.length - p.limits.evidence_chars} characters.`
    : p.touched && eEmpty
    ? "Paste the evidence that is meant to support the claim."
    : "";

  const shown = showAll ? p.examples : p.examples.slice(0, 5);
  const active = p.examples.find((e) => e.id === p.activeExample);

  // Auto-grow textarea up to 380px
  const handleAutoGrow = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    const nextH = Math.min(el.scrollHeight, 380);
    el.style.height = `${Math.max(nextH, 150)}px`;
  };

  useEffect(() => {
    handleAutoGrow(claimRef.current);
  }, [p.claim]);

  useEffect(() => {
    handleAutoGrow(evidenceRef.current);
  }, [p.evidence]);

  const handlePaste = async (target: "claim" | "evidence") => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (target === "claim") {
          p.setClaim(text);
        } else {
          p.setEvidence(text);
        }
        p.onToast?.("Pasted from clipboard", "ok");
      } else {
        p.onToast?.("Use Ctrl+V or ⌘+V to paste into field", "warn");
      }
    } catch {
      p.onToast?.("Clipboard permission denied or unavailable", "warn");
    }
  };

  const processEvidenceFile = async (file: File) => {
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();

    // Plain text or Markdown files
    if (ext === ".txt" || ext === ".md") {
      const reader = new FileReader();
      reader.onload = (evt) => {
        const text = evt.target?.result as string;
        if (text) {
          p.setEvidence(text);
          p.onToast?.(`Loaded ${file.name} (${text.length.toLocaleString()} chars)`, "ok");
        }
      };
      reader.onerror = () => {
        p.onToast?.(`Could not read ${file.name}`, "bad");
      };
      reader.readAsText(file);
      return;
    }

    // Rich documents & spreadsheets: PDF, DOCX, XLSX, CSV
    if ([".pdf", ".docx", ".xlsx", ".csv"].includes(ext)) {
      setIsParsingDoc(true);
      p.onToast?.(`Parsing and extracting passages from ${file.name}…`, "ok");
      try {
        const parsed = await uploadDocument(file);
        if (!parsed.chunks || parsed.chunks.length === 0) {
          p.onToast?.(`No text passages could be extracted from ${file.name}.`, "warn");
          return;
        }
        const combined = parsed.chunks
          .map((c) => {
            const loc = [
              c.page_number ? `p. ${c.page_number}` : "",
              c.paragraph_index ? `para. ${c.paragraph_index}` : "",
              c.cell_reference ? `cell ${c.cell_reference}` : "",
            ]
              .filter(Boolean)
              .join(", ");
            const header = loc ? `[${file.name} · ${loc}]` : `[${file.name}]`;
            return `${header}\n${c.text.trim()}`;
          })
          .join("\n\n---\n\n");

        p.setEvidence(combined);
        p.onToast?.(
          `Extracted ${parsed.chunks.length} passage(s) from ${file.name} (${combined.length.toLocaleString()} chars)`,
          "ok"
        );
      } catch (err: any) {
        p.onToast?.(err.message || `Failed to extract passages from ${file.name}`, "bad");
      } finally {
        setIsParsingDoc(false);
        if (evidenceFileInputRef.current) {
          evidenceFileInputRef.current.value = "";
        }
      }
      return;
    }

    p.onToast?.("Supported formats: .pdf, .docx, .xlsx, .csv, .txt, .md", "warn");
  };

  const handleFileDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    if (!e.dataTransfer?.files?.length) return;
    const file = e.dataTransfer.files[0];
    processEvidenceFile(file);
  };

  const handleRestoreDraft = () => {
    const draft = restore();
    if (draft) {
      p.setClaim(draft.claim);
      p.setEvidence(draft.evidence);
      p.onToast?.("Draft restored", "ok");
    }
  };

  const key = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      if (!p.loading) p.onSubmit();
    }
  };

  const cPct = Math.min(100, (p.claim.length / p.limits.claim_chars) * 100);
  const ePct = Math.min(100, (p.evidence.length / p.limits.evidence_chars) * 100);

  // Client-side guidance hints (strictly hints, never findings)
  const claimHints = useMemo(() => {
    const hints: string[] = [];
    const t = p.claim.trim();
    if (t) {
      const sentences = t.split(/[.!?]+\s+/).filter(Boolean);
      if (sentences.length > 1) {
        hints.push("Hint: Multiple sentences detected. Custodia evaluates one claim at a time best.");
      }
      if (!/\d/.test(t)) {
        hints.push("Hint: No numbers detected. If checking a quantified metric, include the specific figure.");
      }
    }
    return hints;
  }, [p.claim]);

  const evidenceHints = useMemo(() => {
    const hints: string[] = [];
    const t = p.evidence.trim();
    if (t) {
      if (t.length < 35 || t.split(/\s+/).length < 5) {
        hints.push("Hint: Evidence is very brief. Supplying complete context helps match all dimensions.");
      }
    }
    return hints;
  }, [p.evidence]);

  return (
    <div className="panel workspace-panel" onKeyDown={key}>
      {showBanner && (
        <div className="draft-restore-banner" role="status">
          <span>{CHECKER_COPY.workspace.restoreDraft}</span>
          <div className="draft-actions">
            <button
              type="button"
              className="btn small primary"
              onClick={handleRestoreDraft}
            >
              {CHECKER_COPY.workspace.restoreDraftAction}
            </button>
            <button
              type="button"
              className="btn-link dismiss-draft-btn"
              onClick={dismiss}
            >
              {CHECKER_COPY.workspace.dismissDraft}
            </button>
          </div>
        </div>
      )}

      {p.examples.length > 0 && (
        <div className="scenarios" role="group" aria-label="Example scenarios">
          <span>Try a scenario</span>
          {shown.map((e) => (
            <button
              key={e.id}
              className="chip"
              aria-pressed={e.id === p.activeExample}
              onClick={() => p.onExample(e)}
            >
              {e.title}
            </button>
          ))}
          {p.examples.length > 5 && (
            <button
              className="chip link"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? "Show fewer" : `${p.examples.length - 5} more`}
            </button>
          )}
          <ScenarioPicker
            examples={p.examples}
            activeExampleId={p.activeExample}
            onSelectExample={p.onExample}
          />
          {active && (
            <p className="scenario-note">
              <b>{active.tag}:</b> {active.blurb}{" "}
              <i>(Illustrative teaching case, not a benchmark.)</i>
            </p>
          )}
        </div>
      )}

      <div className="fields">
        <div className="field claim">
          <div className="field-header field-meta">
            <label htmlFor="claim">Draft marketing claim</label>
            <div className="field-quick-actions">
              <button
                type="button"
                className="btn-link quick-btn"
                onClick={() => handlePaste("claim")}
                aria-label="Paste claim from clipboard"
              >
                {CHECKER_COPY.workspace.paste}
              </button>
              {p.claim.length > 0 && (
                <>
                  <span className="dot-sep" aria-hidden="true">·</span>
                  <button
                    type="button"
                    className="btn-link quick-btn clear-btn"
                    onClick={() => p.setClaim("")}
                    aria-label="Clear claim text"
                  >
                    {CHECKER_COPY.workspace.clear}
                  </button>
                </>
              )}
            </div>
          </div>
          <p className="hint" id="claim-h">
            The sentence you want to publish.
          </p>
          <textarea
            ref={claimRef}
            id="claim"
            value={p.claim}
            onChange={(e) => p.setClaim(e.target.value)}
            aria-describedby="claim-h claim-f"
            aria-invalid={!!cErr}
            placeholder="Our platform cuts setup time by 40% for every business."
          />
          <div className="field-char-progress" aria-hidden="true">
            <div
              className={`char-progress-bar ${cOver ? "over" : ""}`}
              style={{ width: `${cPct}%` }}
            />
          </div>
          <div className="field-foot" id="claim-f">
            <span className="err" role={cErr ? "alert" : undefined}>
              {cErr}
            </span>
            <span className={`count${cOver ? " over" : ""}`}>
              {p.claim.length.toLocaleString()} / {p.limits.claim_chars.toLocaleString()}
            </span>
          </div>
          {claimHints.length > 0 && (
            <div className="field-hints-list">
              {claimHints.map((h, i) => (
                <p key={i} className="field-hint-text">{h}</p>
              ))}
            </div>
          )}
        </div>

        <div className="field evidence">
          <div className="field-header field-meta">
            <label htmlFor="evidence">Supporting evidence</label>
            <div className="field-quick-actions">
              <input
                ref={evidenceFileInputRef}
                type="file"
                accept=".pdf,.docx,.xlsx,.csv,.txt,.md"
                style={{ display: "none" }}
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    processEvidenceFile(e.target.files[0]);
                  }
                }}
              />
              <button
                type="button"
                className="btn-link quick-btn upload-doc-btn"
                onClick={() => evidenceFileInputRef.current?.click()}
                disabled={isParsingDoc || p.loading}
                aria-label="Upload document as evidence (PDF, DOCX, XLSX, CSV, TXT, MD)"
                title="Upload PDF, DOCX, XLSX, CSV, TXT, or MD"
              >
                {isParsingDoc ? (
                  <>
                    <Loader2 style={{ width: 12, height: 12, marginRight: 4, verticalAlign: "middle" }} className="spin inline-spin" />
                    <span>Extracting…</span>
                  </>
                ) : (
                  <>
                    <Upload style={{ width: 12, height: 12, marginRight: 4, verticalAlign: "middle" }} />
                    <span>Upload file</span>
                  </>
                )}
              </button>
              <span className="dot-sep" aria-hidden="true">·</span>
              <button
                type="button"
                className="btn-link quick-btn"
                onClick={() => handlePaste("evidence")}
                aria-label="Paste evidence from clipboard"
              >
                {CHECKER_COPY.workspace.paste}
              </button>
              {p.evidence.length > 0 && (
                <>
                  <span className="dot-sep" aria-hidden="true">·</span>
                  <button
                    type="button"
                    className="btn-link quick-btn clear-btn"
                    onClick={() => p.setEvidence("")}
                    aria-label="Clear evidence text"
                  >
                    {CHECKER_COPY.workspace.clear}
                  </button>
                </>
              )}
            </div>
          </div>
          <p className="hint" id="ev-h">
            Paste source text or drop a file (.pdf, .docx, .xlsx, .csv, .txt). Extracted safely as data, never executed.
          </p>
          <textarea
            ref={evidenceRef}
            id="evidence"
            value={p.evidence}
            onChange={(e) => p.setEvidence(e.target.value)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
            aria-describedby="ev-h ev-f"
            aria-invalid={!!eErr}
            placeholder="In a 30-day test of 120 small-business customers using Pro, median setup time fell by 30%."
          />
          <div className="field-char-progress" aria-hidden="true">
            <div
              className={`char-progress-bar ${eOver ? "over" : ""}`}
              style={{ width: `${ePct}%` }}
            />
          </div>
          <div className="field-foot" id="ev-f">
            <span className="err" role={eErr ? "alert" : undefined}>
              {eErr}
            </span>
            <span className={`count${eOver ? " over" : ""}`}>
              {p.evidence.length.toLocaleString()} / {p.limits.evidence_chars.toLocaleString()}
            </span>
          </div>
          {evidenceHints.length > 0 && (
            <div className="field-hints-list">
              {evidenceHints.map((h, i) => (
                <p key={i} className="field-hint-text">{h}</p>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="actions">
        <button
          className="btn primary"
          onClick={p.onSubmit}
          disabled={p.loading || cOver || eOver}
        >
          {p.loading && <span className="spin" aria-hidden="true" />}
          {p.loading ? (p.stillWorking ? "Still working…" : "Checking…") : "Check claim"}
        </button>
        <button className="btn" onClick={p.onReset} disabled={p.loading}>
          Reset
        </button>
        <span className="kbd">Ctrl or ⌘ + Enter to check</span>
      </div>
    </div>
  );
}
