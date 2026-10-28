import { useEffect, useRef, useState } from "react";
import { Link } from "../router";
import { getHealth } from "../api";
import type { Health } from "../types";
import { prefetchChecker, prefetchExamples } from "../shells/MarketingShell";
import { Magnet } from "../vendor/reactbits/Magnet";
import { ShinyText } from "../vendor/reactbits/ShinyText";
import { initHeroParallax } from "../motion/anime";
import { HeroDemo } from "./HeroDemo";
import { LANDING_COPY } from "./copy";

export function Hero() {
  const [health, setHealth] = useState<Health | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const heroSectionRef = useRef<HTMLElement>(null);
  const demoVisualRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return initHeroParallax(heroSectionRef.current, demoVisualRef.current);
  }, []);

  useEffect(() => {
    let cancelled = false;

    getHealth()
      .then((h) => {
        if (!cancelled) setHealth(h);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setHealthLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section ref={heroSectionRef} className="hero-section hero-full-viewport" aria-label="Introduction">
      <div className="hero-grid">
        <div className="hero-copy">
          <div className="hero-eyebrow-container">
            <div className="sticker hero-eyebrow" role="status">
              {healthLoading || !health ? (
                <span>Claim checker</span>
              ) : health.llm_configured ? (
                <span>
                  <i className="status-dot green" aria-hidden="true" />
                  Model-assisted · deterministic checks decide
                </span>
              ) : (
                <span>
                  <i className="status-dot amber" aria-hidden="true" />
                  Rule-based mode
                </span>
              )}
            </div>
          </div>

          <h1 className="hero-h1">
            <ShinyText text={LANDING_COPY.hero.headline} speed={5} />
          </h1>

          <p className="hero-sub">{LANDING_COPY.hero.sub}</p>

          <div className="hero-actions">
            <Magnet padding={30} strength={0.2}>
              <Link href="/check" className="btn primary hero-primary-btn" prefetch={prefetchChecker}>
                {LANDING_COPY.hero.ctaPrimary}
              </Link>
            </Magnet>
            <Link href="/examples" className="btn hero-secondary-btn" prefetch={prefetchExamples}>
              {LANDING_COPY.hero.ctaSecondary}
            </Link>
          </div>

          <div className="hero-facts-strip">
            <span className="fact-item">Seven dimensions</span>
            <span className="fact-bullet" aria-hidden="true">·</span>
            <span className="fact-item">Every finding quotes your text</span>
            <span className="fact-bullet" aria-hidden="true">·</span>
            <span className="fact-item">Unclear goes to a person</span>
          </div>

          <p className="hero-disclaimer">{LANDING_COPY.hero.quietNote}</p>
        </div>

        <div ref={demoVisualRef} className="hero-visual" id="hero-demo-visual">
          <HeroDemo />
        </div>
      </div>

      <div className="hero-scroll-cue" aria-hidden="true">
        <span className="scroll-cue-text">Scroll</span>
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" className="scroll-arrow">
          <path d="M3 6l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </section>
  );
}
