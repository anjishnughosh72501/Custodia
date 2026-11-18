import { useState } from "react";
import { runPhase17Demo } from "../api";
import type { Phase17DemoResult } from "../types";
import { CheckCircle2, ArrowRight, Play, RefreshCw, X, Sparkles, BookOpen, AlertCircle } from "lucide-react";

interface Phase17DemoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Phase17DemoModal({ isOpen, onClose }: Phase17DemoModalProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Phase17DemoResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRunDemo = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await runPhase17Demo();
      setResult(res);
    } catch (err: any) {
      setError(err?.message || "Failed to execute Phase 17 acceptance scenario.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="phase17-title">
      <div className="modal-content governance-demo-modal" style={{ maxWidth: 860, width: "95%", maxHeight: "90vh", overflowY: "auto" }}>
        <header className="modal-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ background: "rgba(0, 240, 255, 0.1)", padding: 8, borderRadius: 8, color: "#00F0FF" }}>
              <Sparkles size={20} />
            </div>
            <div>
              <h2 id="phase17-title" style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>
                Inkloom AI Hackathon: Phase 17 Acceptance Showcase
              </h2>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--muted)" }}>
                End-to-End Brand Governance, Preflight Enforcement, & Audit Trail Verification
              </p>
            </div>
          </div>
          <button type="button" className="btn small icon-only" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </header>

        <div className="modal-body" style={{ padding: "20px 0" }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, marginBottom: 20 }}>
            <h4 style={{ margin: "0 0 8px 0", fontSize: "0.95rem", color: "var(--text)" }}>The Phase 17 Challenge Prompt</h4>
            <div style={{ background: "rgba(20, 33, 61, 0.8)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: 6, padding: "12px 16px", fontFamily: "monospace", fontSize: "0.9rem", color: "#FBF8F1" }}>
              "Our AI platform guarantees 95% higher productivity for every business. Subscribe today for ₹799."
            </div>
            <p style={{ margin: "8px 0 0 0", fontSize: "0.82rem", color: "var(--muted)" }}>
              Target DNA: Entry price must be ₹999, guarantees are prohibited, productivity capped at 35% trial benchmark, avoid universal population claims.
            </p>
          </div>

          {!result && !loading && (
            <div style={{ textAlign: "center", padding: "30px 20px" }}>
              <button
                type="button"
                className="btn primary"
                onClick={handleRunDemo}
                style={{ fontSize: "1rem", padding: "12px 24px", display: "inline-flex", alignItems: "center", gap: 8 }}
              >
                <Play size={18} /> Run Live Phase 17 Verification
              </button>
              <p style={{ marginTop: 12, fontSize: "0.82rem", color: "var(--muted)" }}>
                Executes preflight engine, rule validation, fact-checkers, auto-correction, and reviewer sign-off live.
              </p>
            </div>
          )}

          {loading && (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <RefreshCw size={28} className="spin" style={{ color: "#00F0FF", marginBottom: 12 }} />
              <p style={{ margin: 0, fontWeight: 600 }}>Executing Multi-Model Brand Preflight Engine…</p>
              <p style={{ margin: "6px 0 0 0", fontSize: "0.85rem", color: "var(--muted)" }}>
                Validating pricing claims, empirical efficacy benchmarks, legal language, and generating correction.
              </p>
            </div>
          )}

          {error && (
            <div style={{ background: "rgba(230, 57, 70, 0.15)", border: "1px solid #E63946", borderRadius: 8, padding: 14, color: "#E63946", marginBottom: 16 }}>
              <AlertCircle size={18} style={{ display: "inline", verticalAlign: "middle", marginRight: 8 }} />
              {error}
            </div>
          )}

          {result && (
            <div className="demo-results-view" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Status Header */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase" }}>Initial Score</div>
                  <div style={{ fontSize: "1.4rem", fontWeight: 800, color: result.initial_score <= 30 ? "#E63946" : "#2A9D8F" }}>
                    {result.initial_score}/100
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#E63946", fontWeight: 600 }}>Strict Invariant Cap Applied</div>
                </div>

                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase" }}>Risk Classification</div>
                  <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#E63946" }}>
                    {result.initial_risk_tier}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Preflight Hard Block</div>
                </div>

                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase" }}>Issues Detected</div>
                  <div style={{ fontSize: "1.4rem", fontWeight: 800, color: result.all_4_issues_detected ? "#00F0FF" : "inherit" }}>
                    {result.findings_count} Findings
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#2A9D8F", fontWeight: 600 }}>
                    {result.all_4_issues_detected ? "✓ All 4 Issues Caught" : "Partial Detection"}
                  </div>
                </div>

                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase" }}>Workflow Decision</div>
                  <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#2A9D8F" }}>
                    {result.final_status}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Human Sign-Off Verified</div>
                </div>
              </div>

              {/* Explainable Findings */}
              <div>
                <h4 style={{ margin: "0 0 10px 0", fontSize: "0.95rem" }}>
                  Explainable Findings & Provenance Citations ({result.findings.length})
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {result.findings.map((f, idx) => (
                    <div
                      key={f.id || idx}
                      style={{
                        background: "var(--surface)",
                        borderLeft: `4px solid ${f.enforcement === "STRICT" ? "#E63946" : "#E9C46A"}`,
                        border: "1px solid var(--border)",
                        borderLeftWidth: 4,
                        borderRadius: 6,
                        padding: 12,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>{f.title}</span>
                        <span
                          style={{
                            fontSize: "0.75rem",
                            padding: "2px 8px",
                            borderRadius: 4,
                            background: f.enforcement === "STRICT" ? "rgba(230, 57, 70, 0.2)" : "rgba(233, 196, 106, 0.2)",
                            color: f.enforcement === "STRICT" ? "#E63946" : "#E9C46A",
                            fontWeight: 700,
                          }}
                        >
                          {f.enforcement}
                        </span>
                      </div>
                      <p style={{ margin: "0 0 6px 0", fontSize: "0.85rem", color: "var(--text)" }}>
                        {f.explanation}
                      </p>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: "0.8rem", color: "var(--muted)" }}>
                        <div>
                          <strong>Violating Span:</strong> <code style={{ color: "#E63946", background: "rgba(230, 57, 70, 0.1)", padding: "1px 5px", borderRadius: 3 }}>{f.highlighted_text}</code>
                        </div>
                        <div>
                          <strong>Suggested Fix:</strong> <code style={{ color: "#2A9D8F", background: "rgba(42, 157, 143, 0.1)", padding: "1px 5px", borderRadius: 3 }}>{f.suggested_fix}</code>
                        </div>
                        {f.source_reference && (
                          <div>
                            <BookOpen size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
                            <strong>Citation:</strong> {f.source_reference}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Before and After Correction */}
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 16 }}>
                <h4 style={{ margin: "0 0 12px 0", fontSize: "0.95rem" }}>Auto-Corrected Content Transformation</h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 14, alignItems: "center" }}>
                  <div style={{ background: "rgba(230, 57, 70, 0.08)", border: "1px solid rgba(230, 57, 70, 0.3)", borderRadius: 6, padding: 12 }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#E63946", marginBottom: 6, textTransform: "uppercase" }}>Original Copy</div>
                    <div style={{ fontSize: "0.88rem", lineHeight: 1.5 }}>{result.original_copy}</div>
                  </div>

                  <div style={{ color: "var(--muted)" }}>
                    <ArrowRight size={20} />
                  </div>

                  <div style={{ background: "rgba(42, 157, 143, 0.1)", border: "1px solid rgba(42, 157, 143, 0.3)", borderRadius: 6, padding: 12 }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#2A9D8F", marginBottom: 6, textTransform: "uppercase" }}>Approved Copy</div>
                    <div style={{ fontSize: "0.88rem", lineHeight: 1.5, color: "#FBF8F1" }}>{result.corrected_copy_applied}</div>
                  </div>
                </div>
              </div>

              {/* Reviewer Sign-off & Audit Log */}
              <div style={{ background: "rgba(20, 33, 61, 0.6)", border: "1px solid rgba(0, 240, 255, 0.2)", borderRadius: 8, padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#2A9D8F", fontWeight: 700, fontSize: "0.9rem" }}>
                    <CheckCircle2 size={16} /> Signed Off by Lead Compliance Reviewer
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: 4 }}>
                    Audit Event Hash: <code style={{ color: "#00F0FF" }}>{result.audit_event_id}</code> | Recorded to SQLite Immutable Log
                  </div>
                </div>
                <button type="button" className="btn small" onClick={handleRunDemo} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <RefreshCw size={14} /> Re-run Demo
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
