import type { Comparison, Dimension } from "./types";
import { DIM_HELP, DIM_LABEL, reasonLabel } from "./labels";
import { Chevron, Icon, StatusTag, statusTone } from "./ui";
import type { FindingFilterType } from "./checker/FindingsFilter";

interface FindingsProps {
  comparisons: Comparison[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  filter?: FindingFilterType;
  expandedIds?: Set<string>;
  showDetails?: boolean;
}

export function Findings({
  comparisons,
  selected,
  onSelect,
  filter = "all",
  expandedIds,
  showDetails = false,
}: FindingsProps) {
  const visible = comparisons.filter((c) => {
    if (filter === "all") return true;
    if (filter === "contradicted") return c.status === "contradicted";
    if (filter === "unknown") return c.status === "unknown";
    if (filter === "supported") return c.status === "supported";
    return true;
  });

  return (
    <div className="panel findings" role="list">
      {visible.map((c, i) => {
        const isDirectlySelected = selected === c.dimension;
        const isOpen = isDirectlySelected || (expandedIds ? expandedIds.has(c.dimension) : false);
        const panelId = `f-${c.dimension}`;
        return (
          <div
            key={c.dimension}
            role="listitem"
            className={`finding${isOpen ? " open" : ""}${isDirectlySelected ? " sel" : ""}`}
            style={{ ["--i" as string]: i }}
          >
            <button
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => onSelect(isOpen && !expandedIds?.has(c.dimension) ? null : c.dimension)}
            >
              <span style={{ color: `var(--${statusTone(c.status)})` }}>
                <Icon tone={statusTone(c.status)} />
              </span>
              <span className="f-name">
                {DIM_LABEL[c.dimension as Dimension]}
                <small>{DIM_HELP[c.dimension as Dimension]}</small>
              </span>
              <span className="f-reason">
                {reasonLabel(c.reason_code)}
                {showDetails && (
                  <span className="code details-code"> [{c.reason_code}]</span>
                )}
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                <StatusTag status={c.status} />
                <Chevron />
              </span>
            </button>
            <div
              className="detail"
              id={panelId}
              role="region"
              aria-label={`${DIM_LABEL[c.dimension as Dimension]} details`}
            >
              <div>
                <div className="detail-in">
                  <p>{c.explanation}</p>
                  <div className="quotes">
                    <div className="quote">
                      <small>Draft says</small>
                      {c.claim_raw ? (
                        <q>{c.claim_raw}</q>
                      ) : (
                        <span className="none">Not stated in the draft</span>
                      )}
                    </div>
                    <div className="quote">
                      <small>Evidence says</small>
                      {c.evidence_raw ? (
                        <q>{c.evidence_raw}</q>
                      ) : (
                        <span className="none">Not stated in the evidence</span>
                      )}
                    </div>
                  </div>
                  {c.needs_human && (
                    <div className="human">
                      <Icon tone="warn" size={15} />
                      A person should review this finding.
                    </div>
                  )}
                  <span className="code">Reason code: {c.reason_code}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { RiskCards as Risks } from "./checker/RiskCards";
