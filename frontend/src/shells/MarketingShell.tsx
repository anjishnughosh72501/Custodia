import React, { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, navigate } from "../router";
import { getHealth } from "../api";
import type { Health } from "../types";
import { initScrollProgressBar } from "../motion/anime";

export const prefetchChecker = () => {
  import("../pages/Checker");
};

export const prefetchExamples = () => {
  import("../pages/Examples");
};

interface MarketingShellProps {
  children: ReactNode;
  notFound?: boolean;
}

export function MarketingShell({ children, notFound }: MarketingShellProps) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [health, setHealth] = useState<Health | null>(null);
  const [healthErr, setHealthErr] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return initScrollProgressBar(progressBarRef.current);
  }, []);

  useEffect(() => {
    getHealth().then(setHealth).catch(() => setHealthErr(true));
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 8);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && menuOpen) {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, hash: string) => {
    e.preventDefault();
    setMenuOpen(false);
    if (hash === "product" || hash === "") {
      if (window.location.pathname === "/" || window.location.pathname === "") {
        window.scrollTo({ top: 0, behavior: "smooth" });
        window.history.pushState(null, "", "/");
        return;
      }
      navigate("/");
      return;
    }
    const el = document.getElementById(hash);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
      window.history.pushState(null, "", `#${hash}`);
      return;
    }
    navigate(`/#${hash}`);
  };

  const mode = health ? (health.llm_configured ? "llm" : "rules") : "";

  return (
    <div className="marketing-shell">
      <nav
        className={`marketing-nav shell-nav ${scrolled ? "condensed" : ""}`}
        aria-label="Main navigation"
      >
        <div className="shell-nav-inner">
          <Link href="/" className="shell-brand" aria-label="Custodia Home">
            <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
              <rect width="32" height="32" rx="8" fill="#14213D" />
              <path d="M8 16h6m4 0h6" stroke="#FBF8F1" strokeWidth="2.4" strokeLinecap="round" />
              <circle cx="16" cy="16" r="3.2" fill="#2F7F79" />
            </svg>
            <span className="brand-name">Custodia</span>
          </Link>

          <div className="shell-nav-links desktop-only">
            <a
              href="#product"
              onClick={(e) => handleNavClick(e, "product")}
              className={typeof window !== "undefined" && window.location.pathname === "/" && (!window.location.hash || window.location.hash === "#product") ? "active" : ""}
            >
              Product
            </a>
            <a
              href="#dimensions"
              onClick={(e) => handleNavClick(e, "dimensions")}
              className={typeof window !== "undefined" && window.location.hash === "#dimensions" ? "active" : ""}
            >
              7 Dimensions
            </a>
            <Link
              href="/examples"
              prefetch={prefetchExamples}
              className={typeof window !== "undefined" && window.location.pathname === "/examples" ? "active" : ""}
            >
              Examples
            </Link>
            <a
              href="#limits"
              onClick={(e) => handleNavClick(e, "limits")}
              className={typeof window !== "undefined" && window.location.hash === "#limits" ? "active" : ""}
            >
              Limits
            </a>
            <a
              href="#faq"
              onClick={(e) => handleNavClick(e, "faq")}
              className={typeof window !== "undefined" && window.location.hash === "#faq" ? "active" : ""}
            >
              FAQ
            </a>
          </div>

          <div className="shell-nav-actions desktop-only">
            <Link
              href="/check"
              className="btn primary small nav-cta"
              prefetch={prefetchChecker}
            >
              Check a claim
            </Link>
          </div>

          <button
            ref={menuButtonRef}
            className="mobile-nav-toggle mobile-only"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav-menu"
            aria-label="Toggle navigation menu"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" strokeWidth="2" fill="none" aria-hidden="true">
              {menuOpen ? (
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" strokeLinejoin="round" />
              )}
            </svg>
          </button>
        </div>

        {menuOpen && (
          <div id="mobile-nav-menu" className="mobile-nav-drawer mobile-only">
            <div className="mobile-nav-items">
              <a
                href="#product"
                onClick={(e) => handleNavClick(e, "product")}
                className={typeof window !== "undefined" && window.location.pathname === "/" && (!window.location.hash || window.location.hash === "#product") ? "active" : ""}
              >
                Product
              </a>
              <a
                href="#dimensions"
                onClick={(e) => handleNavClick(e, "dimensions")}
                className={typeof window !== "undefined" && window.location.hash === "#dimensions" ? "active" : ""}
              >
                7 Dimensions
              </a>
              <Link
                href="/examples"
                onClick={() => setMenuOpen(false)}
                prefetch={prefetchExamples}
                className={typeof window !== "undefined" && window.location.pathname === "/examples" ? "active" : ""}
              >
                Examples
              </Link>
              <a
                href="#limits"
                onClick={(e) => handleNavClick(e, "limits")}
                className={typeof window !== "undefined" && window.location.hash === "#limits" ? "active" : ""}
              >
                Limits
              </a>
              <a
                href="#faq"
                onClick={(e) => handleNavClick(e, "faq")}
                className={typeof window !== "undefined" && window.location.hash === "#faq" ? "active" : ""}
              >
                FAQ
              </a>
              <Link
                href="/check"
                className="btn primary mobile-cta"
                onClick={() => setMenuOpen(false)}
                prefetch={prefetchChecker}
              >
                Check a claim
              </Link>
            </div>
          </div>
        )}
        <div ref={progressBarRef} className="scroll-progress-bar" id="scroll-progress" aria-hidden="true" />
      </nav>

      {notFound && (
        <div className="shell" style={{ paddingTop: 16 }}>
          <div className="banner warn" role="alert">
            <div>
              <b>Page not found.</b> The URL you followed does not exist. We brought you back to the home page.
            </div>
          </div>
        </div>
      )}

      <main id="main-content" className="landing-main">
        {children}
      </main>

      <footer className="landing-footer">
        <div className="footer-container">
          <div className="footer-top">
            <div className="footer-brand-col">
              <div className="brand">
                <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
                  <rect width="32" height="32" rx="8" fill="#14213D" />
                  <path d="M8 16h6m4 0h6" stroke="#FBF8F1" strokeWidth="2.4" strokeLinecap="round" />
                  <circle cx="16" cy="16" r="3.2" fill="#2F7F79" />
                </svg>
                <span className="brand-name">Custodia</span>
              </div>
              <p className="footer-tagline">
                Deterministic claim verification for marketing and compliance.
              </p>
              <div className={`mode ${mode} footer-mode`} role="status" aria-live="polite">
                <i aria-hidden="true" />
                {healthErr ? (
                  <span>Server status unavailable</span>
                ) : !health ? (
                  <span>Checking server…</span>
                ) : health.llm_configured ? (
                  <span>
                    Model-assisted <small>· deterministic checks decide</small>
                  </span>
                ) : (
                  <span>
                    Rule-based mode <small>· no model configured</small>
                  </span>
                )}
              </div>
            </div>

            <div className="footer-links-grid">
              <div className="footer-col">
                <h4>Product</h4>
                <ul>
                  <li>
                    <Link href="/check" prefetch={prefetchChecker}>
                      Check a claim
                    </Link>
                  </li>
                  <li>
                    <Link href="/examples" prefetch={prefetchExamples}>
                      Examples library
                    </Link>
                  </li>
                  <li>
                    <a href="#what-it-catches" onClick={(e) => handleNavClick(e, "what-it-catches")}>
                      What it catches
                    </a>
                  </li>
                  <li>
                    <a href="#limits" onClick={(e) => handleNavClick(e, "limits")}>
                      Limits
                    </a>
                  </li>
                </ul>
              </div>

              <div className="footer-col">
                <h4>Project</h4>
                <ul>
                  <li>
                    <a href="https://github.com/anjishnughosh72501/Custodia" target="_blank" rel="noopener noreferrer">
                      GitHub repository
                    </a>
                  </li>
                  <li>
                    <a href="https://github.com/anjishnughosh72501/Custodia#readme" target="_blank" rel="noopener noreferrer">
                      README
                    </a>
                  </li>
                </ul>
              </div>

              <div className="footer-col">
                <h4>Team</h4>
                <ul>
                  <li>Aryan · Engineering & UI</li>
                  <li>Anjishnu · Rules & Pipeline</li>
                  <li>Ananya · QA & Evaluation</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="footer-bottom">
            <p style={{ marginBottom: "8px", fontWeight: 500 }}>
              Built for the hackathon by &lt;TEAM_NAMES&gt;. Contact: <a href="mailto:<CONTACT_EMAIL>">&lt;CONTACT_EMAIL&gt;</a>
            </p>
            <p>
              Custodia is a rule-based checker with optional model assistance. It does not browse, fetch sources or judge
              whether the evidence itself is reliable, and it supports English text only. Example scenarios are illustrative
              and are not a benchmark. No accuracy figure is claimed.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
