import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getHealth, getExamples, fetchReview, createReview, ApiError } from "./api";

describe("api client", () => {
  const origFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
  });

  it("1. getHealth returns health status object", async () => {
    const mockHealth = {
      status: "ok",
      extractor_mode: "heuristic",
      llm_configured: false,
      engine_version: "rules-1.1",
      language_review: "rules",
      limits: { claim_chars: 600, evidence_chars: 4000 },
    };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockHealth,
    } as Response);

    const res = await getHealth();
    expect(res.status).toBe("ok");
    expect(res.engine_version).toBe("rules-1.1");
    expect(res.limits.claim_chars).toBe(600);
  });

  it("2. getExamples returns list of example scenarios", async () => {
    const mockExamples = [
      { id: "critical", title: "Critical example", tag: "Stretched claim", blurb: "Test", claim: "C", evidence: "E", expected: "NOT_SUPPORTED" },
    ];
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ note: "Illustrative scenarios", examples: mockExamples }),
    } as Response);

    const res = await getExamples();
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe("critical");
    expect(res[0].title).toBe("Critical example");
  });

  it("3. fetchReview retrieves and normalizes review by id", async () => {
    const mockReview = {
      id: "abc123",
      engine_version: "rules-1.1",
      extractor_mode: "heuristic",
      degraded: false,
      warnings: [],
      claim_text: "Our claim",
      evidence_text: "Our evidence",
      claim_frame: { role: "claim", text: "Our claim", dimensions: {} },
      evidence_frame: { role: "evidence", text: "Our evidence", dimensions: {} },
      comparisons: [],
      language_risks: [],
      language_review: "rules",
      verdict: {
        status: "SUPPORTED_BY_SUPPLIED_EVIDENCE",
        needs_human: false,
        summary: "Supported",
        abstain_reasons: [],
        counts: { supported: 7, contradicted: 0, unknown: 0 },
      },
    };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockReview,
    } as Response);

    const { review } = await fetchReview("abc123");
    expect(review).not.toBeNull();
    expect(review?.id).toBe("abc123");
    expect(review?.verdict.status).toBe("SUPPORTED_BY_SUPPLIED_EVIDENCE");
  });

  it("4. createReview sends POST payload and returns normalized review", async () => {
    const mockReview = {
      id: "new456",
      engine_version: "rules-1.1",
      extractor_mode: "heuristic",
      degraded: false,
      warnings: [],
      claim_text: "Test claim",
      evidence_text: "Test evidence",
      claim_frame: { role: "claim", text: "Test claim", dimensions: {} },
      evidence_frame: { role: "evidence", text: "Test evidence", dimensions: {} },
      comparisons: [],
      language_risks: [],
      language_review: "rules",
      verdict: {
        status: "SUPPORTED_BY_SUPPLIED_EVIDENCE",
        needs_human: false,
        summary: "Supported",
        abstain_reasons: [],
        counts: { supported: 7, contradicted: 0, unknown: 0 },
      },
    };
    let capturedBody = "";
    globalThis.fetch = vi.fn().mockImplementation(async (_url, opts) => {
      capturedBody = opts?.body as string;
      return {
        ok: true,
        json: async () => mockReview,
      } as Response;
    });

    const res = await createReview("Test claim", "Test evidence");
    expect(res.id).toBe("new456");
    expect(JSON.parse(capturedBody)).toEqual({
      claim_text: "Test claim",
      evidence_text: "Test evidence",
    });
  });

  it("5. throws ApiError on HTTP error with code and message from response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: { code: "CLAIM_REQUIRED", message: "Enter the marketing claim you want to check." },
      }),
    } as Response);

    await expect(createReview("", "Some evidence")).rejects.toThrowError(ApiError);
    await expect(createReview("", "Some evidence")).rejects.toMatchObject({
      code: "CLAIM_REQUIRED",
      message: "Enter the marketing claim you want to check.",
    });
  });

  it("6. throws ApiError on timeout or network error", async () => {
    // Timeout
    const abortErr = new Error("Aborted");
    abortErr.name = "AbortError";
    globalThis.fetch = vi.fn().mockRejectedValue(abortErr);

    await expect(getHealth()).rejects.toMatchObject({
      code: "TIMEOUT",
      message: expect.stringContaining("took too long"),
    });

    // Network error
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(getHealth()).rejects.toMatchObject({
      code: "NETWORK",
      message: expect.stringContaining("Could not reach the Custodia server"),
    });
  });
});
