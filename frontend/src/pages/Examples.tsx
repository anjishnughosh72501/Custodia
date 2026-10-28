import { useState, useEffect, useMemo } from "react";
import { Link } from "../router";
import { getExamples } from "../api";
import { MarketingShell, prefetchChecker } from "../shells/MarketingShell";
import type { Example } from "../types";

function verdictBadge(expected: string) {
  if (expected === "SUPPORTED_BY_SUPPLIED_EVIDENCE") {
    return <span className="status-badge supported">Supported</span>;
  }
  if (expected === "NOT_SUPPORTED") {
    return <span className="status-badge contradicted">Not supported</span>;
  }
  return <span className="status-badge unknown">Needs review</span>;
}

export default function Examples() {
  const [examples, setExamples] = useState<Example[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTag, setActiveTag] = useState<string>("All");
  const [search, setSearch] = useState<string>("");

  useEffect(() => {
    getExamples()
      .then((data) => {
        setExamples(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load examples.");
        setLoading(false);
      });
  }, []);

  const tags = useMemo(() => {
    const set = new Set<string>();
    examples.forEach((ex) => {
      if (ex.tag) set.add(ex.tag);
    });
    return ["All", ...Array.from(set)];
  }, [examples]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return examples.filter((ex) => {
      const matchesTag = activeTag === "All" || ex.tag === activeTag;
      const matchesSearch =
        !q ||
        ex.title.toLowerCase().includes(q) ||
        ex.tag.toLowerCase().includes(q) ||
        ex.blurb.toLowerCase().includes(q) ||
        ex.claim.toLowerCase().includes(q) ||
        ex.evidence.toLowerCase().includes(q);
      return matchesTag && matchesSearch;
    });
  }, [examples, activeTag, search]);

  const countDisplay = loading
    ? "Loading scenarios…"
    : examples.length > 0
    ? `Browse ${examples.length} Scenarios`
    : "Browse scenarios";

  return (
    <MarketingShell>
      <div className="examples-page">
        <header className="examples-header">
          <div className="examples-header-inner">
            <span className="examples-kicker">Interactive Reference</span>
            <h1 className="examples-title">Examples Library</h1>
            <p className="examples-subtitle">
              {countDisplay}. Each test scenario illustrates a specific failure mode or valid substantiation pattern evaluated by Custodia’s deterministic engine.
            </p>
          </div>
        </header>

        <div className="examples-toolbar">
          <div className="examples-search-wrap">
            <input
              type="search"
              className="examples-search-input"
              placeholder="Search scenarios by metric, error, or phrasing…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search scenarios"
            />
          </div>

          <div className="category-pills examples-filter-pills" role="radiogroup" aria-label="Filter by category">
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                className={`category-pill chip ${activeTag === tag ? "active" : ""}`}
                role="radio"
                aria-checked={activeTag === tag}
                onClick={() => setActiveTag(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="banner warn" role="alert" style={{ marginBottom: 24 }}>
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="panel checking" style={{ minHeight: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <p>Loading scenario library…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="panel" style={{ textAlign: "center", padding: "48px 24px" }}>
            <p style={{ color: "var(--ink-muted)", fontSize: "1.05rem" }}>
              No scenarios match "{search}" in category "{activeTag}".
            </p>
            <button
              type="button"
              className="btn small"
              onClick={() => {
                setActiveTag("All");
                setSearch("");
              }}
              style={{ marginTop: 16 }}
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="examples-grid" role="list">
            {filtered.map((ex) => (
              <article key={ex.id} className="example-card panel" role="listitem">
                <div className="example-card-header">
                  <span className="example-tag-chip">{ex.tag}</span>
                  {verdictBadge(ex.expected)}
                </div>

                <h2 className="example-card-title">{ex.title}</h2>
                <p className="example-card-blurb">{ex.blurb}</p>

                <div className="example-card-samples">
                  <div className="example-sample-box claim">
                    <span className="example-sample-label">Draft Claim</span>
                    <p className="example-sample-text">“{ex.claim}”</p>
                  </div>
                  <div className="example-sample-box evidence">
                    <span className="example-sample-label">Supplied Evidence</span>
                    <p className="example-sample-text">“{ex.evidence}”</p>
                  </div>
                </div>

                <div className="example-card-footer">
                  <Link
                    href={`/check?example=${encodeURIComponent(ex.id)}`}
                    className="btn primary small"
                    prefetch={prefetchChecker}
                  >
                    Open in checker →
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </MarketingShell>
  );
}
