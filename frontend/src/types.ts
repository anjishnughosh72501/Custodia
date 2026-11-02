export type Status = "supported" | "contradicted" | "unknown";
export type VerdictStatus = "SUPPORTED_BY_SUPPLIED_EVIDENCE" | "NOT_SUPPORTED" | "NEEDS_HUMAN_REVIEW";
export const DIMENSIONS = ["metric", "value", "unit", "population", "time_window", "conditions", "strength"] as const;
export type Dimension = (typeof DIMENSIONS)[number];

export interface Span {
  start: number;
  end: number;
  quote: string;
}

export interface Comparison {
  dimension: Dimension;
  status: Status;
  reason_code: string;
  explanation: string;
  claim_raw: string | null;
  evidence_raw: string | null;
  claim_span: Span | null;
  evidence_span: Span | null;
  needs_human: boolean;
}

export interface LanguageRisk {
  category: string;
  severity: "review" | "note";
  source: "rule" | "model";
  title: string;
  explanation: string;
  resolution: string;
  claim_span: Span | null;
  evidence_span: Span | null;
}

export interface Verdict {
  status: VerdictStatus;
  needs_human: boolean;
  summary: string;
  abstain_reasons: string[];
  counts: Record<string, number>;
}

export interface RewriteResult {
  text: string | null;
  source: string;
  passes_recheck: boolean;
  comparisons: Comparison[];
  language_risks: LanguageRisk[];
  verdict: Verdict | null;
  notes: string[];
}

export interface NliDiagnostic {
  available: boolean;
  model_id: string;
  predicted_label: "entailment" | "neutral" | "contradiction" | null;
  entailment_score: number | null;
  neutral_score: number | null;
  contradiction_score: number | null;
  truncated: boolean;
  disagreed_with_rules: boolean;
  requires_human_review: boolean;
  explanation: string | null;
  latency_ms: number | null;
  warning?: string | null;
}

export interface SourceRecord {
  source_id: string;
  source_name: string;
  source_type: "literature" | "clinical_trial" | "fact_check" | "registry";
  title: string;
  authors: string[];
  publisher?: string | null;
  publication_date?: string | null;
  doi?: string | null;
  pmid?: string | null;
  nct_id?: string | null;
  url: string;
  snippet: string;
  credibility_score: number;
  peer_reviewed: boolean;
  retraction_notice?: string | null;
  retrieved_at: string;
}

export interface DocumentChunk {
  chunk_id: string;
  document_id: string;
  filename: string;
  file_type: string;
  page_number?: number | null;
  paragraph_index?: number | null;
  section_name?: string | null;
  cell_reference?: string | null;
  text: string;
  relevance_score: number;
}

export interface ParsedDocument {
  document_id: string;
  filename: string;
  file_type: string;
  byte_size: number;
  total_chunks: number;
  chunks: DocumentChunk[];
  full_text_preview: string;
}

export interface DimensionConfidence {
  dimension: Dimension;
  status: Status;
  weight: number;
  score: number;
  reason_code: string;
  explanation: string;
  claim_raw?: string | null;
  evidence_raw?: string | null;
  claim_span?: Span | null;
  evidence_span?: Span | null;
  source_citation?: string | null;
}

export interface EvidenceConfidenceMap {
  overall_score: number;
  overall_percentage: number;
  verdict: string;
  supported_dimensions: string[];
  contradicted_dimensions: string[];
  unknown_dimensions: string[];
  missing_qualifiers: string[];
  sources_checked: string[];
  decision_reasons: string[];
  dimensions: DimensionConfidence[];
  calculation_breakdown: Record<string, any>;
}

export interface AuditRevision {
  id: string;
  review_id: string;
  version: number;
  claim_text: string;
  evidence_text: string;
  sources: Array<{ name: string; type: string; citation: string; url?: string }>;
  verdict: Verdict;
  confidence_map: EvidenceConfidenceMap | null;
  suggested_rewrite?: string | null;
  reverified_status?: string | null;
  reviewer_id?: string | null;
  reviewer_action: string;
  notes: string;
  created_at: string;
}

export interface BenchmarkSplitStats {
  total: number;
  false_approvals: number;
  false_rejections: number;
  approved: number;
  withheld: number;
}

export interface BenchmarkResult {
  total_cases: number;
  false_approvals: number;
  false_rejections: number;
  date: string;
  engine_version: string;
  latency_ms_total: number;
  latency_ms_per_case: number;
  splits: Record<string, BenchmarkSplitStats>;
  baseline: BenchmarkSplitStats;
  adversarial: BenchmarkSplitStats;
  by_category: Record<string, BenchmarkSplitStats>;
  failures: any[];
}

export interface Review {
  id: string;
  engine_version: string;
  extractor_mode: "heuristic" | "llm" | "heuristic_fallback";
  degraded: boolean;
  warnings: string[];
  claim_text: string;
  evidence_text: string;
  comparisons: Comparison[];
  language_risks: LanguageRisk[];
  language_review: string;
  verdict: Verdict;
  rewrite: RewriteResult | null;
  nli?: NliDiagnostic | null;
  confidence_map?: EvidenceConfidenceMap | null;
  sources?: SourceRecord[];
  delete_token?: string;
  user_id?: string | null;
}

export interface User {
  id: string;
  email: string;
  created_at?: string;
}

export interface Usage {
  signed_in: boolean;
  free_checks_remaining: number | null;
}

export interface Health {
  status: string;
  extractor_mode: "heuristic" | "llm";
  llm_configured: boolean;
  engine_version: string;
  language_review: string;
  limits: { claim_chars: number; evidence_chars: number };
  active_mode?: string;
  ai_ecosystem?: string;
  models?: Record<string, string>;
  llm_budget?: { used: number; cap: number };
  connectors?: Record<string, { name: string; available: boolean; cached_entries: number }>;
  nli_enabled?: boolean;
  nli_available?: boolean;
  nli_model_id?: string | null;
}

export interface Example {
  id: string;
  title: string;
  tag: string;
  blurb: string;
  claim: string;
  evidence: string;
  expected: VerdictStatus;
  candidate?: string;
}
