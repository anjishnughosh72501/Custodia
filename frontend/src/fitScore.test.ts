import { describe, it, expect } from "vitest";
import { computeFit, FIT_UNAVAILABLE_MESSAGE } from "./fitScore";
import type { Review, VerdictStatus, Status } from "./types";
import { DIMENSIONS } from "./types";

function makeReview(overrides: Partial<Review> = {}): Review {
  return {
    id: "test-rev",
    engine_version: "rules-1.1",
    extractor_mode: "heuristic",
    degraded: false,
    warnings: [],
    claim_text: "Platform cuts setup time by 40%.",
    evidence_text: "Median setup time fell by 30%.",
    comparisons: DIMENSIONS.map((dim) => ({
      dimension: dim,
      status: "supported" as Status,
      reason_code: "MATCH",
      explanation: "Matches evidence",
      claim_raw: null,
      evidence_raw: null,
      claim_span: null,
      evidence_span: null,
      needs_human: false,
    })),
    language_risks: [],
    language_review: "rules",
    verdict: {
      status: "SUPPORTED_BY_SUPPLIED_EVIDENCE" as VerdictStatus,
      needs_human: false,
      summary: "All dimensions supported",
      abstain_reasons: [],
      counts: {},
    },
    rewrite: null,
    ...overrides,
  };
}

describe("computeFit", () => {
  it("computes golden value for critical example (35)", () => {
    // critical: metric: supported, value: contradicted, unit: supported, population: contradicted,
    // time_window: unknown, conditions: unknown, strength: unknown -> sum: 1 + 0 + 1 + 0 + 0.4 + 0.4 + 0.4 = 2.8 / 7 = 40
    // 1 review-severity risk -> deduction 5 -> 35
    const review = makeReview({
      verdict: {
        status: "NOT_SUPPORTED",
        needs_human: false,
        summary: "Not supported",
        abstain_reasons: [],
        counts: {},
      },
      comparisons: [
        { dimension: "metric", status: "supported", reason_code: "", explanation: "", claim_raw: null, evidence_raw: null, claim_span: null, evidence_span: null, needs_human: false },
        { dimension: "value", status: "contradicted", reason_code: "", explanation: "", claim_raw: null, evidence_raw: null, claim_span: null, evidence_span: null, needs_human: false },
        { dimension: "unit", status: "supported", reason_code: "", explanation: "", claim_raw: null, evidence_raw: null, claim_span: null, evidence_span: null, needs_human: false },
        { dimension: "population", status: "contradicted", reason_code: "", explanation: "", claim_raw: null, evidence_raw: null, claim_span: null, evidence_span: null, needs_human: false },
        { dimension: "time_window", status: "unknown", reason_code: "", explanation: "", claim_raw: null, evidence_raw: null, claim_span: null, evidence_span: null, needs_human: false },
        { dimension: "conditions", status: "unknown", reason_code: "", explanation: "", claim_raw: null, evidence_raw: null, claim_span: null, evidence_span: null, needs_human: false },
        { dimension: "strength", status: "contradicted", reason_code: "", explanation: "", claim_raw: null, evidence_raw: null, claim_span: null, evidence_span: null, needs_human: false },
      ],
      language_risks: [
        { category: "superlative", severity: "review", source: "rule", title: "Broad", explanation: "", resolution: "", claim_span: null, evidence_span: null },
      ],
    });

    const res = computeFit(review);
    expect(res.score).toBe(35);
    expect(res.baseScore).toBe(40);
    expect(res.languageRiskDeduction).toBe(5);
    expect(res.capApplied).toBe("none");
  });

  it("computes golden value for supported example (100)", () => {
    const review = makeReview({
      verdict: {
        status: "SUPPORTED_BY_SUPPLIED_EVIDENCE",
        needs_human: false,
        summary: "Supported",
        abstain_reasons: [],
        counts: {},
      },
      comparisons: DIMENSIONS.map((dim) => ({
        dimension: dim,
        status: "supported",
        reason_code: "",
        explanation: "",
        claim_raw: null,
        evidence_raw: null,
        claim_span: null,
        evidence_span: null,
        needs_human: false,
      })),
    });

    const res = computeFit(review);
    expect(res.score).toBe(100);
    expect(res.baseScore).toBe(100);
    expect(res.capApplied).toBe("none");
  });

  it("computes golden value for mean-median (49 capped)", () => {
    // 6 supported (6.0), 1 contradicted (0) -> 6.0 / 7 = 85.7 -> 86 base.
    // verdict is NOT_SUPPORTED -> capped at 49.
    const review = makeReview({
      verdict: {
        status: "NOT_SUPPORTED",
        needs_human: false,
        summary: "Mean is not median",
        abstain_reasons: [],
        counts: {},
      },
      comparisons: DIMENSIONS.map((dim) => ({
        dimension: dim,
        status: dim === "metric" ? "contradicted" : "supported",
        reason_code: "",
        explanation: "",
        claim_raw: null,
        evidence_raw: null,
        claim_span: null,
        evidence_span: null,
        needs_human: false,
      })),
    });

    const res = computeFit(review);
    expect(res.baseScore).toBe(86);
    expect(res.score).toBe(49);
    expect(res.capApplied).toBe("not_supported");
  });

  it("computes golden value for opposite direction (49 capped)", () => {
    const review = makeReview({
      verdict: {
        status: "NOT_SUPPORTED",
        needs_human: false,
        summary: "Direction contradicted",
        abstain_reasons: [],
        counts: {},
      },
      comparisons: DIMENSIONS.map((dim) => ({
        dimension: dim,
        status: dim === "strength" ? "contradicted" : "supported",
        reason_code: "",
        explanation: "",
        claim_raw: null,
        evidence_raw: null,
        claim_span: null,
        evidence_span: null,
        needs_human: false,
      })),
    });

    const res = computeFit(review);
    expect(res.baseScore).toBe(86);
    expect(res.score).toBe(49);
    expect(res.capApplied).toBe("not_supported");
  });

  it("computes golden value for pct-points (79 capped)", () => {
    // 5 supported (5.0), 2 unknown (0.8) -> 5.8 / 7 = 82.8 -> 83 base.
    // verdict is NEEDS_HUMAN_REVIEW -> capped at 79.
    const review = makeReview({
      verdict: {
        status: "NEEDS_HUMAN_REVIEW",
        needs_human: true,
        summary: "Needs human review on unit",
        abstain_reasons: [],
        counts: {},
      },
      comparisons: DIMENSIONS.map((dim) => ({
        dimension: dim,
        status: dim === "unit" || dim === "conditions" ? "unknown" : "supported",
        reason_code: "",
        explanation: "",
        claim_raw: null,
        evidence_raw: null,
        claim_span: null,
        evidence_span: null,
        needs_human: false,
      })),
    });

    const res = computeFit(review);
    expect(res.baseScore).toBe(83);
    expect(res.score).toBe(79);
    expect(res.capApplied).toBe("needs_review");
  });

  it("computes golden value for missing-condition (79 capped)", () => {
    // 6 supported (6.0), 1 unknown (0.4) -> 6.4 / 7 = 91.4 -> 91 base.
    // verdict is NEEDS_HUMAN_REVIEW -> capped at 79.
    const review = makeReview({
      verdict: {
        status: "NEEDS_HUMAN_REVIEW",
        needs_human: true,
        summary: "Needs review on conditions",
        abstain_reasons: [],
        counts: {},
      },
      comparisons: DIMENSIONS.map((dim) => ({
        dimension: dim,
        status: dim === "conditions" ? "unknown" : "supported",
        reason_code: "",
        explanation: "",
        claim_raw: null,
        evidence_raw: null,
        claim_span: null,
        evidence_span: null,
        needs_human: false,
      })),
    });

    const res = computeFit(review);
    expect(res.baseScore).toBe(91);
    expect(res.score).toBe(79);
    expect(res.capApplied).toBe("needs_review");
  });

  it("returns null score when review is degraded or has injection/degraded abstain reason", () => {
    const degradedReview = makeReview({ degraded: true });
    expect(computeFit(degradedReview).score).toBeNull();
    expect(computeFit(degradedReview).unavailableReason).toBe(FIT_UNAVAILABLE_MESSAGE);

    const injectionReview = makeReview({
      verdict: {
        status: "NEEDS_HUMAN_REVIEW",
        needs_human: true,
        summary: "Injection detected",
        abstain_reasons: ["INSTRUCTION_LIKE_EVIDENCE"],
        counts: {},
      },
    });
    expect(computeFit(injectionReview).score).toBeNull();
    expect(computeFit(injectionReview).unavailableReason).toBe(FIT_UNAVAILABLE_MESSAGE);

    const extDegradedReview = makeReview({
      verdict: {
        status: "NEEDS_HUMAN_REVIEW",
        needs_human: true,
        summary: "Degraded extraction",
        abstain_reasons: ["EXTRACTION_DEGRADED"],
        counts: {},
      },
    });
    expect(computeFit(extDegradedReview).score).toBeNull();
  });

  it("caps NOT_SUPPORTED at 49 and NEEDS_HUMAN_REVIEW at 79 even if all dimensions are supported", () => {
    const notSupportedAllGood = makeReview({
      verdict: {
        status: "NOT_SUPPORTED",
        needs_human: false,
        summary: "Overridden",
        abstain_reasons: [],
        counts: {},
      },
    });
    const resBad = computeFit(notSupportedAllGood);
    expect(resBad.baseScore).toBe(100);
    expect(resBad.score).toBe(49);
    expect(resBad.capApplied).toBe("not_supported");

    const needsReviewAllGood = makeReview({
      verdict: {
        status: "NEEDS_HUMAN_REVIEW",
        needs_human: true,
        summary: "Overridden",
        abstain_reasons: [],
        counts: {},
      },
    });
    const resWarn = computeFit(needsReviewAllGood);
    expect(resWarn.baseScore).toBe(100);
    expect(resWarn.score).toBe(79);
    expect(resWarn.capApplied).toBe("needs_review");
  });

  it("is monotonic: worsening a dimension status never increases score", () => {
    const baseline = makeReview();
    const baseScore = computeFit(baseline).score!;

    const worseDim1 = makeReview({
      comparisons: DIMENSIONS.map((dim) => ({
        dimension: dim,
        status: dim === "metric" ? "unknown" : "supported",
        reason_code: "",
        explanation: "",
        claim_raw: null,
        evidence_raw: null,
        claim_span: null,
        evidence_span: null,
        needs_human: false,
      })),
    });
    const worseScore1 = computeFit(worseDim1).score!;
    expect(worseScore1).toBeLessThanOrEqual(baseScore);

    const worseDim2 = makeReview({
      comparisons: DIMENSIONS.map((dim) => ({
        dimension: dim,
        status: dim === "metric" ? "contradicted" : "supported",
        reason_code: "",
        explanation: "",
        claim_raw: null,
        evidence_raw: null,
        claim_span: null,
        evidence_span: null,
        needs_human: false,
      })),
    });
    const worseScore2 = computeFit(worseDim2).score!;
    expect(worseScore2).toBeLessThanOrEqual(worseScore1);
  });

  it("is a pure function that does not modify review", () => {
    const review = makeReview();
    const serialized = JSON.stringify(review);
    const r1 = computeFit(review);
    const r2 = computeFit(review);
    expect(r1).toEqual(r2);
    expect(JSON.stringify(review)).toBe(serialized);
  });
});
