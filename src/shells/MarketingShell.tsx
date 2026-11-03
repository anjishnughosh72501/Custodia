import React, { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, navigate, useRoute } from "../router";
import { getHealth } from "../api";
import type { Health } from "../types";
import { isReducedMotion } from "../motion/anime";
import { UserMenu } from "../auth/UserMenu";

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
  const route = useRoute();
  const isHomePage = route.name === "landing";
  const isExamplesRoute = route.name === "examples";

  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(isHomePage ? "product" : null);
  const [health, setHealth] = useState<Health | null>(null);
  const [healthErr, setHealthErr] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

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

  // Section observer & scroll position syncing for in-page navigation on the landing page
  useEffect(() => {
    if (!isHomePage) {
      setActiveSection(null);
      return;
    }

    const sectionIds = ["product", "dimensions", "limits", "faq"];
    let rafId: number | null = null;

    const computeActiveSection = () => {
      const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = window.innerHeight;

      // 1. If at the top of the page, Product is always active
      if (scrollY < 120) {
        setActiveSection("product");
        return;
      }

      // 2. If scrolled near the bottom, activate the lowest section (FAQ)
      if (scrollY + clientHeight >= scrollHeight - 60) {
        setActiveSection("faq");
        return;
      }

      // 3. Find the current section passed below the sticky header offset
      const headerOffset = 90;
      let current = "product";
      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (el) {
          const top = el.getBoundingClientRect().top;
          if (top <= headerOffset) {
            current = id;
          }
        }
      }
      setActiveSection(current);
    };

    const onScrollOrResize = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        computeActiveSection();
        rafId = null;
      });
    };

    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    window.addEventListener("resize", onScrollOrResize, { passive: true });
    computeActiveSection();

    return () => {
      window.removeEventListener("scroll", onScrollOrResize);
      window.removeEventListener("resize", onScrollOrResize);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [isHomePage, route.path]);

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

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, sectionId: string) => {
    e.preventDefault();
    setMenuOpen(false);

    if (isHomePage) {
      if (sectionId === "product") {
        window.scrollTo({ top: 0, behavior: isReducedMotion() ? "auto" : "smooth" });
        window.history.pushState(null, "", "/");
        setActiveSection("product");
        return;
      }
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: isReducedMotion() ? "auto" : "smooth" });
        window.history.pushState(null, "", `#${sectionId}`);
        setActiveSection(sectionId);
        return;
      }
    }

    if (sectionId === "product") {
      navigate("/");
    } else {
      navigate(`/#${sectionId}`);
    }
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
            <img src="/logo.png" alt="Custodia Logo" className="brand-mark" style={{ width: "34px", height: "34px", objectFit: "contain" }} />
            <span className="brand-name">Custodia</span>
          </Link>

          <div className="shell-nav-links desktop-only">
            <a
              href="#product"
              onClick={(e) => handleNavClick(e, "product")}
              className={isHomePage && activeSection === "product" ? "active" : ""}
            >
              Product
            </a>
            <a
              href="#dimensions"
              onClick={(e) => handleNavClick(e, "dimensions")}
              className={isHomePage && activeSection === "dimensions" ? "active" : ""}
            >
              7 Dimensions
            </a>
            <Link
              href="/examples"
              prefetch={prefetchExamples}
              className={isExamplesRoute ? "active" : ""}
            >
              Examples
            </Link>
            <a
              href="#limits"
              onClick={(e) => handleNavClick(e, "limits")}
              className={isHomePage && activeSection === "limits" ? "active" : ""}
            >
              Limits
            </a>
            <a
              href="#faq"
              onClick={(e) => handleNavClick(e, "faq")}
              className={isHomePage && activeSection === "faq" ? "active" : ""}
            >
              FAQ
            </a>
          </div>

          <div className="shell-nav-actions desktop-only" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <UserMenu />
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
                className={isHomePage && activeSection === "product" ? "active" : ""}
              >
                Product
              </a>
              <a
                href="#dimensions"
                onClick={(e) => handleNavClick(e, "dimensions")}
                className={isHomePage && activeSection === "dimensions" ? "active" : ""}
              >
                7 Dimensions
              </a>
              <Link
                href="/examples"
                onClick={() => setMenuOpen(false)}
                prefetch={prefetchExamples}
                className={isExamplesRoute ? "active" : ""}
              >
                Examples
              </Link>
              <a
                href="#limits"
                onClick={(e) => handleNavClick(e, "limits")}
                className={isHomePage && activeSection === "limits" ? "active" : ""}
              >
                Limits
              </a>
              <a
                href="#faq"
                onClick={(e) => handleNavClick(e, "faq")}
                className={isHomePage && activeSection === "faq" ? "active" : ""}
              >
                FAQ
              </a>
              <div style={{ padding: "8px 0" }}>
                <UserMenu />
              </div>
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
                <img src="/logo.png" alt="Custodia Logo" className="brand-mark" style={{ width: "34px", height: "34px", objectFit: "contain" }} />
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
                  <li>
                    <a href="https://github.com/anjishnughosh72501/Custodia" target="_blank" rel="noopener noreferrer">
                      Aryan · Engineering & UI
                    </a>
                  </li>
                  <li>
                    <a href="https://github.com/anjishnughosh72501" target="_blank" rel="noopener noreferrer">
                      Anjishnu · Rules & Pipeline
                    </a>
                  </li>
                  <li>
                    <a href="https://github.com/anjishnughosh72501/Custodia" target="_blank" rel="noopener noreferrer">
                      Ananya · QA & Evaluation
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="footer-bottom">
            <p className="footer-bottom-meta">
              Built for the hackathon by Aryan, Anjishnu, and Ananya. Contact:{" "}
              <a href="mailto:contact@custodia.dev">contact@custodia.dev</a>{" "}
              ·{" "}
              <a href="https://github.com/anjishnughosh72501/Custodia/issues" target="_blank" rel="noopener noreferrer">
                GitHub Issues
              </a>
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
