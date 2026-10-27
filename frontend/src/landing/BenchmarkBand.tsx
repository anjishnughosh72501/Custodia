import { useEffect, useRef } from "react";
import { Reveal } from "../motion/Reveal";
import { animateCounter } from "../motion/anime";
import benchmarkData from "./benchmark.json";

interface BenchmarkPayload {
  false_approvals: number | null;
  total_cases?: number | null;
  date?: string | null;
  engine_version?: string | null;
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
  const totalCases = data.total_cases ?? 60;
  const date = data.date ?? "Oct 2026";
  const engineVersion = data.engine_version ?? "0.3.0";

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

          <div className="benchmark-meta">
            <span>Evaluated: {date}</span>
            <span>·</span>
            <span>Engine v{engineVersion}</span>
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
            Evaluation suite tests regression across fixed test cases; not an accuracy figure for general claims.
          </p>
        </div>
      </Reveal>
    </section>
  );
}
