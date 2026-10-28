import { useEffect, useState, type ReactNode } from "react";
import { Link } from "../router";
import { getHealth } from "../api";
import type { Health } from "../types";

interface AppShellProps {
  children: ReactNode;
  onNewCheck?: () => void;
  onOpenRecent?: () => void;
  onOpenPalette?: () => void;
}

export function AppShell({
  children,
  onNewCheck,
  onOpenRecent,
  onOpenPalette,
}: AppShellProps) {
  const [health, setHealth] = useState<Health | null>(null);
  const [healthErr, setHealthErr] = useState(false);

  useEffect(() => {
    getHealth().then(setHealth).catch(() => setHealthErr(true));
  }, []);

  const mode = health ? (health.llm_configured ? "llm" : "rules") : "";

  return (
    <div className="checker-shell-layout">
      <header className="app-bar" aria-label="Application header">
        <div className="app-bar-inner">
          <div className="app-bar-left">
            <Link href="/" className="app-bar-brand" aria-label="Custodia Home">
              <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
                <rect width="32" height="32" rx="8" fill="#14213D" />
                <path d="M8 16h6m4 0h6" stroke="#FBF8F1" strokeWidth="2.4" strokeLinecap="round" />
                <circle cx="16" cy="16" r="3.2" fill="#2F7F79" />
              </svg>
              <span className="brand-name">Custodia</span>
            </Link>
            <Link href="/" className="app-bar-navlink">
              Home
            </Link>
            <Link href="/examples" className="app-bar-navlink">
              Examples
            </Link>
            <a
              href="https://github.com/anjishnughosh72501/Custodia"
              target="_blank"
              rel="noopener noreferrer"
              className="app-bar-navlink"
              aria-label="GitHub repository (opens in new tab)"
            >
              GitHub
            </a>
          </div>

          <div className="app-bar-actions">
            {onNewCheck ? (
              <button
                type="button"
                className="btn small"
                onClick={onNewCheck}
                aria-label="Start a new check"
              >
                New check
              </button>
            ) : (
              <Link href="/check" className="btn small" aria-label="Start a new check">
                New check
              </Link>
            )}

            {onOpenRecent && (
              <button
                type="button"
                className="btn small"
                onClick={onOpenRecent}
                aria-label="Open recent checks"
              >
                Recent
              </button>
            )}

            {onOpenPalette && (
              <button
                type="button"
                className="btn small palette-trigger-btn"
                onClick={onOpenPalette}
                aria-label="Open command palette (Ctrl+K or Command+K)"
              >
                <span>⌘K</span>
              </button>
            )}

            <div
              className={`mode ${mode} app-bar-mode`}
              role="status"
              aria-live="polite"
              title={
                health?.llm_configured
                  ? "Model-assisted · deterministic checks decide"
                  : "Rule-based mode · no model configured"
              }
            >
              <i aria-hidden="true" />
              {healthErr ? (
                <span>Unavailable</span>
              ) : !health ? (
                <span>Checking…</span>
              ) : health.llm_configured ? (
                <span>Model-assisted</span>
              ) : (
                <span>Rule-based</span>
              )}
            </div>
          </div>
        </div>
      </header>

      <main id="main-content" className="checker-main">
        {children}
      </main>
    </div>
  );
}
