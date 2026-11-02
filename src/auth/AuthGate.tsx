import { useState, type FormEvent } from "react";
import { useAuth } from "./AuthContext";
import { ApiError } from "../api";

interface AuthGateProps {
  isOpen: boolean;
  onClose?: () => void;
  onSuccess: () => void;
  initialMode?: "signup" | "login";
}

export function AuthGate({ isOpen, onClose, onSuccess, initialMode = "signup" }: AuthGateProps) {
  const { login, signup, demoLogin } = useAuth();
  const [mode, setMode] = useState<"signup" | "login">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "signup") {
        await signup(email, password);
      } else {
        await login(email, password);
      }
      onSuccess();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDemoBypass = async () => {
    setError(null);
    setLoading(true);
    try {
      await demoLogin();
      onSuccess();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not sign in with demo account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="modal-backdrop auth-gate-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(20, 33, 61, 0.65)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "16px",
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-gate-title"
    >
      <div
        className="panel auth-gate-panel"
        style={{
          width: "100%",
          maxWidth: "440px",
          backgroundColor: "var(--card-bg, #fff)",
          borderRadius: "12px",
          boxShadow: "0 12px 36px rgba(0, 0, 0, 0.2)",
          padding: "28px 24px",
          position: "relative",
        }}
      >
        {onClose && (
          <button
            type="button"
            className="auth-gate-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
            style={{
              position: "absolute",
              top: "16px",
              right: "16px",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px",
              color: "var(--ink-muted, #666)",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}

        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "44px",
              height: "44px",
              borderRadius: "12px",
              backgroundColor: "rgba(47, 127, 121, 0.12)",
              color: "var(--teal, #2F7F79)",
              marginBottom: "12px",
            }}
            aria-hidden="true"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h2 id="auth-gate-title" style={{ fontFamily: "var(--font-serif, Fraunces, Georgia, serif)", fontSize: "1.45rem", margin: "0 0 6px 0", color: "var(--ink, #14213D)" }}>
            {mode === "signup" ? "Create your free account" : "Welcome back"}
          </h2>
          <p style={{ margin: 0, fontSize: "0.95rem", color: "var(--ink-muted, #555)", lineHeight: 1.5 }}>
            You've used your 1 free claim check. Sign up or log in to keep checking claims. Your draft has been saved.
          </p>
        </div>

        {/* Tab switcher */}
        <div
          role="tablist"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "4px",
            backgroundColor: "var(--bg-muted, #f4efe6)",
            padding: "4px",
            borderRadius: "8px",
            marginBottom: "20px",
          }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "signup"}
            onClick={() => { setMode("signup"); setError(null); }}
            style={{
              padding: "8px 12px",
              fontSize: "0.9rem",
              fontWeight: 600,
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              backgroundColor: mode === "signup" ? "#fff" : "transparent",
              color: mode === "signup" ? "var(--ink, #14213D)" : "var(--ink-muted, #666)",
              boxShadow: mode === "signup" ? "0 1px 3px rgba(0, 0, 0, 0.1)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            Sign up
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "login"}
            onClick={() => { setMode("login"); setError(null); }}
            style={{
              padding: "8px 12px",
              fontSize: "0.9rem",
              fontWeight: 600,
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              backgroundColor: mode === "login" ? "#fff" : "transparent",
              color: mode === "login" ? "var(--ink, #14213D)" : "var(--ink-muted, #666)",
              boxShadow: mode === "login" ? "0 1px 3px rgba(0, 0, 0, 0.1)" : "none",
              transition: "all 0.15s ease",
            }}
          >
            Log in
          </button>
        </div>

        {error && (
          <div
            className="banner bad"
            role="alert"
            aria-live="polite"
            style={{ marginBottom: "16px", padding: "10px 12px", fontSize: "0.9rem" }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div style={{ marginBottom: "14px" }}>
            <label
              htmlFor="auth-email-input"
              style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: "6px", color: "var(--ink, #14213D)" }}
            >
              Email address
            </label>
            <input
              id="auth-email-input"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "6px",
                border: "1px solid var(--border, #E5E0D8)",
                fontSize: "0.95rem",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <label
                htmlFor="auth-password-input"
                style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--ink, #14213D)" }}
              >
                Password
              </label>
              {mode === "signup" && (
                <span style={{ fontSize: "0.75rem", color: "var(--ink-muted, #777)" }}>
                  Min 10 characters
                </span>
              )}
            </div>
            <div style={{ position: "relative" }}>
              <input
                id="auth-password-input"
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
                style={{
                  width: "100%",
                  padding: "10px 40px 10px 12px",
                  borderRadius: "6px",
                  border: "1px solid var(--border, #E5E0D8)",
                  fontSize: "0.95rem",
                  boxSizing: "border-box",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                style={{
                  position: "absolute",
                  right: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--ink-muted, #777)",
                  padding: "4px",
                }}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn primary"
            disabled={loading}
            style={{ width: "100%", padding: "11px", fontWeight: 650, fontSize: "0.95rem", marginBottom: "12px" }}
          >
            {loading ? "Please wait…" : mode === "signup" ? "Create account & check claim" : "Log in & check claim"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: "12px", borderTop: "1px solid var(--border, #E5E0D8)", paddingTop: "14px" }}>
          <button
            type="button"
            className="btn small subtle demo-bypass-btn"
            onClick={handleDemoBypass}
            disabled={loading}
            style={{ fontSize: "0.85rem", color: "var(--teal, #2F7F79)" }}
          >
            ⚡ Test Mode: Skip with demo account
          </button>
        </div>
      </div>
    </div>
  );
}
