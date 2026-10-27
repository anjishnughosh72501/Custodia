import { useState, useEffect } from "react";
import { Icon } from "../ui";
import { CHECKER_COPY } from "./copy.checker";

const STORAGE_KEY = "custodia_legend_open";

export function Legend() {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved !== null) {
        setOpen(saved === "true");
      }
    } catch {
      // ignore
    }
  }, []);

  const toggle = () => {
    setOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  return (
    <div className="panel legend-panel">
      <button
        type="button"
        className="legend-toggle"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="legend-body"
      >
        <span className="legend-toggle-title">
          <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" aria-hidden="true">
            <path d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 14a6 6 0 110-12 6 6 0 010 12zm0-9a1 1 0 011 1v4a1 1 0 11-2 0V8a1 1 0 011-1zm0-3a1.2 1.2 0 110 2.4A1.2 1.2 0 0110 5z" />
          </svg>
          {CHECKER_COPY.legend.title}
        </span>
        <span className="legend-chev" aria-hidden="true">
          {open ? "−" : "+"}
        </span>
      </button>

      {open && (
        <div id="legend-body" className="legend-body">
          <p className="legend-summary">{CHECKER_COPY.legend.summary}</p>
          <ul className="legend-items">
            <li className="legend-item ok">
              <span className="legend-icon ok">
                <Icon tone="ok" size={14} />
              </span>
              <span>{CHECKER_COPY.legend.supported}</span>
            </li>
            <li className="legend-item warn">
              <span className="legend-icon warn">
                <Icon tone="warn" size={14} />
              </span>
              <span>{CHECKER_COPY.legend.needsReview}</span>
            </li>
            <li className="legend-item bad">
              <span className="legend-icon bad">
                <Icon tone="bad" size={14} />
              </span>
              <span>{CHECKER_COPY.legend.contradicted}</span>
            </li>
          </ul>

          <div className="legend-dims">
            <span className="legend-dims-title">{CHECKER_COPY.legend.dimensionsTitle}</span>
            <p className="legend-dims-desc">{CHECKER_COPY.legend.dimensionsDesc}</p>
          </div>
        </div>
      )}
    </div>
  );
}
