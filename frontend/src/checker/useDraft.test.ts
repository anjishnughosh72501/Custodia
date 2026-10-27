import { describe, expect, it, beforeEach } from "vitest";
import {
  getStoredDraft,
  saveStoredDraft,
  clearStoredDraft,
} from "./useDraft";

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

describe("useDraft storage operations", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("saves and retrieves non-empty draft", () => {
    saveStoredDraft("My test claim", "My test evidence");
    const draft = getStoredDraft();
    expect(draft).not.toBeNull();
    expect(draft?.claim).toBe("My test claim");
    expect(draft?.evidence).toBe("My test evidence");
  });

  it("removes draft when claim and evidence are both empty", () => {
    saveStoredDraft("Temporary claim", "Temporary evidence");
    expect(getStoredDraft()).not.toBeNull();

    saveStoredDraft("", "");
    expect(getStoredDraft()).toBeNull();
  });

  it("clears stored draft cleanly", () => {
    saveStoredDraft("Claim text", "Evidence text");
    expect(getStoredDraft()).not.toBeNull();

    clearStoredDraft();
    expect(getStoredDraft()).toBeNull();
  });

  it("survives corrupted json in draft storage", () => {
    localStorage.setItem("custodia_claim_draft", "broken-json");
    expect(getStoredDraft()).toBeNull();
  });
});
