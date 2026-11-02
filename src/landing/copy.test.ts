import { describe, expect, it } from "vitest";
import { LANDING_COPY } from "./copy";
import {
  FIT_SCORE_LABEL,
  FIT_SCORE_DISCLAIMER,
  FIT_UNAVAILABLE_MESSAGE,
} from "../fitScore";

describe("Landing copy validation", () => {
  const allText = JSON.stringify(LANDING_COPY).toLowerCase();

  it("does not contain banned credibility claims (trusted by, testimonial, outperform)", () => {
    expect(allText).not.toContain("trusted by");
    expect(allText).not.toContain("testimonial");
    expect(allText).not.toContain("outperform");
  });

  it("only mentions accuracy in honest disclaimer context", () => {
    // If accuracy appears, it must be part of "not an accuracy figure"
    if (allText.includes("accuracy")) {
      expect(allText).toContain("not an accuracy figure");
      // Check there are no claims like "99% accuracy" or "high accuracy"
      expect(allText).not.toMatch(/\b\d+%\s*accuracy\b/);
      expect(allText).not.toMatch(/\bhigh\s*accuracy\b/);
      expect(allText).not.toMatch(/\baccurate\s*to\b/);
    }
  });

  it("includes clear disclaimer that Supported is not objectively true", () => {
    expect(allText).toContain("cannot tell you a claim is true");
    expect(allText).toContain("never means objectively true");
  });
});

describe("Evidence fit ring copy validation", () => {
  const BANNED_WORDS = [
    "trust",
    "trustworthy",
    "credibility",
    "reliability",
    "accuracy",
    "confidence",
  ];
  const ALLOWED_DISCLAIMER =
    "Measures how closely the wording stays within your supplied evidence. It does not measure whether the source itself is reliable.";

  it("does not contain banned words except inside the exact disclaimer sentence", () => {
    const textsToCheck = [FIT_SCORE_LABEL, FIT_UNAVAILABLE_MESSAGE];
    for (const text of textsToCheck) {
      for (const word of BANNED_WORDS) {
        expect(text.toLowerCase()).not.toContain(word);
      }
    }

    // In disclaimer, only "reliable" appears inside "...whether the source itself is reliable."
    expect(FIT_SCORE_DISCLAIMER).toBe(ALLOWED_DISCLAIMER);
    const disclaimerWithoutAllowed = FIT_SCORE_DISCLAIMER.toLowerCase().replace(
      "whether the source itself is reliable.",
      ""
    );
    for (const word of BANNED_WORDS) {
      expect(disclaimerWithoutAllowed).not.toContain(word);
    }
  });
});
