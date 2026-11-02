import { describe, it, expect } from "vitest";
import { normalizeReview } from "./reviewShape";

describe("normalizeReview", () => {
  const minimalValid = {
    id: "rev-123",
    claim_text: "Median setup time fell by 30%.",
    evidence_text: "In a test of 120 customers, median setup time fell by 30%.",
    verdict: {
      status: "SUPPORTED_BY_SUPPLIED_EVIDENCE",
    },
    comparisons: [
      {
        dimension: "metric",
        status: "supported",
      },
    ],
  };

  it("normalizes a valid minimal review filling defaults", () => {
    const res = normalizeReview(minimalValid);
    expect(res).not.toBeNull();
    expect(res?.id).toBe("rev-123");
    expect(res?.verdict.status).toBe("SUPPORTED_BY_SUPPLIED_EVIDENCE");
    expect(res?.verdict.needs_human).toBe(false);
    expect(res?.verdict.summary).toBe("");
    expect(res?.language_risks).toEqual([]);
    expect(res?.warnings).toEqual([]);
    expect(res?.degraded).toBe(false);
    expect(res?.engine_version).toBe("rules-1.1");
    expect(res?.rewrite).toBeNull();
  });

  it("preserves optional fields when provided", () => {
    const withOptionals = {
      ...minimalValid,
      degraded: true,
      warnings: ["extractor warning"],
      language_risks: [
        {
          category: "hedging",
          severity: "review",
          source: "rule",
          title: "Hedged claim",
          explanation: "Words indicate speculation.",
          resolution: "State facts directly.",
        },
      ],
      nli: {
        available: true,
        model_id: "cross-encoder/nli-MiniLM2-L6-H768",
        predicted_label: "entailment",
        entailment_score: 0.98,
        neutral_score: 0.01,
        contradiction_score: 0.01,
        truncated: false,
        disagreed_with_rules: false,
        requires_human_review: false,
        explanation: "Semantic inference agrees that the evidence entails the claim.",
        latency_ms: 12.5,
      },
    };
    const res = normalizeReview(withOptionals);
    expect(res).not.toBeNull();
    expect(res?.degraded).toBe(true);
    expect(res?.warnings).toEqual(["extractor warning"]);
    expect(res?.language_risks.length).toBe(1);
    expect(res?.language_risks[0].title).toBe("Hedged claim");
    expect(res?.nli?.available).toBe(true);
    expect(res?.nli?.predicted_label).toBe("entailment");
    expect(res?.nli?.entailment_score).toBe(0.98);
  });

  it("returns null on null, undefined, or non-object", () => {
    expect(normalizeReview(null)).toBeNull();
    expect(normalizeReview(undefined)).toBeNull();
    expect(normalizeReview("string")).toBeNull();
    expect(normalizeReview(123)).toBeNull();
  });

  it("returns null if required fields are missing", () => {
    expect(normalizeReview({ ...minimalValid, id: "" })).toBeNull();
    expect(normalizeReview({ ...minimalValid, claim_text: undefined })).toBeNull();
    expect(normalizeReview({ ...minimalValid, evidence_text: undefined })).toBeNull();
    expect(normalizeReview({ ...minimalValid, verdict: undefined })).toBeNull();
    expect(normalizeReview({ ...minimalValid, verdict: { status: "INVALID_STATUS" } })).toBeNull();
    expect(normalizeReview({ ...minimalValid, comparisons: "not-an-array" })).toBeNull();
    expect(normalizeReview({ ...minimalValid, comparisons: [{ dimension: "invalid-dim", status: "supported" }] })).toBeNull();
  });

  it("returns null if comparisons has more than 7 items", () => {
    const eightComparisons = Array.from({ length: 8 }, () => ({
      dimension: "metric",
      status: "supported",
    }));
    expect(normalizeReview({ ...minimalValid, comparisons: eightComparisons })).toBeNull();
  });
});
