import { useState, useMemo } from "react";
import type { Example } from "../types";
import { CHECKER_COPY } from "./copy.checker";

interface ScenarioPickerProps {
  examples: Example[];
  activeExampleId?: string | null;
  onSelectExample: (example: Example) => void;
}

export function ScenarioPicker({
  examples,
  activeExampleId,
  onSelectExample,
}: ScenarioPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState("");

  const filteredExamples = useMemo(() => {
    if (!filter.trim()) return examples;
    const f = filter.toLowerCase();
    return examples.filter(
      (e) =>
        e.title.toLowerCase().includes(f) ||
        e.blurb.toLowerCase().includes(f) ||
        e.tag.toLowerCase().includes(f)
    );
  }, [examples, filter]);

  const handleSurpriseMe = () => {
    if (!examples.length) return;
    const randomIndex = Math.floor(Math.random() * examples.length);
    onSelectExample(examples[randomIndex]);
    setIsOpen(false);
  };

  return (
    <div className="scenario-picker-wrap">
      <div className="scenario-picker-bar">
        <button
          type="button"
          className="chip scenario-trigger-chip"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
        >
          <span>{CHECKER_COPY.scenarios.browseAll}</span>
          <span className="chip-caret" aria-hidden="true">{isOpen ? "▴" : "▾"}</span>
        </button>

        <button
          type="button"
          className="btn-link surprise-btn"
          onClick={handleSurpriseMe}
          title="Load a randomly selected scenario"
        >
          {CHECKER_COPY.scenarios.surpriseMe}
        </button>
      </div>

      {isOpen && (
        <div
          className="scenario-picker-popover panel"
          role="dialog"
          aria-label="Select a test scenario"
        >
          <div className="popover-search">
            <input
              type="text"
              placeholder={CHECKER_COPY.scenarios.search}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="scenario-search-input"
              autoFocus
            />
            <button
              type="button"
              className="btn-icon small-close-btn"
              onClick={() => setIsOpen(false)}
              aria-label="Close scenarios popover"
            >
              ✕
            </button>
          </div>

          <div className="scenario-popover-list" role="list">
            {filteredExamples.map((ex) => {
              const isSelected = ex.id === activeExampleId;
              return (
                <button
                  key={ex.id}
                  type="button"
                  className={`scenario-card-item ${isSelected ? "selected" : ""}`}
                  onClick={() => {
                    onSelectExample(ex);
                    setIsOpen(false);
                  }}
                >
                  <div className="scenario-card-top">
                    <span className="scenario-card-title">{ex.title}</span>
                    <span className="sticker small-sticker sunk">{ex.tag}</span>
                  </div>
                  <p className="scenario-card-blurb">{ex.blurb}</p>
                </button>
              );
            })}
            {filteredExamples.length === 0 && (
              <p className="scenario-empty">No matching scenarios found.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
