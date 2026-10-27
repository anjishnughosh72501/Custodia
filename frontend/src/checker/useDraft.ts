import { useState, useEffect, useCallback } from "react";

const DRAFT_KEY = "custodia_claim_draft";

export interface StoredDraft {
  claim: string;
  evidence: string;
  timestamp: number;
}

export function getStoredDraft(): StoredDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && (parsed.claim?.trim() || parsed.evidence?.trim())) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveStoredDraft(claim: string, evidence: string): void {
  try {
    if (!claim.trim() && !evidence.trim()) {
      localStorage.removeItem(DRAFT_KEY);
      return;
    }
    const draft: StoredDraft = {
      claim,
      evidence,
      timestamp: Date.now(),
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // ignore
  }
}

export function clearStoredDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

export function useDraft(currentClaim: string, currentEvidence: string) {
  const [savedDraft, setSavedDraft] = useState<StoredDraft | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const draft = getStoredDraft();
    if (draft && !currentClaim.trim() && !currentEvidence.trim()) {
      setSavedDraft(draft);
    }
  }, []);

  // Auto-save draft when fields change (if non-empty)
  useEffect(() => {
    if (currentClaim.trim() || currentEvidence.trim()) {
      const timer = setTimeout(() => {
        saveStoredDraft(currentClaim, currentEvidence);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [currentClaim, currentEvidence]);

  const restore = useCallback(() => {
    const draft = getStoredDraft();
    setSavedDraft(null);
    setDismissed(true);
    return draft;
  }, []);

  const dismiss = useCallback(() => {
    setSavedDraft(null);
    setDismissed(true);
  }, []);

  const showBanner =
    !dismissed &&
    savedDraft !== null &&
    !currentClaim.trim() &&
    !currentEvidence.trim();

  return {
    showBanner,
    savedDraft,
    restore,
    dismiss,
    clearDraft: clearStoredDraft,
  };
}
