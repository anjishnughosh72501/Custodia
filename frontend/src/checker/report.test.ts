import { describe, expect, it } from "vitest";
import { generateMarkdownReport } from "./report";
import { HERO_SAMPLE } from "../landing/heroSample";
import type { Review } from "../types";

describe("Markdown report generation", () => {
  const criticalReview: Review = {
    id: "demo-critical",
    engine_version: "0.3.0",
    extractor_mode: "heuristic",
    degraded: false,
    warnings: [],
    claim_text: HERO_SAMPLE.claim_text,
    evidence_text: HERO_SAMPLE.evidence_text,
    comparisons: HERO_SAMPLE.comparisons,
    language_risks: HERO_SAMPLE.language_risks,
    language_review: "Rule-based checks",
    verdict: {
      status: HERO_SAMPLE.verdict_status,
      needs_human: false,
      summary: "The claim contradicts the evidence on value, population and conditions.",
      abstain_reasons: [],
      counts: { supported: 3, contradicted: 3, unknown: 1 },
    },
    rewrite: {
      text: "In our test of 120 small businesses, median setup time fell by 30%.",
      source: "rule",
      passes_recheck: true,
      comparisons: [],
      language_risks: [],
      verdict: null,
      notes: [],
    },
  };

  it("generates expected markdown sections for the critical example", () => {
    const md = generateMarkdownReport(criticalReview, {
      date: "2026-10-27",
      consideredRisks: { "risk:0": true },
    });

    // Check title, metadata
    expect(md).toContain("# Custodia Claim Verification Report");
    expect(md).toContain("**Verdict**: Not supported by the evidence");
    expect(md).toContain("**Evidence fit**: 35 / 100");
    expect(md).toContain("**Date**: 2026-10-27");
    expect(md).toContain("**Engine**: v0.3.0");

    // Check claim and evidence
    expect(md).toContain("## Claim");
    expect(md).toContain("> Our platform cuts setup time by 40% for every business.");
    expect(md).toContain("## Evidence");
    expect(md).toContain("> In a 30-day test of 120 small-business customers using Pro, median setup time fell by 30%.");

    // Check dimensions
    expect(md).toContain("## Seven Dimensions");
    expect(md).toContain("Metric: Supported");
    expect(md).toContain("Value / statistic: Contradicted");
    expect(md).toContain("Population: Contradicted");

    // Check user notes / considered flag
    expect(md).toContain("[User marked as considered]");

    // Check rewrite
    expect(md).toContain("## Suggested Rewrite");
    expect(md).toContain("In our test of 120 small businesses, median setup time fell by 30%.");

    // Check mandatory truth disclaimer
    expect(md).toContain("Supported never means true");
  });
});
