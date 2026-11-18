import { useEffect, useState } from "react";
import {
  getBrandProfiles,
  getBrandRules,
  toggleBrandRule,
  getApprovedFacts,
  getBrandAssets,
  getWorkflowQueue,
  recordWorkflowDecision,
  getGovernanceAnalytics,
  runBrandPreflight,
  applyPreflightCorrection,
} from "../api";
import type {
  BrandProfile,
  BrandRule,
  ApprovedFact,
  BrandAsset,
  PreflightReview,
  GovernanceAnalytics,
} from "../types";
import {
  ShieldCheck,
  BookOpen,
  Send,
  BarChart3,
  X,
  RefreshCw,
  FileCheck,
  Check,
} from "lucide-react";

interface BrandGovernanceWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BrandGovernanceWorkspaceModal({
  isOpen,
  onClose,
}: BrandGovernanceWorkspaceModalProps) {
  const [activeTab, setActiveTab] = useState<"dna" | "studio" | "queue" | "analytics">("dna");
  const [selectedProfile, setSelectedProfile] = useState<BrandProfile | null>(null);
  const [rules, setRules] = useState<BrandRule[]>([]);
  const [facts, setFacts] = useState<ApprovedFact[]>([]);
  const [assets, setAssets] = useState<BrandAsset[]>([]);
  const [queue, setQueue] = useState<PreflightReview[]>([]);
  const [analytics, setAnalytics] = useState<GovernanceAnalytics | null>(null);
  const [loading, setLoading] = useState(false);

  // Content Studio state
  const [draftContent, setDraftContent] = useState("");
  const [draftCategory, setDraftCategory] = useState("ADVERTISEMENT");
  const [analyzing, setAnalyzing] = useState(false);
  const [activeReview, setActiveReview] = useState<PreflightReview | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    loadInitialData();
  }, [isOpen]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const pList = await getBrandProfiles();
      if (pList.length > 0) {
        setSelectedProfile(pList[0]);
        loadProfileDetails(pList[0].id);
      }
      loadQueueAndAnalytics();
    } catch (err) {
      console.error("Failed to load brand governance data:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadProfileDetails = async (profileId: string) => {
    try {
      const [rList, fList, aList] = await Promise.all([
        getBrandRules(profileId),
        getApprovedFacts(profileId),
        getBrandAssets(profileId),
      ]);
      setRules(rList);
      setFacts(fList);
      setAssets(aList);
    } catch (err) {
      console.error("Failed to load profile details:", err);
    }
  };

  const loadQueueAndAnalytics = async () => {
    try {
      const [qData, aData] = await Promise.all([getWorkflowQueue(), getGovernanceAnalytics()]);
      setQueue(qData.queue);
      setAnalytics(aData);
    } catch (err) {
      console.error("Failed to load queue/analytics:", err);
    }
  };

  const handleToggleRule = async (ruleId: string) => {
    try {
      const updated = await toggleBrandRule(ruleId);
      setRules((prev) => prev.map((r) => (r.id === ruleId ? updated : r)));
    } catch (err) {
      console.error("Failed to toggle rule:", err);
    }
  };

  const handleRunPreflight = async () => {
    if (!draftContent.trim() || !selectedProfile) return;
    setAnalyzing(true);
    try {
      const res = await runBrandPreflight({
        brand_profile_id: selectedProfile.id,
        content: draftContent,
        category: draftCategory,
      });
      setActiveReview(res);
      loadQueueAndAnalytics();
    } catch (err) {
      console.error("Preflight analysis failed:", err);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleApplyFix = async (findingId?: string) => {
    if (!activeReview) return;
    try {
      const updated = await applyPreflightCorrection(activeReview.id, findingId);
      setActiveReview(updated);
      setDraftContent(updated.content_raw);
      loadQueueAndAnalytics();
    } catch (err) {
      console.error("Failed to apply correction:", err);
    }
  };

  const handleDecision = async (
    reviewId: string,
    decision: "APPROVED" | "APPROVED_WITH_CONDITIONS" | "REJECTED"
  ) => {
    try {
      const updated = await recordWorkflowDecision(reviewId, decision, "Reviewer sign-off");
      setQueue((prev) => prev.map((r) => (r.id === reviewId ? updated : r)));
      if (activeReview?.id === reviewId) {
        setActiveReview(updated);
      }
      loadQueueAndAnalytics();
    } catch (err) {
      console.error("Decision failed:", err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="gov-workspace-title">
      <div
        className="modal-content governance-workspace-modal"
        style={{ maxWidth: 1040, width: "95%", height: "88vh", display: "flex", flexDirection: "column" }}
      >
        <header
          className="modal-header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ background: "rgba(0, 240, 255, 0.1)", padding: 8, borderRadius: 8, color: "#00F0FF" }}>
              <ShieldCheck size={22} />
            </div>
            <div>
              <h2 id="gov-workspace-title" style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700 }}>
                Intelligent Brand Governance Workspace
              </h2>
              <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--muted)" }}>
                {loading ? "Loading guidelines…" : selectedProfile ? selectedProfile.name : "Custodia Enterprise Brand Guardrails"}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Nav Tabs */}
            <nav style={{ display: "flex", background: "var(--surface)", padding: 4, borderRadius: 8, gap: 4 }}>
              <button
                type="button"
                className={`btn small ${activeTab === "dna" ? "primary" : "ghost"}`}
                onClick={() => setActiveTab("dna")}
                style={{ fontSize: "0.8rem", display: "flex", alignItems: "center", gap: 6 }}
              >
                <BookOpen size={14} /> Brand DNA
              </button>
              <button
                type="button"
                className={`btn small ${activeTab === "studio" ? "primary" : "ghost"}`}
                onClick={() => setActiveTab("studio")}
                style={{ fontSize: "0.8rem", display: "flex", alignItems: "center", gap: 6 }}
              >
                <Send size={14} /> Content Studio
              </button>
              <button
                type="button"
                className={`btn small ${activeTab === "queue" ? "primary" : "ghost"}`}
                onClick={() => setActiveTab("queue")}
                style={{ fontSize: "0.8rem", display: "flex", alignItems: "center", gap: 6 }}
              >
                <FileCheck size={14} /> Review Queue ({queue.filter((q) => q.workflow_status === "PENDING_REVIEW").length})
              </button>
              <button
                type="button"
                className={`btn small ${activeTab === "analytics" ? "primary" : "ghost"}`}
                onClick={() => setActiveTab("analytics")}
                style={{ fontSize: "0.8rem", display: "flex", alignItems: "center", gap: 6 }}
              >
                <BarChart3 size={14} /> Drift Analytics
              </button>
            </nav>

            <button type="button" className="btn small icon-only" onClick={onClose} aria-label="Close modal">
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="modal-body" style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          {/* TAB 1: BRAND DNA */}
          {activeTab === "dna" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {selectedProfile && (
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <h3 style={{ margin: 0, fontSize: "1.05rem" }}>{selectedProfile.name}</h3>
                    <span style={{ fontSize: "0.75rem", background: "rgba(42, 157, 143, 0.2)", color: "#2A9D8F", padding: "2px 8px", borderRadius: 4, fontWeight: 700 }}>
                      ACTIVE PROFILE
                    </span>
                  </div>
                  <p style={{ margin: "0 0 12px 0", fontSize: "0.88rem", color: "var(--muted)" }}>
                    {selectedProfile.description || "Enterprise guidelines governing tone, pricing claims, and messaging integrity."}
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {selectedProfile.primary_colors.map((c) => (
                      <span key={c} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "0.78rem", background: "rgba(0,0,0,0.3)", padding: "3px 8px", borderRadius: 4, border: "1px solid var(--border)" }}>
                        <span style={{ width: 12, height: 12, borderRadius: 2, background: c, display: "inline-block" }} />
                        <code>{c}</code>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Active Rules List */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <h4 style={{ margin: 0, fontSize: "0.95rem" }}>Enforced Brand Rules ({rules.length})</h4>
                  <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Click switch to toggle enforcement</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {rules.map((r) => (
                    <div
                      key={r.id}
                      style={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        padding: "12px 16px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{r.title}</span>
                          <span style={{ fontSize: "0.7rem", padding: "1px 6px", borderRadius: 3, background: r.enforcement === "STRICT" ? "rgba(230, 57, 70, 0.2)" : "rgba(233, 196, 106, 0.2)", color: r.enforcement === "STRICT" ? "#E63946" : "#E9C46A", fontWeight: 700 }}>
                            {r.enforcement}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--muted)" }}>{r.rule_text}</p>
                        {r.source_document && (
                          <span style={{ fontSize: "0.75rem", color: "#00F0FF", marginTop: 4, display: "inline-block" }}>
                            Source: {r.source_document} ({r.source_location})
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        className={`btn small ${r.status === "ACTIVE" ? "primary" : "ghost"}`}
                        onClick={() => handleToggleRule(r.id)}
                        style={{ fontSize: "0.75rem" }}
                      >
                        {r.status === "ACTIVE" ? "ACTIVE" : "INACTIVE"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Approved Facts */}
              <div>
                <h4 style={{ margin: "0 0 10px 0", fontSize: "0.95rem" }}>Approved Enterprise Facts ({facts.length})</h4>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10 }}>
                  {facts.map((f) => (
                    <div key={f.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, padding: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase" }}>{f.category}</span>
                        <code style={{ color: "#2A9D8F", fontWeight: 700 }}>{f.canonical_value}</code>
                      </div>
                      <div style={{ fontWeight: 600, fontSize: "0.88rem", marginBottom: 4 }}>{f.entity_name}</div>
                      <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--muted)" }}>{f.statement}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Brand Assets */}
              {assets.length > 0 && (
                <div>
                  <h4 style={{ margin: "0 0 10px 0", fontSize: "0.95rem" }}>Registered Brand Assets ({assets.length})</h4>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10 }}>
                    {assets.map((a) => (
                      <div key={a.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, padding: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase" }}>{a.asset_type}</span>
                          <span style={{ fontSize: "0.75rem", color: "#00F0FF" }}>{a.name}</span>
                        </div>
                        {a.usage_guidelines && <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--muted)" }}>{a.usage_guidelines}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CONTENT STUDIO */}
          {activeTab === "studio" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <h4 style={{ margin: 0, fontSize: "0.95rem" }}>Marketing Draft Submission</h4>
                  <div style={{ display: "flex", gap: 8 }}>
                    <select
                      value={draftCategory}
                      onChange={(e) => setDraftCategory(e.target.value)}
                      style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)", padding: "4px 8px", borderRadius: 4, fontSize: "0.85rem" }}
                    >
                      <option value="ADVERTISEMENT">Advertisement</option>
                      <option value="SOCIAL_MEDIA">Social Media</option>
                      <option value="LANDING_PAGE">Landing Page</option>
                      <option value="PRODUCT_COPY">Product Copy</option>
                    </select>
                    <button
                      type="button"
                      className="btn primary small"
                      onClick={handleRunPreflight}
                      disabled={analyzing || !draftContent.trim()}
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      {analyzing ? <RefreshCw size={14} className="spin" /> : <Send size={14} />}
                      Run Preflight
                    </button>
                  </div>
                </div>

                <textarea
                  value={draftContent}
                  onChange={(e) => setDraftContent(e.target.value)}
                  placeholder="Paste ad copy, social post, or marketing statement here to test against brand rules and facts..."
                  style={{ width: "100%", height: 110, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, padding: 12, color: "var(--text)", fontSize: "0.9rem", resize: "vertical" }}
                />

                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={() => setDraftContent("Our AI platform guarantees 95% higher productivity for every business. Subscribe today for ₹799.")}
                    style={{ fontSize: "0.75rem" }}
                  >
                    Load Phase 17 Benchmark Ad Copy
                  </button>
                </div>
              </div>

              {/* Preflight Review Output */}
              {activeReview && (
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ fontSize: "1.3rem", fontWeight: 800, color: activeReview.overall_score <= 30 ? "#E63946" : "#2A9D8F" }}>
                        Score: {activeReview.overall_score}/100
                      </div>
                      <span style={{ fontSize: "0.75rem", padding: "2px 8px", borderRadius: 4, background: activeReview.risk_tier === "CRITICAL" ? "rgba(230, 57, 70, 0.2)" : "rgba(42, 157, 143, 0.2)", color: activeReview.risk_tier === "CRITICAL" ? "#E63946" : "#2A9D8F", fontWeight: 700 }}>
                        {activeReview.risk_tier} RISK
                      </span>
                      <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                        Status: <strong>{activeReview.workflow_status}</strong>
                      </span>
                    </div>

                    {activeReview.suggested_rewrite && (
                      <button
                        type="button"
                        className="btn small primary"
                        onClick={() => handleApplyFix()}
                        style={{ display: "flex", alignItems: "center", gap: 6 }}
                      >
                        <Check size={14} /> Apply All Corrections
                      </button>
                    )}
                  </div>

                  {/* Findings */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {activeReview.findings.map((f) => (
                      <div
                        key={f.id}
                        style={{
                          background: "var(--bg)",
                          borderLeft: `4px solid ${f.enforcement === "STRICT" ? "#E63946" : "#E9C46A"}`,
                          borderRadius: 4,
                          padding: 10,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>{f.title}</span>
                          {f.suggested_fix && f.status !== "ACCEPTED" && (
                            <button
                              type="button"
                              className="btn ghost small"
                              onClick={() => handleApplyFix(f.id)}
                              style={{ fontSize: "0.75rem", padding: "2px 8px" }}
                            >
                              Apply Fix: <code>{f.suggested_fix}</code>
                            </button>
                          )}
                        </div>
                        <p style={{ margin: "4px 0", fontSize: "0.8rem", color: "var(--muted)" }}>{f.explanation}</p>
                        {f.source_reference && (
                          <span style={{ fontSize: "0.72rem", color: "#00F0FF" }}>Citation: {f.source_reference}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: REVIEW QUEUE */}
          {activeTab === "queue" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h4 style={{ margin: 0, fontSize: "0.95rem" }}>Pending Governance Approvals ({queue.length})</h4>
                <button type="button" className="btn ghost small" onClick={loadQueueAndAnalytics} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <RefreshCw size={12} /> Refresh
                </button>
              </div>

              {queue.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, color: "var(--muted)" }}>
                  No pending submissions in review queue.
                </div>
              ) : (
                queue.map((rev) => (
                  <div key={rev.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div>
                        <span style={{ fontWeight: 700, fontSize: "0.9rem" }}>{rev.title || "Preflight Submission"}</span>
                        <span style={{ marginLeft: 8, fontSize: "0.75rem", color: "var(--muted)" }}>
                          Score: {rev.overall_score} | {rev.risk_tier}
                        </span>
                      </div>
                      <span style={{ fontSize: "0.75rem", padding: "2px 8px", borderRadius: 4, background: rev.workflow_status === "APPROVED" ? "rgba(42, 157, 143, 0.2)" : "rgba(230, 57, 70, 0.2)", color: rev.workflow_status === "APPROVED" ? "#2A9D8F" : "#E63946", fontWeight: 700 }}>
                        {rev.workflow_status}
                      </span>
                    </div>

                    <p style={{ margin: "0 0 10px 0", fontSize: "0.85rem", background: "rgba(0,0,0,0.2)", padding: 8, borderRadius: 4 }}>
                      {rev.content_raw}
                    </p>

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                      <button
                        type="button"
                        className="btn small"
                        onClick={() => handleDecision(rev.id, "REJECTED")}
                        style={{ fontSize: "0.75rem", color: "#E63946" }}
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        className="btn small"
                        onClick={() => handleDecision(rev.id, "APPROVED_WITH_CONDITIONS")}
                        style={{ fontSize: "0.75rem" }}
                      >
                        Approve with Conditions
                      </button>
                      <button
                        type="button"
                        className="btn small primary"
                        onClick={() => handleDecision(rev.id, "APPROVED")}
                        style={{ fontSize: "0.75rem" }}
                      >
                        Approve
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 4: GOVERNANCE DRIFT ANALYTICS */}
          {activeTab === "analytics" && analytics && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase" }}>Overall Compliance Score</div>
                  <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#2A9D8F", marginTop: 4 }}>
                    {analytics.overall_compliance_score}/100
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Real-time aggregated score</div>
                </div>

                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase" }}>Approval Rate</div>
                  <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#00F0FF", marginTop: 4 }}>
                    {analytics.approval_rate_pct}%
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{analytics.approved_count} approved out of {analytics.total_reviews}</div>
                </div>

                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase" }}>Total Preflights</div>
                  <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--text)", marginTop: 4 }}>
                    {analytics.total_reviews}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Evaluated across all channels</div>
                </div>
              </div>

              {/* Violations by Category */}
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 16 }}>
                <h4 style={{ margin: "0 0 12px 0", fontSize: "0.95rem" }}>Violations by Governance Dimension</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {Object.entries(analytics.category_breakdown || {}).map(([cat, count]) => (
                    <div key={cat} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ width: 110, fontSize: "0.8rem", color: "var(--muted)" }}>{cat}</span>
                      <div style={{ flex: 1, background: "rgba(255,255,255,0.06)", height: 16, borderRadius: 3, overflow: "hidden" }}>
                        <div
                          style={{
                            width: `${Math.min(100, (count / Math.max(1, analytics.total_reviews * 2)) * 100)}%`,
                            height: "100%",
                            background: cat === "FACTS" ? "#E63946" : cat === "LEGAL" ? "#E76F51" : "#2A9D8F",
                          }}
                        />
                      </div>
                      <span style={{ width: 30, fontSize: "0.8rem", textAlign: "right", fontWeight: 600 }}>{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Violated Rules */}
              {analytics.top_violated_rules.length > 0 && (
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 16 }}>
                  <h4 style={{ margin: "0 0 10px 0", fontSize: "0.95rem" }}>Top Violated Brand Guidelines</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {analytics.top_violated_rules.map((rule) => (
                      <div key={rule.rule_id} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <span>{rule.rule_title}</span>
                        <span style={{ color: "#E63946", fontWeight: 700 }}>{rule.count} breaches</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
