import { useEffect, useState } from "react";
import { Link, navigate } from "../router";
import { AppShell } from "../shells/AppShell";
import { useAuth } from "../auth/AuthContext";
import { getMyReviews } from "../api";
import type { Review } from "../types";
import { VERDICT_TITLE } from "../labels";

export default function MyChecks() {
  const { user, loading: authLoading } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login?redirect=/my-checks");
      return;
    }
    if (user) {
      getMyReviews()
        .then((data) => {
          setReviews(data);
          setLoading(false);
        })
        .catch(() => {
          setLoading(false);
        });
    }
  }, [user, authLoading]);

  return (
    <AppShell>
      <div className="shell" style={{ maxWidth: "860px", margin: "32px auto 80px", padding: "0 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <div>
            <h1 style={{ fontFamily: "var(--font-serif, Fraunces, Georgia, serif)", fontSize: "1.8rem", margin: "0 0 6px 0" }}>
              My Checks
            </h1>
            <p style={{ color: "var(--ink-muted, #555)", margin: 0, fontSize: "0.95rem" }}>
              Claims and verification reports saved to your account.
            </p>
          </div>
          <Link href="/check" className="btn primary small">
            Check a claim
          </Link>
        </div>

        {loading ? (
          <div className="panel checking" style={{ padding: "40px", textAlign: "center" }}>
            <p>Loading your saved checks…</p>
          </div>
        ) : reviews.length === 0 ? (
          <div className="panel" style={{ padding: "48px 24px", textAlign: "center" }}>
            <p style={{ color: "var(--ink-muted, #666)", fontSize: "1.05rem", marginBottom: "16px" }}>
              You don't have any saved claim checks yet.
            </p>
            <Link href="/check" className="btn primary small">
              Run your first check
            </Link>
          </div>
        ) : (
          <div style={{ display: "grid", gap: "16px" }}>
            {reviews.map((r) => {
              const status = r.verdict.status;
              const title = VERDICT_TITLE[status] || status;
              return (
                <div key={r.id} className="panel" style={{ padding: "20px 24px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                    <span
                      className={`status-badge ${status === "SUPPORTED_BY_SUPPLIED_EVIDENCE" ? "supported" : status === "NOT_SUPPORTED" ? "contradicted" : "unknown"}`}
                    >
                      {title}
                    </span>
                    <Link href={`/r/${r.id}`} className="btn small subtle">
                      View report →
                    </Link>
                  </div>
                  <div style={{ marginBottom: "8px" }}>
                    <span style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", color: "var(--ink-muted, #777)", letterSpacing: "0.05em" }}>
                      Draft Claim
                    </span>
                    <p style={{ margin: "2px 0 0 0", fontWeight: 600, color: "var(--ink, #14213D)" }}>
                      “{r.claim_text}”
                    </p>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", color: "var(--ink-muted, #777)", letterSpacing: "0.05em" }}>
                      Summary
                    </span>
                    <p style={{ margin: "2px 0 0 0", fontSize: "0.9rem", color: "var(--ink-muted, #555)" }}>
                      {r.verdict.summary}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
