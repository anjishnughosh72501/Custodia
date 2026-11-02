import { useState, type FormEvent } from "react";
import { Link, navigate } from "../router";
import { MarketingShell } from "../shells/MarketingShell";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../api";

interface LoginProps {
  redirect?: string;
}

export default function Login({ redirect = "/check" }: LoginProps) {
  const { login, demoLogin } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
      navigate(redirect);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Could not log in. Please check your credentials and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await demoLogin();
      navigate(redirect);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not sign in with demo account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <MarketingShell>
      <div className="shell auth-page-shell" style={{ maxWidth: "460px", margin: "48px auto 80px", padding: "0 16px" }}>
        <div className="panel auth-card" style={{ padding: "36px 32px" }}>
          <header style={{ textAlign: "center", marginBottom: "28px" }}>
            <h1 style={{ fontFamily: "var(--font-serif, Fraunces, Georgia, serif)", fontSize: "1.8rem", margin: "0 0 8px 0" }}>
              Log in to Custodia
            </h1>
            <p style={{ color: "var(--ink-muted, #555)", fontSize: "0.95rem", margin: 0 }}>
              Verify marketing claims against evidence with deterministic checks.
            </p>
          </header>

          {error && (
            <div className="banner bad" role="alert" aria-live="polite" style={{ marginBottom: "20px" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div style={{ marginBottom: "16px" }}>
              <label htmlFor="login-email" style={{ display: "block", fontSize: "0.88rem", fontWeight: 650, marginBottom: "6px" }}>
                Email address
              </label>
              <input
                id="login-email"
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

            <div style={{ marginBottom: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <label htmlFor="login-password" style={{ fontSize: "0.88rem", fontWeight: 650 }}>
                  Password
                </label>
              </div>
              <div style={{ position: "relative" }}>
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
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
                      <path d="M1 backward" />
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
              style={{ width: "100%", padding: "12px", fontWeight: 650, fontSize: "1rem" }}
            >
              {loading ? "Signing in…" : "Log in"}
            </button>
          </form>

          <div style={{ textAlign: "center", marginTop: "20px" }}>
            <p style={{ fontSize: "0.9rem", color: "var(--ink-muted, #666)", margin: "0 0 12px 0" }}>
              Don't have an account?{" "}
              <Link href={`/signup${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ""}`} style={{ color: "var(--teal, #2F7F79)", fontWeight: 600 }}>
                Sign up
              </Link>
            </p>

            <div style={{ borderTop: "1px solid var(--border, #E5E0D8)", paddingTop: "16px" }}>
              <button
                type="button"
                className="btn small subtle demo-bypass-btn"
                onClick={handleDemoLogin}
                disabled={loading}
                style={{ color: "var(--teal, #2F7F79)" }}
              >
                ⚡ Test Mode: 1-click Demo Login
              </button>
            </div>
          </div>
        </div>
      </div>
    </MarketingShell>
  );
}
