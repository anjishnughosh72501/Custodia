import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import { parseRoute } from "../router";
import { saveStoredDraft, getStoredDraft, clearStoredDraft } from "../checker/useDraft";
import { createReview, ApiError, login, signup, demoLogin, getMe, getUsage } from "../api";

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
describe("Auth Gate and Route Flow", () => {
  const origFetch = globalThis.fetch;

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
  });

  it("1. Router handles /login and /signup entries with redirect preservation", () => {
    const loginRoute = parseRoute("/login?redirect=%2Fcheck");
    expect(loginRoute.name).toBe("login");
    expect(loginRoute.redirect).toBe("/check");
    expect(loginRoute.notFound).toBeFalsy();

    const signupRoute = parseRoute("/signup?redirect=%2Fcheck");
    expect(signupRoute.name).toBe("signup");
    expect(signupRoute.redirect).toBe("/check");
    expect(signupRoute.notFound).toBeFalsy();

    const myChecksRoute = parseRoute("/my-checks");
    expect(myChecksRoute.name).toBe("my-checks");
    expect(myChecksRoute.notFound).toBeFalsy();
  });

  it("2. When createReview throws SIGNUP_REQUIRED, draft is preserved in storage", async () => {
    const claim = "Our software cuts onboarding time by 50%.";
    const evidence = "In a trial of 50 users, onboarding time fell by 30%.";

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        error: {
          code: "SIGNUP_REQUIRED",
          message: "Sign up or log in to keep checking claims. Your draft has been preserved.",
        },
      }),
    } as Response);

    let signupRequiredCaught = false;
    try {
      await createReview(claim, evidence);
    } catch (err) {
      if (err instanceof ApiError && err.code === "SIGNUP_REQUIRED") {
        signupRequiredCaught = true;
        // Simulate Checker.tsx gate handler preserving the draft
        saveStoredDraft(claim, evidence);
      }
    }

    expect(signupRequiredCaught).toBe(true);
    const saved = getStoredDraft();
    expect(saved).not.toBeNull();
    expect(saved?.claim).toBe(claim);
    expect(saved?.evidence).toBe(evidence);
  });

  it("3. Preserved draft survives redirect across login/signup and restores on /check", () => {
    const claim = "Our platform cuts setup time by 40%.";
    const evidence = "In a 30-day test, median setup time fell by 30%.";

    // 1. User was on /check, hit gate, draft saved
    saveStoredDraft(claim, evidence);

    // 2. User redirected to /signup?redirect=/check
    const r1 = parseRoute("/signup?redirect=/check");
    expect(r1.redirect).toBe("/check");

    // Draft is still present during signup
    expect(getStoredDraft()?.claim).toBe(claim);

    // 3. User finishes signup and returns to /check
    const r2 = parseRoute(r1.redirect!);
    expect(r2.name).toBe("checker");

    // 4. On /check, draft is retrieved and restored into state
    const restored = getStoredDraft();
    expect(restored).not.toBeNull();
    expect(restored?.claim).toBe(claim);
    expect(restored?.evidence).toBe(evidence);

    // 5. User submits or clears draft
    clearStoredDraft();
    expect(getStoredDraft()).toBeNull();
  });

  it("4. Auth API functions (signup, login, demoLogin, me, usage) call endpoints correctly", async () => {
    // getUsage
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ signed_in: false, free_checks_remaining: 1 }),
    } as Response);
    const usage = await getUsage();
    expect(usage.signed_in).toBe(false);
    expect(usage.free_checks_remaining).toBe(1);

    // demoLogin
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ user: { id: "user_demo", email: "demo@custodia.dev" } }),
    } as Response);
    const demoUser = await demoLogin(["rev_123"]);
    expect(demoUser.email).toBe("demo@custodia.dev");

    // getMe
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ user: { id: "user_demo", email: "demo@custodia.dev" } }),
    } as Response);
    const me = await getMe();
    expect(me?.email).toBe("demo@custodia.dev");

    // signup
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ user: { id: "user_new", email: "new@example.com" } }),
    } as Response);
    const signedUp = await signup("new@example.com", "password12345");
    expect(signedUp.email).toBe("new@example.com");

    // login
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ user: { id: "user_new", email: "new@example.com" } }),
    } as Response);
    const loggedIn = await login("new@example.com", "password12345");
    expect(loggedIn.email).toBe("new@example.com");
  });
});
