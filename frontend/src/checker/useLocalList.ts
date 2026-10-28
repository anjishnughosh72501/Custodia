import { useState, useEffect, useCallback } from "react";

export interface LocalReviewItem {
  id: string;
  claimSnippet: string;
  claimFull: string;
  evidenceFull: string;
  verdictStatus: string;
  timestamp: number;
}

const STORAGE_KEY = "custodia_recent_checks";
const LEGACY_STORAGE_KEY = "custodia_recent_reviews";
const MAX_ITEMS = 8;
const MAX_STORED_TEXT_LENGTH = 10000;

export function getStoredReviews(): LocalReviewItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

export function saveStoredReviews(items: LocalReviewItem[]): boolean {
  try {
    const capped = items.slice(0, MAX_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(capped));
    return true;
  } catch {
    return false;
  }
}

export function useLocalList() {
  const [items, setItems] = useState<LocalReviewItem[]>(() => getStoredReviews());

  useEffect(() => {
    setItems(getStoredReviews());
  }, []);

  const addItem = useCallback(
    (item: Omit<LocalReviewItem, "timestamp">) => {
      try {
        const newItem: LocalReviewItem = {
          id: item.id,
          claimSnippet: (item.claimSnippet || item.claimFull || "").slice(0, 60),
          claimFull: (item.claimFull || "").slice(0, MAX_STORED_TEXT_LENGTH),
          evidenceFull: (item.evidenceFull || "").slice(0, MAX_STORED_TEXT_LENGTH),
          verdictStatus: item.verdictStatus,
          timestamp: Date.now(),
        };

        const existing = getStoredReviews();
        // remove existing with same id if any
        const filtered = existing.filter((i) => i.id !== newItem.id);
        const updated = [newItem, ...filtered].slice(0, MAX_ITEMS);
        saveStoredReviews(updated);
        setItems(updated);
      } catch {
        // graceful fallback if localStorage fails
      }
    },
    []
  );

  const removeItem = useCallback((id: string) => {
    try {
      const existing = getStoredReviews();
      const updated = existing.filter((i) => i.id !== id);
      saveStoredReviews(updated);
      setItems(updated);
    } catch {
      // ignore
    }
  }, []);

  const clearAll = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // ignore
    }
    setItems([]);
  }, []);

  return { items, addItem, removeItem, clearAll };
}
