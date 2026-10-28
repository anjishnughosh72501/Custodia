import type { Example, Health, Review, RewriteResult } from "./types";
import { normalizeReview } from "./reviewShape";

export { normalizeReview };

export const API_BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

async function call<T>(path: string, init?: RequestInit, timeoutMs = 45000): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  const url = `${API_BASE}${path}`;
  try {
    const res = await fetch(url, {
      ...init,
      signal: ctl.signal,
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    });
    if (res.status === 204) {
      return {} as T;
    }
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const e = (body as { error?: { code?: string; message?: string } } | null)?.error;
      throw new ApiError(e?.code ?? "HTTP_" + res.status, e?.message ?? "The server could not complete the request.");
    }
    return body as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if ((err as Error).name === "AbortError") throw new ApiError("TIMEOUT", "The check took too long. Try again, or shorten the evidence.");
    throw new ApiError("NETWORK", "Could not reach the Custodia server. Check your connection and try again.");
  } finally { clearTimeout(timer); }
}

export const pingServer = async (): Promise<boolean> => {
  try {
    await call<{ ok: boolean }>("/api/ping", undefined, 5000);
    return true;
  } catch {
    // Retry once on failure
    try {
      await call<{ ok: boolean }>("/api/ping", undefined, 5000);
      return true;
    } catch {
      return false;
    }
  }
};

export const getHealth = () => call<Health>("/api/health", undefined, 8000);
export const getExamples = () => call<{ examples: Example[] }>("/api/examples", undefined, 8000).then((r) => r.examples);

export interface FetchReviewResult {
  review: Review | null;
  raw?: unknown;
}

export const fetchReview = async (id: string): Promise<FetchReviewResult> => {
  const raw = await call<unknown>(`/api/reviews/${id}`);
  return { review: normalizeReview(raw), raw };
};

export const getReview = (id: string): Promise<Review | null> =>
  fetchReview(id).then((res) => res.review);

export const createReview = async (claim_text: string, evidence_text: string): Promise<Review> => {
  const raw = await call<unknown>("/api/reviews", {
    method: "POST",
    body: JSON.stringify({ claim_text, evidence_text }),
  });
  const normalized = normalizeReview(raw);
  if (!normalized) {
    throw new ApiError("INVALID_RESPONSE", "The server returned an unrecognised review format.");
  }
  // Preserve delete_token from raw response if provided
  if (raw && typeof raw === "object" && typeof (raw as Record<string, unknown>).delete_token === "string") {
    normalized.delete_token = (raw as Record<string, unknown>).delete_token as string;
  }
  return normalized;
};

export const deleteReview = async (id: string, deleteToken: string): Promise<void> => {
  await call<unknown>(`/api/reviews/${id}`, {
    method: "DELETE",
    headers: { "x-delete-token": deleteToken },
  });
};

export const requestRewrite = (id: string, candidate_text?: string) =>
  call<RewriteResult>(`/api/reviews/${id}/rewrite`, { method: "POST", body: JSON.stringify(candidate_text === undefined ? {} : { candidate_text }) });
