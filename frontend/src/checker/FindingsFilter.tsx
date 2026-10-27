import { CHECKER_COPY } from "./copy.checker";

export type FindingFilterType = "all" | "contradicted" | "unknown" | "supported";

interface FindingsFilterProps {
  activeFilter: FindingFilterType;
  onFilterChange: (f: FindingFilterType) => void;
  counts: { all: number; contradicted: number; unknown: number; supported: number };
  onExpandAll: () => void;
  onCollapseAll: () => void;
  showDetails: boolean;
  onToggleDetails: () => void;
}

export function FindingsFilter({
  activeFilter,
  onFilterChange,
  counts,
  onExpandAll,
  onCollapseAll,
  showDetails,
  onToggleDetails,
}: FindingsFilterProps) {
  return (
    <div className="findings-toolbar" role="toolbar" aria-label="Filter dimension findings">
      <div className="filter-chips-group">
        <button
          type="button"
          className={`chip filter-chip ${activeFilter === "all" ? "active" : ""}`}
          aria-pressed={activeFilter === "all"}
          onClick={() => onFilterChange("all")}
        >
          {CHECKER_COPY.filter.all} ({counts.all})
        </button>

        <button
          type="button"
          className={`chip filter-chip bad ${activeFilter === "contradicted" ? "active" : ""}`}
          aria-pressed={activeFilter === "contradicted"}
          onClick={() => onFilterChange("contradicted")}
        >
          {CHECKER_COPY.filter.contradicted} ({counts.contradicted})
        </button>

        <button
          type="button"
          className={`chip filter-chip warn ${activeFilter === "unknown" ? "active" : ""}`}
          aria-pressed={activeFilter === "unknown"}
          onClick={() => onFilterChange("unknown")}
        >
          {CHECKER_COPY.filter.needsReview} ({counts.unknown})
        </button>

        <button
          type="button"
          className={`chip filter-chip ok ${activeFilter === "supported" ? "active" : ""}`}
          aria-pressed={activeFilter === "supported"}
          onClick={() => onFilterChange("supported")}
        >
          {CHECKER_COPY.filter.supported} ({counts.supported})
        </button>
      </div>

      <div className="toolbar-controls-group">
        <button
          type="button"
          className="btn-link toolbar-link-btn"
          onClick={onExpandAll}
          aria-label="Expand all dimension findings"
        >
          {CHECKER_COPY.filter.expandAll}
        </button>
        <span className="dot-sep" aria-hidden="true">·</span>
        <button
          type="button"
          className="btn-link toolbar-link-btn"
          onClick={onCollapseAll}
          aria-label="Collapse all dimension findings"
        >
          {CHECKER_COPY.filter.collapseAll}
        </button>
        <span className="dot-sep" aria-hidden="true">·</span>
        <button
          type="button"
          className={`btn-link toolbar-link-btn details-toggle-btn ${showDetails ? "active" : ""}`}
          onClick={onToggleDetails}
          aria-pressed={showDetails}
          aria-label="Toggle technical reason codes"
        >
          {showDetails ? CHECKER_COPY.filter.hideDetails : CHECKER_COPY.filter.showDetails}
        </button>
      </div>
    </div>
  );
}
