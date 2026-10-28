import { useEffect, useRef } from "react";
import { Reveal } from "../motion/Reveal";
import { animateCounter } from "../motion/anime";
import benchmarkData from "./benchmark.json";

interface SetBreakdown {
  total: number;
  false_approvals: number;
  false_rejections: number;
  approved?: number;
  withheld?: number;
}

interface BenchmarkPayload {
  false_approvals: number | null;
  false_rejections?: number | null;
  total_cases?: number | null;
  date?: string | null;
  engine_version?: string | null;
  baseline?: SetBreakdown;
  adversarial?: SetBreakdown;
}

function BenchmarkCounter({ to }: { to: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    return animateCounter(ref.current, to);
  }, [to]);
  return <span ref={ref}>{to}</span>;
}

export function BenchmarkBand() {
  const data = benchmarkData as BenchmarkPayload;

  if (!data || data.false_approvals === null || data.false_approvals === undefined) {
    return null;
  }

  const falseApprovals = data.false_approvals;
  const totalCases = data.total_cases ?? 65;
  const date = data.date ?? "Oct 28, 2026";
  const engineVersion = data.engine_version ?? "rules-1.1";
  const baseline = data.baseline ?? { total: 45, false_approvals: 0, false_rejections: 0 };
  const adversarial = data.adversarial ?? { total: 20, false_approvals: 0, false_rejections: 0 };

  return (
    <section className="section benchmark-section" aria-label="Benchmark verification results">
      <Reveal>
        <div className="panel benchmark-card">
          <div className="benchmark-number-row">
            <span className="benchmark-stat">
              <BenchmarkCounter to={falseApprovals} />
            </span>
            <span className="benchmark-text">
              false approvals in <BenchmarkCounter to={totalCases} /> in-house test cases
            </span>
          </div>

          <div className="benchmark-sets-row" style={{ display: "flex", gap: "24px", justifyContent: "center", margin: "16px 0", flexWrap: "wrap" }}>
            <div className="benchmark-set-badge" style={{ padding: "6px 14px", background: "var(--sunk)", borderRadius: "var(--r-sm)", fontSize: "0.88rem" }}>
              <b>Baseline set:</b> <BenchmarkCounter to={baseline.false_approvals} /> false approvals ({baseline.total} cases)
            </div>
            <div className="benchmark-set-badge" style={{ padding: "6px 14px", background: "var(--sunk)", borderRadius: "var(--r-sm)", fontSize: "0.88rem" }}>
              <b>Adversarial set:</b> <BenchmarkCounter to={adversarial.false_approvals} /> false approvals ({adversarial.total} cases)
            </div>
          </div>

          <div className="benchmark-meta">
            <span>Evaluated: {date}</span>
            <span>·</span>
            <span>Engine {engineVersion}</span>
            <span>·</span>
            <a
              href="https://github.com/anjishnughosh72501/Custodia#readme"
              target="_blank"
              rel="noopener noreferrer"
              className="benchmark-link"
            >
              How we measured →
            </a>
          </div>

          <p className="benchmark-disclaimer">
            This is not an accuracy figure. Real-world marketing claims vary widely; this evaluation suite measures whether our deterministic engine upholds the contract to withhold approval on known failure modes and adversarial attacks.
          </p>
        </div>
      </Reveal>
    </section>
  );
}
