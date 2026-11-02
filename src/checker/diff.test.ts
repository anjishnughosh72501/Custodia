import { describe, it, expect } from "vitest";
import { computeWordDiff } from "./diff";

describe("computeWordDiff", () => {
  it("handles empty strings", () => {
    expect(computeWordDiff("", "")).toEqual([]);
    expect(computeWordDiff("", "hello")).toEqual([{ type: "insert", text: "hello" }]);
    expect(computeWordDiff("hello", "")).toEqual([{ type: "delete", text: "hello" }]);
  });

  it("handles identical strings", () => {
    const diff = computeWordDiff("Median setup time fell by 30%.", "Median setup time fell by 30%.");
    expect(diff).toEqual([{ type: "equal", text: "Median setup time fell by 30%." }]);
  });

  it("detects word additions and removals", () => {
    const orig = "Setup time fell by 35% for all businesses.";
    const sugg = "In a test of 120 small businesses, setup time fell by 30%.";
    const diff = computeWordDiff(orig, sugg);

    const insertions = diff.filter((t) => t.type === "insert");
    const deletions = diff.filter((t) => t.type === "delete");
    const equals = diff.filter((t) => t.type === "equal");

    expect(insertions.length).toBeGreaterThan(0);
    expect(deletions.length).toBeGreaterThan(0);
    expect(equals.length).toBeGreaterThan(0);

    // Verify reconstructs suggested string from non-delete tokens
    const reconstructedSugg = diff
      .filter((t) => t.type !== "delete")
      .map((t) => t.text)
      .join("");
    expect(reconstructedSugg).toBe(sugg);

    // Verify reconstructs original string from non-insert tokens
    const reconstructedOrig = diff
      .filter((t) => t.type !== "insert")
      .map((t) => t.text)
      .join("");
    expect(reconstructedOrig).toBe(orig);
  });
});
