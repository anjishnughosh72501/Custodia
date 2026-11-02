import { describe, expect, it, beforeEach } from "vitest";
import {
  getStoredReviews,
  saveStoredReviews,
  isDemoItem,
  type LocalReviewItem,
} from "./useLocalList";

let store: Record<string, string> = {};
const mockStorage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = String(value); },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { store = {}; },
  key: (index: number) => Object.keys(store)[index] ?? null,
  get length() { return Object.keys(store).length; },
};
Object.defineProperty(globalThis, "localStorage", {
  value: mockStorage,
  writable: true,
  configurable: true,
});
describe("useLocalList storage operations", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("caps stored reviews at 8 items", () => {
    const items: LocalReviewItem[] = Array.from({ length: 15 }, (_, i) => ({
      id: `rev-${i}`,
      claimSnippet: `Claim ${i}`,
      claimFull: `Full claim text ${i}`,
      evidenceFull: `Full evidence text ${i}`,
      verdictStatus: "NOT_SUPPORTED",
      timestamp: Date.now() + i,
    }));

    saveStoredReviews(items);
    const loaded = getStoredReviews();
    expect(loaded.length).toBe(8);
    expect(loaded[0].id).toBe("rev-0");
    expect(loaded[7].id).toBe("rev-7");
  });

  it("survives corrupted localStorage without throwing", () => {
    localStorage.setItem("custodia_recent_reviews", "invalid-json-{{{");
    const loaded = getStoredReviews();
    expect(loaded).toEqual([]);
  });

  it("survives non-array JSON without throwing", () => {
    localStorage.setItem("custodia_recent_reviews", JSON.stringify({ not: "an array" }));
    const loaded = getStoredReviews();
    expect(loaded).toEqual([]);
  });

  it("identifies demo/example scenarios via isDemoItem", () => {
    expect(
      isDemoItem({
        id: "critical",
        claimSnippet: "Our platform cuts setup time by 40% for every business.",
      })
    ).toBe(true);

    expect(
      isDemoItem({
        id: "actual-user-check-123",
        claimFull: "My custom startup cuts energy costs by 15%.",
        evidenceFull: "According to our audited bill from June 2026, costs decreased by 15%.",
      })
    ).toBe(false);
  });

  it("filters out demo data from stored reviews while preserving actual data", () => {
    const mixedItems: LocalReviewItem[] = [
      {
        id: "critical",
        claimSnippet: "Our platform cuts setup time by 40% for every business.",
        claimFull: "Our platform cuts setup time by 40% for every business.",
        evidenceFull: "In a 30-day test of 120 small-business customers using Pro, median setup time fell by 30%.",
        verdictStatus: "NOT_SUPPORTED",
        timestamp: Date.now(),
      },
      {
        id: "actual-check-1",
        claimSnippet: "Custom user claim text",
        claimFull: "Custom user claim text for review",
        evidenceFull: "Custom evidence text for review",
        verdictStatus: "SUPPORTED",
        timestamp: Date.now() + 1,
      },
    ];

    saveStoredReviews(mixedItems);
    const loaded = getStoredReviews();
    expect(loaded.length).toBe(1);
    expect(loaded[0].id).toBe("actual-check-1");
  });
});
