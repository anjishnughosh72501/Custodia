import { DIMENSIONS, type Dimension, type Review, type Status } from "./types";

export const FIT_SCORE_LABEL = "Evidence fit";

export const FIT_SCORE_DISCLAIMER =
  "Measures how closely the wording stays within your supplied evidence. It does not measure whether the source itself is reliable.";

export const FIT_UNAVAILABLE_MESSAGE =
  "Score unavailable: the check itself could not be completed reliably.";

export interface FitScorePart {
  dimension: Dimension;
  status: Status;
  points: number; // 1.0 for supported, 0.4 for unknown, 0 for contradicted
}

export interface FitResult {
  score: number | null;
  baseScore: number;
  parts: FitScorePart[];
  languageRiskDeduction: number;
  reviewRiskCount: number;
  capApplied: "none" | "needs_review" | "not_supported";
  rawScore: number;
  unavailableReason?: string;
}

const DIMENSION_POINTS: Record<Status, number> = {
  supported: 1.0,
  unknown: 0.4,
  contradicted: 0.0,
};

/**
 * Computes the deterministic Evidence fit score (0-100) from a verified Review.
 * Display-only: does not modify the review or verdict.
 */
export function computeFit(review: Review): FitResult {
  // 1. Unavailable check: degraded extractor or unverified / instruction-like input
  const isDegraded = !!review.degraded;
  const abstainReasons = review.verdict?.abstain_reasons ?? [];
  const hasAbstainReason =
    abstainReasons.includes("EXTRACTION_DEGRADED") ||
    abstainReasons.includes("INSTRUCTION_LIKE_EVIDENCE");

  if (isDegraded || hasAbstainReason) {
    return {
      score: null,
      baseScore: 0,
      parts: [],
      languageRiskDeduction: 0,
      reviewRiskCount: 0,
      capApplied: "none",
      rawScore: 0,
      unavailableReason: FIT_UNAVAILABLE_MESSAGE,
    };
  }

  // 2. Base score from 7 dimensions
  const comparisonsByDim = new Map<string, Status>();
  for (const c of review.comparisons ?? []) {
    comparisonsByDim.set(c.dimension, c.status);
  }

  const parts: FitScorePart[] = [];
  let pointsSum = 0;

  for (const dim of DIMENSIONS) {
    const status: Status = comparisonsByDim.get(dim) ?? "unknown";
    const pts = DIMENSION_POINTS[status] ?? 0.4;
    parts.push({
      dimension: dim,
      status,
      points: pts,
    });
    pointsSum += pts;
  }

  const baseScore = Math.round((100 * pointsSum) / 7);

  // 3. Language risks deduction
  const reviewRisks = (review.language_risks ?? []).filter(
    (r) => r.severity === "review"
  );
  const reviewRiskCount = reviewRisks.length;
  const languageRiskDeduction = Math.min(15, reviewRiskCount * 5);
  const rawScore = baseScore - languageRiskDeduction;

  // 4. Verdict caps (verdict always wins)
  let cappedScore = rawScore;
  let capApplied: "none" | "needs_review" | "not_supported" = "none";

  const verdictStatus = review.verdict?.status;

  if (verdictStatus === "NOT_SUPPORTED") {
    if (cappedScore > 49) {
      cappedScore = 49;
      capApplied = "not_supported";
    }
  } else if (verdictStatus === "NEEDS_HUMAN_REVIEW") {
    if (cappedScore > 79) {
      cappedScore = 79;
      capApplied = "needs_review";
    }
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(cappedScore)));

  return {
    score: finalScore,
    baseScore,
    parts,
    languageRiskDeduction,
    reviewRiskCount,
    capApplied,
    rawScore,
  };
}
