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

// =========================================================================
// INKLOOM BRAND GOVERNANCE TYPES
// =========================================================================

export interface BrandProfile {
  id: string;
  org_id: string;
  name: string;
  tagline: string;
  description: string;
  tone_guidelines: string[];
  target_audience: string;
  primary_colors: string[];
  font_families: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BrandRule {
  id: string;
  org_id: string;
  brand_profile_id: string;
  category: "TERMINOLOGY" | "MESSAGING" | "FACTS" | "CLAIMS" | "LEGAL" | "VISUAL" | "ACCESSIBILITY";
  enforcement: "STRICT" | "WARNING" | "ADVISORY";
  title: string;
  rule_text: string;
  explanation: string;
  forbidden_patterns: string[];
  preferred_alternatives: string[];
  required_disclaimers: string[];
  source_document?: string;
  source_location?: string;
  status: "ACTIVE" | "INACTIVE" | "EXTRACTED" | "DRAFT";
  version: number;
  created_at: string;
  updated_at: string;
}

export interface ApprovedFact {
  id: string;
  org_id: string;
  brand_profile_id: string;
  category: "PRICING" | "METRIC" | "PRODUCT" | "DISCLAIMER" | "COHORT" | "DATES";
  entity_name: string;
  canonical_value: string;
  canonical_number?: number;
  canonical_unit?: string;
  statement: string;
  proof_citation: string;
  valid_from?: string;
  valid_to?: string;
  is_active: boolean;
  created_at: string;
}

export interface BrandAsset {
  id: string;
  org_id: string;
  brand_profile_id: string;
  name: string;
  asset_type: "LOGO" | "IMAGE" | "PALETTE" | "FONT" | "TEMPLATE";
  file_path?: string;
  file_url?: string;
  mime_type: string;
  sha256: string;
  hex_colors: string[];
  dimensions: Record<string, number>;
  usage_guidelines: string;
  is_active: boolean;
  created_at: string;
}

export interface PreflightFinding {
  id: string;
  title: string;
  category: "TERMINOLOGY" | "MESSAGING" | "FACTS" | "CLAIMS" | "LEGAL" | "VISUAL" | "ACCESSIBILITY";
  enforcement: "STRICT" | "WARNING" | "ADVISORY";
  confidence: number;
  highlighted_text: string;
  affected_content?: string;
  span_start?: number;
  span_end?: number;
  explanation: string;
  rule_id?: string;
  rule_title?: string;
  source_reference?: string;
  suggested_fix?: string;
  suggested_correction?: string;
  status: "OPEN" | "ACCEPTED" | "DISMISSED" | "EDITED";
}

export interface PreflightReview {
  id: string;
  org_id: string;
  user_id: string;
  brand_profile_id: string;
  title: string;
  content_raw: string;
  original_text?: string;
  current_text?: string;
  category: "AD" | "ADVERTISEMENT" | "SOCIAL_MEDIA" | "LANDING_PAGE" | "PRESS_RELEASE" | "PRODUCT_COPY" | "EMAIL" | "PACKAGING";
  channels: string[];
  workflow_status: "DRAFT" | "PROCESSING" | "NEEDS_REVISION" | "REVISION_REQUESTED" | "PENDING_REVIEW" | "FLAGGED_FOR_LEGAL" | "APPROVED" | "APPROVED_WITH_CONDITIONS" | "REJECTED";
  overall_score: number;
  governance_score?: number;
  risk_tier: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  findings: PreflightFinding[];
  corrected_content?: string;
  suggested_rewrite?: string;
  metadata?: Record<string, any>;
  created_by?: string;
  reviewer_id?: string;
  reviewer_decision?: string;
  reviewer_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface GovernanceAnalytics {
  total_reviews: number;
  approved_count: number;
  approved_with_conditions_count: number;
  rejected_count: number;
  needs_revision_count: number;
  pending_review_count: number;
  approval_rate_pct: number;
  average_governance_score: number;
  overall_compliance_score: number;
  common_violations_by_category: Record<string, number>;
  category_breakdown: Record<string, number>;
  top_violated_rules: Array<{ rule_id: string; rule_title: string; count: number }>;
  monthly_trend: Array<{ period: string; score: number; reviews: number }>;
  is_live_data: boolean;
}

export interface Phase17DemoResult {
  success: boolean;
  scenario: string;
  original_copy: string;
  initial_score: number;
  initial_risk_tier: string;
  findings_count: number;
  findings: PreflightFinding[];
  all_4_issues_detected: boolean;
  suggested_copy: string;
  corrected_copy_applied: string;
  final_status: string;
  reviewer_decision: string;
  audit_event_id: string;
}
