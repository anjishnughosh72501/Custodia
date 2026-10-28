import { describe, expect, it, beforeEach } from "vitest";
import {
  getStoredReviews,
  saveStoredReviews,
  type LocalReviewItem,
} from "./useLocalList";

if (typeof globalThis.localStorage === "undefined") {
  let store: Record<string, string> = {};
  globalThis.localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() { return Object.keys(store).length; },
  } as any;
}

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
});
