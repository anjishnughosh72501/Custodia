import type { Example, Health, Review, RewriteResult, Usage, User } from "./types";
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
      credentials: "include",
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

// Authentication & Usage API
export const getMe = async (): Promise<User | null> => {
  const res = await call<{ user: User | null }>("/api/auth/me", undefined, 8000);
  return res.user;
};

export const getUsage = async (): Promise<Usage> => {
  return call<Usage>("/api/usage", undefined, 8000);
};

export const signup = async (email: string, password: string, review_ids: string[] = []): Promise<User> => {
  const res = await call<{ user: User }>("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password, review_ids }),
  });
  return res.user;
};

export const login = async (email: string, password: string, review_ids: string[] = []): Promise<User> => {
  const res = await call<{ user: User }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password, review_ids }),
  });
  return res.user;
};

export const demoLogin = async (review_ids: string[] = []): Promise<User> => {
  const res = await call<{ user: User }>("/api/auth/demo", {
    method: "POST",
    body: JSON.stringify({ review_ids }),
  });
  return res.user;
};

export const logout = async (): Promise<void> => {
  await call<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
};

export const getMyReviews = async (): Promise<Review[]> => {
  const res = await call<{ reviews: unknown[] }>("/api/reviews/mine");
  return (res.reviews || []).map(normalizeReview).filter(Boolean) as Review[];
};

// --- CodeStar Round 3 API Methods ---

export const uploadDocument = async (file: File): Promise<import("./types").ParsedDocument> => {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 60000);
  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch(`${API_BASE}/api/documents/upload`, {
      method: "POST",
      credentials: "include",
      signal: ctl.signal,
      body: formData,
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const e = (body as { error?: { code?: string; message?: string } } | null)?.error;
      throw new ApiError(e?.code ?? "UPLOAD_FAILED", e?.message ?? "Failed to upload document.");
    }
    return body as import("./types").ParsedDocument;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if ((err as Error).name === "AbortError") throw new ApiError("TIMEOUT", "Upload timed out.");
    throw new ApiError("NETWORK", "Could not upload document. Check connection.");
  } finally {
    clearTimeout(timer);
  }
};

export const searchConnectors = async (
  query: string,
  sources?: string[],
  maxResultsPerSource = 3
): Promise<{ query: string; total_sources_found: number; records: import("./types").SourceRecord[] }> => {
  return call("/api/connectors/search", {
    method: "POST",
    body: JSON.stringify({
      query,
      sources,
      max_results_per_source: maxResultsPerSource,
    }),
  });
};

export const lookupConnector = async (
  identifier: string,
  sourceType?: string
): Promise<{ identifier: string; record: import("./types").SourceRecord | null }> => {
  return call("/api/connectors/lookup", {
    method: "POST",
    body: JSON.stringify({ identifier, source_type: sourceType }),
  });
};

export const checkMultiSource = async (
  claim_text: string,
  evidence_text = "",
  source_ids: string[] = [],
  chunk_ids: string[] = []
): Promise<Review> => {
  const raw = await call<unknown>("/api/check/multi-source", {
    method: "POST",
    body: JSON.stringify({
      claim_text,
      evidence_text,
      source_ids,
      chunk_ids,
    }),
  });
  const normalized = normalizeReview(raw);
  if (!normalized) {
    throw new ApiError("INVALID_RESPONSE", "The server returned an unrecognised multi-source review format.");
  }
  return normalized;
};

export const getRevisions = async (reviewId: string): Promise<import("./types").AuditRevision[]> => {
  const res = await call<{ revisions: import("./types").AuditRevision[] }>(`/api/reviews/${reviewId}/revisions`);
  return res.revisions || [];
};

export const recordDecision = async (
  reviewId: string,
  decision: "APPROVED" | "REJECTED" | "FLAGGED_FOR_LEGAL" | "REVISED_EVIDENCE",
  notes = ""
): Promise<import("./types").AuditRevision> => {
  const res = await call<{ revision: import("./types").AuditRevision }>(`/api/reviews/${reviewId}/decide`, {
    method: "POST",
    body: JSON.stringify({ decision, notes }),
  });
  return res.revision;
};

export const runBenchmark = async (): Promise<import("./types").BenchmarkResult> => {
  return call("/api/benchmark/run", {
    method: "POST",
    body: JSON.stringify({}),
  });
};
