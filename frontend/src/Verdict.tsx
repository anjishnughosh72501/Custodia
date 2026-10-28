import type { Review } from "./types";
import { ABSTAIN_LABEL, DIM_LABEL, VERDICT_TITLE, reasonLabel } from "./labels";
import { DIMENSIONS } from "./types";
import { Icon, statusTone, verdictTone } from "./ui";

const MODE_INFO: Record<string, { label: string; tooltip: string; tone?: "warn" }> = {
  llm: {
    label: "Model-assisted",
    tooltip: "Claude proposes verbatim quotes; deterministic Python code decides the verdict.",
  },
  heuristic: {
    label: "Rule-based",
    tooltip: "Pure deterministic pattern matching; no LLM was called.",
  },
  heuristic_fallback: {
    label: "Rule-based fallback",
    tooltip: "Model call timed out or failed; deterministic fallback used.",
    tone: "warn",
  },
};

export function VerdictCard({ review, onPickDimension }: { review: Review; onPickDimension: (d: string) => void }) {
  const v = review.verdict, tone = verdictTone(v.status);
  const open = review.comparisons.filter((c) => c.status !== "supported");
  const byDim = new Map(review.comparisons.map((c) => [c.dimension, c]));
  const risks = review.language_risks.filter((r) => r.severity === "review").length;
  const modeInfo = MODE_INFO[review.extractor_mode] ?? { label: review.extractor_mode, tooltip: "" };
  return (
    <section className={`panel verdict ${tone}`} aria-labelledby="verdict-title" role="region">
      <div>
        <h2 id="verdict-title">{VERDICT_TITLE[v.status]}</h2>
        <p className="sum">{v.summary}</p>
        {open.length > 0 && (
          <ul className="why" aria-label="Why">
            {open.slice(0, 5).map((c) => (
              <li key={c.dimension}><span className="ic" style={{ color: `var(--${statusTone(c.status) === "bad" ? "bad" : "warn"})` }}><Icon tone={statusTone(c.status)} size={15} /></span>
                <span><b>{DIM_LABEL[c.dimension]}:</b> {c.explanation}</span></li>
            ))}
            {open.length > 5 && <li><span className="ic" /><span>…and {open.length - 5} more in the findings below.</span></li>}
          </ul>
        )}
        {v.abstain_reasons.filter((r) => ABSTAIN_LABEL[r]).map((r) => <p key={r} className="note-panel">{ABSTAIN_LABEL[r]}</p>)}
        <p className="scope">Checked only against the evidence you supplied. “Supported” never means the claim is objectively true.</p>
        <div className="meta-line">
          <span className={`mode-badge ${modeInfo.tone ?? ""}`} title={modeInfo.tooltip}>
            {modeInfo.label}
          </span>
          <span>Engine {review.engine_version}</span>
          <span>{risks > 0 ? `${risks} language risk${risks > 1 ? "s" : ""} to judge` : "No blocking language risks"}</span>
          {review.nli && review.nli.available && (
            <span>Semantic signal: {review.nli.predicted_label}{review.nli.disagreed_with_rules ? " (disagrees with rules)" : ""}</span>
          )}
        </div>
      </div>
      <div className="rail dimension-strip" role="group" aria-label="Seven dimensions">
        <span className="rail-cap">Seven dimensions</span>
        <div className="dimension-strip-blocks">
          {DIMENSIONS.map((d, i) => {
            const c = byDim.get(d); const t = c ? statusTone(c.status) : "warn";
            return (
              <button
                key={d}
                type="button"
                className={`dim-strip-btn ${t}`}
                style={{ ["--i" as string]: i }}
                onClick={() => onPickDimension(d)}
                aria-label={`${DIM_LABEL[d]}: ${c ? reasonLabel(c.reason_code) : "no result"}`}
                title={`${DIM_LABEL[d]}: ${c ? reasonLabel(c.reason_code) : ""}`}
              >
                <Icon tone={t} size={14} />
                <span className="dim-strip-name">{DIM_LABEL[d]}</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
