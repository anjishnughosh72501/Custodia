import { useCallback, useEffect, useRef, useState } from "react";
import { AppShell } from "../shells/AppShell";
import { navigate } from "../router";
import { ApiError, createReview, getExamples, getHealth, getReview, requestRewrite } from "../api";
import { animateResultEntrance } from "../motion/anime";
import { Findings, Risks } from "../Findings";
import { Inspector } from "../Inspector";
import { RewritePanel } from "../Rewrite";
import { VerdictCard } from "../Verdict";
import { Workspace } from "../Workspace";
import { RecentChecks } from "../checker/RecentChecks";
import { Legend } from "../checker/Legend";
import { CaseRail } from "../checker/CaseRail";
import { FindingsFilter, type FindingFilterType } from "../checker/FindingsFilter";
import { Toasts, type ToastMessage } from "../checker/Toasts";
import { useLocalList } from "../checker/useLocalList";
import { VERDICT_TITLE } from "../labels";
import type { Example, Health, Review, RewriteResult } from "../types";

const FALLBACK_LIMITS: Health["limits"] = { claim_chars: 1000, evidence_chars: 20000 };

interface CheckerProps {
  exampleId?: string;
  reviewId?: string;
}

export function VerdictSkeleton() {
  return (
    <div className="panel verdict-skeleton" role="status" aria-live="polite">
      <div className="verdict-skel-left">
        <div className="skel-line skel-title" />
        <div className="skel-line skel-sub" />
        <div className="skel-rows">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skel-row">
              <div className="skel-bullet" />
              <div className="skel-line skel-text" />
            </div>
          ))}
        </div>
        <p className="skel-note">Comparing the seven dimensions against your evidence…</p>
      </div>
      <div className="verdict-skel-rail" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="skel-circle" />
        ))}
        <div className="rail-cap">7 dimensions</div>
      </div>
    </div>
  );
}

export default function Checker({ exampleId, reviewId }: CheckerProps) {
  const [health, setHealth] = useState<Health | null>(null);
  const [examples, setExamples] = useState<Example[]>([]);
  const [activeExample, setActiveExample] = useState<string | null>(null);
  const [claim, setClaim] = useState("");
  const [evidence, setEvidence] = useState("");
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [review, setReview] = useState<Review | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [rw, setRw] = useState<RewriteResult | null>(null);
  const [verifiedText, setVerifiedText] = useState<string | null>(null);
  const [busy, setBusy] = useState<"suggest" | "verify" | null>(null);
  const [rwError, setRwError] = useState("");

  // QoL States
  const [findingFilter, setFindingFilter] = useState<FindingFilterType>("all");
  const [expandedFindings, setExpandedFindings] = useState<Set<string>>(new Set());
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [consideredRisks, setConsideredRisks] = useState<Record<string, boolean>>({});

  const { addItem } = useLocalList();

  const verdictRef = useRef<HTMLDivElement>(null);
  const inspectorRef = useRef<HTMLDivElement>(null);
  const initialExampleLoaded = useRef(false);

  const addToast = useCallback((text: string, tone: ToastMessage["tone"] = "ok") => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, text, tone }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Update document title with verdict, restore on leave
  useEffect(() => {
    const prevTitle = document.title;
    if (review) {
      const vTitle = VERDICT_TITLE[review.verdict.status] ?? review.verdict.status;
      document.title = `${vTitle} · Custodia`;
    } else {
      document.title = "Custodia — Deterministic claim verification";
    }
    return () => {
      document.title = prevTitle;
    };
  }, [review]);

  // Load considered risks from local storage when review changes
  useEffect(() => {
    if (!review) {
      setConsideredRisks({});
      return;
    }
    try {
      const saved = localStorage.getItem(`custodia_risks_${review.id}`);
      if (saved) {
        setConsideredRisks(JSON.parse(saved));
      }
    } catch {
      // ignore
    }
  }, [review?.id]);

  const toggleConsideredRisk = (riskId: string) => {
    if (!review) return;
    setConsideredRisks((prev) => {
      const next = { ...prev, [riskId]: !prev[riskId] };
      try {
        localStorage.setItem(`custodia_risks_${review.id}`, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  useEffect(() => {
    getHealth().then(setHealth).catch(() => {});
    getExamples().then(setExamples).catch(() => setExamples([]));
  }, []);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, []);

  // Stagger entrance animation via anime.js
  useEffect(() => {
    if (!review || loading) return;
    const verdictCard = verdictRef.current?.querySelector(".verdict") as HTMLElement | null;
    const findings = Array.from(document.querySelectorAll(".finding")) as HTMLElement[];
    return animateResultEntrance(verdictCard, findings);
  }, [review?.id, loading]);

  // Handle ?example=<id> once examples load
  useEffect(() => {
    if (!initialExampleLoaded.current && exampleId && examples.length > 0) {
      const match = examples.find((e) => e.id === exampleId);
      if (match) {
        setClaim(match.claim);
        setEvidence(match.evidence);
        setActiveExample(match.id);
        setTouched(false);
        initialExampleLoaded.current = true;
      }
    }
  }, [exampleId, examples]);

  // Handle /r/:id deep links
  useEffect(() => {
    if (!reviewId) return;
    let cancelled = false;
    setLoading(true);
    setError("");

    getReview(reviewId)
      .then((r) => {
        if (cancelled) return;
        setReview(r);
        setClaim(r.claim_text);
        setEvidence(r.evidence_text);
        setTouched(false);
        addItem({
          id: r.id,
          claimSnippet: r.claim_text.slice(0, 80),
          claimFull: r.claim_text,
          evidenceFull: r.evidence_text,
          verdictStatus: r.verdict.status,
        });
      })
      .catch((e) => {
        if (cancelled) return;
        setError(
          e instanceof ApiError && (e.code === "HTTP_404" || e.code === "NOT_FOUND")
            ? "That review could not be found. It may have expired or never existed."
            : e instanceof ApiError
            ? e.message
            : "Could not load the saved review."
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reviewId, addItem]);

  const limits = health?.limits ?? FALLBACK_LIMITS;
  const reduce = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const clearResults = () => {
    setReview(null);
    setSelected(null);
    setRw(null);
    setDraft("");
    setVerifiedText(null);
    setRwError("");
    setError("");
    setFindingFilter("all");
    setExpandedFindings(new Set());
  };

  const submit = useCallback(async () => {
    setTouched(true);
    if (!claim.trim() || !evidence.trim() || claim.length > limits.claim_chars || evidence.length > limits.evidence_chars) return;
    setLoading(true);
    clearResults();
    try {
      const r = await createReview(claim, evidence);
      setReview(r);
      addItem({
        id: r.id,
        claimSnippet: claim.slice(0, 80),
        claimFull: claim,
        evidenceFull: evidence,
        verdictStatus: r.verdict.status,
      });

      if (r.id) {
        navigate(`/r/${r.id}`, { scroll: false });
      }
      window.setTimeout(() => {
        verdictRef.current?.scrollIntoView({ behavior: reduce() ? "auto" : "smooth", block: "start" });
        const a = document.activeElement;
        if (!a || a === document.body || document.getElementById("workspace")?.contains(a)) {
          verdictRef.current?.focus({ preventScroll: true });
        }
      }, 60);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [claim, evidence, limits, addItem]);

  const reset = () => {
    setClaim("");
    setEvidence("");
    setTouched(false);
    setActiveExample(null);
    clearResults();
    navigate("/check");
  };

  const loadExample = (e: Example) => {
    setClaim(e.claim);
    setEvidence(e.evidence);
    setActiveExample(e.id);
    setTouched(false);
    clearResults();
  };

  const pick = (d: string) => {
    setSelected(d);
    inspectorRef.current?.scrollIntoView({ behavior: reduce() ? "auto" : "smooth", block: "center" });
  };

  const handleEditAndRerun = () => {
    document.getElementById("workspace")?.scrollIntoView({ behavior: reduce() ? "auto" : "smooth", block: "start" });
    const claimEl = document.getElementById("claim") as HTMLTextAreaElement | null;
    claimEl?.focus();
  };

  const suggest = async () => {
    if (!review) return;
    setBusy("suggest");
    setRwError("");
    try {
      const r = await requestRewrite(review.id);
      setRw(r);
      if (r.text) {
        setDraft(r.text);
        setVerifiedText(r.text);
      } else {
        setVerifiedText(null);
      }
    } catch (e) {
      setRwError(e instanceof ApiError ? e.message : "Could not build a rewrite. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const verify = async () => {
    if (!review || !draft.trim()) return;
    setBusy("verify");
    setRwError("");
    try {
      const r = await requestRewrite(review.id, draft);
      setRw(r);
      setVerifiedText(draft);
    } catch (e) {
      setRwError(e instanceof ApiError ? e.message : "Could not verify your edit. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const example = examples.find((e) => e.id === activeExample);

  const findingCounts = {
    all: review ? review.comparisons.length : 7,
    contradicted: review ? review.comparisons.filter((c) => c.status === "contradicted").length : 0,
    unknown: review ? review.comparisons.filter((c) => c.status === "unknown").length : 0,
    supported: review ? review.comparisons.filter((c) => c.status === "supported").length : 0,
  };

  const handleExpandAllFindings = () => {
    if (!review) return;
    setExpandedFindings(new Set(review.comparisons.map((c) => c.dimension)));
  };

  const handleCollapseAllFindings = () => {
    setExpandedFindings(new Set());
    setSelected(null);
  };

  const consideredCount = Object.values(consideredRisks).filter(Boolean).length;

  return (
    <AppShell onNewCheck={reset}>
      <Toasts toasts={toasts} onDismiss={removeToast} />

      <div className="shell checker-shell">
        <div className="checker-layout-grid">
          {/* Main Column */}
          <div className="checker-main-col">
            <section className="lede">
              <h1>Does the wording stay inside the evidence?</h1>
              <p>
                Paste a marketing claim and the evidence behind it. Custodia compares seven dimensions, shows the exact words each
                finding rests on, and sends anything unclear to a person. It checks your supplied evidence only; it cannot tell you a
                claim is true.
              </p>
            </section>

            <div id="workspace">
              <Workspace
                claim={claim}
                evidence={evidence}
                setClaim={setClaim}
                setEvidence={setEvidence}
                limits={limits}
                examples={examples}
                activeExample={activeExample}
                onExample={loadExample}
                onSubmit={submit}
                onReset={reset}
                loading={loading}
                touched={touched}
                onToast={addToast}
              />
            </div>

            {error && (
              <div className="banner bad" role="alert" style={{ marginTop: 24 }}>
                <div>
                  <b>Could not check claim.</b> {error}
                </div>
              </div>
            )}

            {loading && <VerdictSkeleton />}

            {review && !loading && (
              <div key={review.id} className="checker-results-group">
                <div ref={verdictRef} tabIndex={-1} style={{ outline: "none", scrollMarginTop: "80px" }}>
                  {review.warnings.filter((w) => !w.startsWith("Running with the rule-based extractor")).length > 0 && (
                    <div className="banner warn" role="note" style={{ marginTop: 28 }}>
                      <div>
                        {review.warnings
                          .filter((w) => !w.startsWith("Running with the rule-based extractor"))
                          .map((w, i) => (
                            <p key={i}>{w}</p>
                          ))}
                      </div>
                    </div>
                  )}
                  <VerdictCard review={review} onPickDimension={pick} />
                </div>

                <section className="section" ref={inspectorRef} aria-labelledby="insp-h">
                  <div className="section-head">
                    <h2 id="insp-h">Evidence inspector</h2>
                    <p>Draft and evidence side by side, highlighted from verified character positions in your own text.</p>
                  </div>
                  <Inspector
                    claim={review.claim_text}
                    evidence={review.evidence_text}
                    comparisons={review.comparisons}
                    risks={review.language_risks}
                    selected={selected}
                    onSelect={setSelected}
                  />
                </section>

                <section className="section" aria-labelledby="findings-h">
                  <div className="section-head">
                    <h2 id="findings-h">Seven dimensions</h2>
                    <p>
                      Select a finding to focus its words in the inspector. Anything marked “needs review” is never treated as supported.
                    </p>
                  </div>

                  <FindingsFilter
                    activeFilter={findingFilter}
                    onFilterChange={setFindingFilter}
                    counts={findingCounts}
                    onExpandAll={handleExpandAllFindings}
                    onCollapseAll={handleCollapseAllFindings}
                    showDetails={showTechnicalDetails}
                    onToggleDetails={() => setShowTechnicalDetails(!showTechnicalDetails)}
                  />

                  <Findings
                    comparisons={review.comparisons}
                    selected={selected}
                    onSelect={setSelected}
                    filter={findingFilter}
                    expandedIds={expandedFindings}
                    showDetails={showTechnicalDetails}
                  />
                </section>

                <section className="section" aria-labelledby="risks-h">
                  <div className="section-head">
                    <h2 id="risks-h">Language risks</h2>
                    <p>
                      Specific words and structures that introduce legal or regulatory risk regardless of evidence.
                    </p>
                  </div>
                  <Risks
                    risks={review.language_risks}
                    selected={selected}
                    onSelect={setSelected}
                    consideredRisks={consideredRisks}
                    onToggleConsidered={toggleConsideredRisk}
                  />
                </section>

                <div className="section" aria-labelledby="rewrite-h">
                  <div className="section-head">
                    <h2 id="rewrite-h">Suggested wording</h2>
                    <p>A supported phrasing aligned with the evidence, tested against the same deterministic rules.</p>
                  </div>
                  <RewritePanel
                    review={review}
                    draft={draft}
                    setDraft={setDraft}
                    result={rw}
                    verifiedText={verifiedText}
                    busy={busy}
                    error={rwError}
                    exampleCandidate={example?.candidate}
                    onSuggest={suggest}
                    onVerify={verify}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Right Rail Column */}
          <div className="checker-right-rail">
            {!review ? (
              <div className="rail-sticky-wrapper">
                <RecentChecks onLoadText={(c, e) => { setClaim(c); setEvidence(e); }} />
                <Legend />
              </div>
            ) : (
              <div className="rail-sticky-wrapper">
                <CaseRail
                  review={review}
                  selected={selected}
                  onSelect={setSelected}
                  consideredCount={consideredCount}
                  totalRisks={review.language_risks.length}
                  onToast={addToast}
                  onEditAndRerun={handleEditAndRerun}
                  consideredRisks={consideredRisks}
                />
              </div>
            )}
          </div>
        </div>

        <footer>
          Custodia is a rule-based checker with optional model assistance. It does not browse, fetch sources or judge whether the
          evidence itself is reliable, and it supports English text only. Example scenarios are illustrative and are not a
          benchmark. No accuracy figure is claimed.
        </footer>
      </div>
    </AppShell>
  );
}
