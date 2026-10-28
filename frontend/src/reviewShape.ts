import type {
  Comparison,
  Dimension,
  LanguageRisk,
  Review,
  Span,
  Status,
  Verdict,
  VerdictStatus,
} from "./types";
import { DIMENSIONS } from "./types";

const VALID_VERDICTS: VerdictStatus[] = [
  "SUPPORTED_BY_SUPPLIED_EVIDENCE",
  "NOT_SUPPORTED",
  "NEEDS_HUMAN_REVIEW",
];

const VALID_STATUSES: Status[] = ["supported", "contradicted", "unknown"];

function parseSpan(spanRaw: unknown): Span | null {
  if (!spanRaw || typeof spanRaw !== "object") return null;
  const s = spanRaw as Record<string, unknown>;
  if (typeof s.start === "number" && typeof s.end === "number" && typeof s.quote === "string") {
    return { start: s.start, end: s.end, quote: s.quote };
  }
  return null;
}

/**
 * Validates and normalizes raw API review data.
 * Checks essential fields required by the UI and fills safe defaults for optional fields.
 * Returns null if any required field is missing or invalid.
 */
export function normalizeReview(raw: unknown): Review | null {
  if (!raw || typeof raw !== "object") return null;

  const data = raw as Record<string, unknown>;

  // Required top-level fields
  if (typeof data.id !== "string" || !data.id.trim()) return null;
  if (typeof data.claim_text !== "string") return null;
  if (typeof data.evidence_text !== "string") return null;

  // Verdict validation
  if (!data.verdict || typeof data.verdict !== "object") return null;
  const rawVerdict = data.verdict as Record<string, unknown>;
  if (
    typeof rawVerdict.status !== "string" ||
    !VALID_VERDICTS.includes(rawVerdict.status as VerdictStatus)
  ) {
    return null;
  }

  const verdict: Verdict = {
    status: rawVerdict.status as VerdictStatus,
    needs_human: typeof rawVerdict.needs_human === "boolean" ? rawVerdict.needs_human : false,
    summary: typeof rawVerdict.summary === "string" ? rawVerdict.summary : "",
    abstain_reasons: Array.isArray(rawVerdict.abstain_reasons)
      ? rawVerdict.abstain_reasons.filter((r): r is string => typeof r === "string")
      : [],
    counts:
      rawVerdict.counts && typeof rawVerdict.counts === "object"
        ? (rawVerdict.counts as Record<string, number>)
        : {},
  };

  // Comparisons validation (must be an array of seven or fewer)
  if (!Array.isArray(data.comparisons)) return null;
  if (data.comparisons.length > 7) return null;

  const comparisons: Comparison[] = [];
  for (const item of data.comparisons) {
    if (!item || typeof item !== "object") return null;
    const c = item as Record<string, unknown>;

    if (
      typeof c.dimension !== "string" ||
      !DIMENSIONS.includes(c.dimension as Dimension)
    ) {
      return null;
    }
    if (
      typeof c.status !== "string" ||
      !VALID_STATUSES.includes(c.status as Status)
    ) {
      return null;
    }

    comparisons.push({
      dimension: c.dimension as Dimension,
      status: c.status as Status,
      reason_code: typeof c.reason_code === "string" ? c.reason_code : "",
      explanation: typeof c.explanation === "string" ? c.explanation : "",
      claim_raw: typeof c.claim_raw === "string" ? c.claim_raw : null,
      evidence_raw: typeof c.evidence_raw === "string" ? c.evidence_raw : null,
      claim_span: parseSpan(c.claim_span),
      evidence_span: parseSpan(c.evidence_span),
      needs_human: typeof c.needs_human === "boolean" ? c.needs_human : false,
    });
  }

  // Safe defaults for optional fields
  const engine_version =
    typeof data.engine_version === "string" ? data.engine_version : "rules-1.1";
  const extractor_mode =
    data.extractor_mode === "llm" || data.extractor_mode === "heuristic_fallback"
      ? data.extractor_mode
      : "heuristic";
  const degraded = typeof data.degraded === "boolean" ? data.degraded : false;
  const warnings = Array.isArray(data.warnings)
    ? data.warnings.filter((w): w is string => typeof w === "string")
    : [];

  const language_risks: LanguageRisk[] = [];
  if (Array.isArray(data.language_risks)) {
    for (const r of data.language_risks) {
      if (r && typeof r === "object") {
        const item = r as Record<string, unknown>;
        language_risks.push({
          category: typeof item.category === "string" ? item.category : "other",
          severity: item.severity === "review" ? "review" : "note",
          source: item.source === "model" ? "model" : "rule",
          title: typeof item.title === "string" ? item.title : "",
          explanation: typeof item.explanation === "string" ? item.explanation : "",
          resolution: typeof item.resolution === "string" ? item.resolution : "",
          claim_span: parseSpan(item.claim_span),
          evidence_span: parseSpan(item.evidence_span),
        });
      }
    }
  }

  const language_review =
    typeof data.language_review === "string" ? data.language_review : "";
  const rewrite =
    data.rewrite && typeof data.rewrite === "object"
      ? (data.rewrite as Review["rewrite"])
      : null;

  let nli: Review["nli"] = null;
  if (data.nli && typeof data.nli === "object") {
    const rawNli = data.nli as Record<string, unknown>;
    nli = {
      available: typeof rawNli.available === "boolean" ? rawNli.available : false,
      model_id: typeof rawNli.model_id === "string" ? rawNli.model_id : "",
      predicted_label:
        rawNli.predicted_label === "entailment" ||
        rawNli.predicted_label === "neutral" ||
        rawNli.predicted_label === "contradiction"
          ? rawNli.predicted_label
          : null,
      entailment_score: typeof rawNli.entailment_score === "number" ? rawNli.entailment_score : null,
      neutral_score: typeof rawNli.neutral_score === "number" ? rawNli.neutral_score : null,
      contradiction_score: typeof rawNli.contradiction_score === "number" ? rawNli.contradiction_score : null,
      truncated: typeof rawNli.truncated === "boolean" ? rawNli.truncated : false,
      disagreed_with_rules: typeof rawNli.disagreed_with_rules === "boolean" ? rawNli.disagreed_with_rules : false,
      requires_human_review: typeof rawNli.requires_human_review === "boolean" ? rawNli.requires_human_review : false,
      explanation: typeof rawNli.explanation === "string" ? rawNli.explanation : null,
      latency_ms: typeof rawNli.latency_ms === "number" ? rawNli.latency_ms : null,
      warning: typeof rawNli.warning === "string" ? rawNli.warning : undefined,
    };
  }

  return {
    id: data.id,
    claim_text: data.claim_text,
    evidence_text: data.evidence_text,
    verdict,
    comparisons,
    engine_version,
    extractor_mode,
    degraded,
    warnings,
    language_risks,
    language_review,
    rewrite,
    nli,
  };
}
