import type { Review } from "../types";
import { DIM_LABEL, STATUS_LABEL, VERDICT_TITLE, reasonLabel } from "../labels";

export interface GenerateReportOptions {
  date?: string;
  consideredRisks?: Record<string, boolean>;
}

export function generateMarkdownReport(
  review: Review,
  options: GenerateReportOptions = {}
): string {
  const dateStr = options.date ?? new Date().toISOString().split("T")[0];
  const verdictTitle =
    VERDICT_TITLE[review.verdict.status] ?? review.verdict.status;

  const lines: string[] = [];

  lines.push("# Custodia Claim Verification Report");
  lines.push("");
  lines.push(`**Verdict**: ${verdictTitle}`);
  lines.push(`**Date**: ${dateStr}`);
  lines.push(`**Engine**: v${review.engine_version}`);
  lines.push(`**Mode**: ${review.extractor_mode}`);
  lines.push("");

  lines.push("## Claim");
  lines.push(`> ${review.claim_text.trim()}`);
  lines.push("");

  lines.push("## Evidence");
  lines.push(`> ${review.evidence_text.trim()}`);
  lines.push("");

  lines.push("## Verdict Summary");
  lines.push(review.verdict.summary);
  lines.push("");

  lines.push("## Seven Dimensions");
  review.comparisons.forEach((c, idx) => {
    const dimName = DIM_LABEL[c.dimension] ?? c.dimension;
    const statusName = STATUS_LABEL[c.status] ?? c.status;
    lines.push(`### ${idx + 1}. ${dimName}: ${statusName}`);
    lines.push(`- **Reason**: ${reasonLabel(c.reason_code)}`);
    lines.push(`- **Explanation**: ${c.explanation}`);
    lines.push(`- **Draft says**: "${c.claim_raw ?? "Not stated in the draft"}"`);
    lines.push(
      `- **Evidence says**: "${c.evidence_raw ?? "Not stated in the evidence"}"`
    );
    if (c.needs_human) {
      lines.push("- **Human review**: Required for this finding");
    }
    lines.push("");
  });

  lines.push("## Language Risks");
  if (review.language_risks.length === 0) {
    lines.push("No wording risks found by rule-based checks.");
  } else {
    review.language_risks.forEach((r, idx) => {
      const considered = options.consideredRisks?.[`risk:${idx}`]
        ? " [User marked as considered]"
        : "";
      lines.push(
        `- **[${r.severity.toUpperCase()}]** ${r.title}${considered}`
      );
      lines.push(`  *Explanation*: ${r.explanation}`);
      lines.push(`  *Resolution*: ${r.resolution}`);
    });
  }
  lines.push("");

  if (review.rewrite?.text) {
    lines.push("## Suggested Rewrite");
    lines.push(`> ${review.rewrite.text.trim()}`);
    lines.push(
      `*Passes re-check*: ${review.rewrite.passes_recheck ? "Yes" : "No"}`
    );
    lines.push("");
  }

  lines.push("---");
  lines.push(
    "*Supported never means true. Custodia evaluates supplied text against supplied evidence only; it cannot determine whether external claims are factual.*"
  );

  return lines.join("\n");
}

export async function copyReportToClipboard(
  review: Review,
  consideredRisks?: Record<string, boolean>
): Promise<boolean> {
  const md = generateMarkdownReport(review, { consideredRisks });
  try {
    await navigator.clipboard.writeText(md);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = md;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}
