import { lazy, type ComponentType, type LazyExoticComponent } from "react";

/**
 * Wraps dynamic component imports with retry and reload fallback.
 * 1. Tries dynamic import.
 * 2. On failure, retries once after a short delay (300ms).
 * 3. On second failure, performs a single full-page reload guarded by sessionStorage.
 * 4. If failure persists after reload, falls through to ErrorBoundary with an upgrade notice.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>
): LazyExoticComponent<T> {
  return lazy(async () => {
    const storageKey = "custodia_chunk_retry_reloaded";
    try {
      const res = await factory();
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        // ignore sessionStorage errors
      }
      return res;
    } catch (firstError) {
      // Retry once after a short delay
      await new Promise((resolve) => setTimeout(resolve, 300));
      try {
        const res = await factory();
        try {
          sessionStorage.removeItem(storageKey);
        } catch {
          // ignore sessionStorage errors
        }
        return res;
      } catch (secondError) {
        let alreadyReloaded = false;
        try {
          alreadyReloaded = sessionStorage.getItem(storageKey) === "true";
        } catch {
          // ignore sessionStorage errors
        }

        if (!alreadyReloaded) {
          try {
            sessionStorage.setItem(storageKey, "true");
          } catch {
            // ignore sessionStorage errors
          }
          window.location.reload();
          return new Promise<{ default: T }>(() => {});
        }

        // Already reloaded once: clear key to prevent loop and throw descriptive error
        try {
          sessionStorage.removeItem(storageKey);
        } catch {
          // ignore sessionStorage errors
        }

        throw new Error(
          "Could not load the latest claim checker. A new version may have been deployed. Please refresh the page to update."
        );
      }
    }
  });
}
