import { useEffect } from "react";
import { MarketingShell } from "../shells/MarketingShell";
import { Hero } from "../landing/Hero";
import { TickerRow } from "../landing/TickerRow";
import { TrustRow } from "../landing/TrustRow";
import { HowItWorks } from "../landing/HowItWorks";
import { Catches } from "../landing/Catches";
import { Dimensions } from "../landing/Dimensions";
import { Scenarios } from "../landing/Scenarios";
import { BenchmarkBand } from "../landing/BenchmarkBand";
import { Limits } from "../landing/Limits";
import { Faq } from "../landing/Faq";
import { CtaBand } from "../landing/CtaBand";

interface LandingProps {
  notFound?: boolean;
}

export default function Landing({ notFound }: LandingProps) {
  useEffect(() => {
    const scrollToHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash) {
        setTimeout(() => {
          const el = document.getElementById(hash);
          if (el) {
            el.scrollIntoView({ behavior: "smooth" });
          }
        }, 60);
      }
    };
    scrollToHash();
    window.addEventListener("hashchange", scrollToHash);
    return () => window.removeEventListener("hashchange", scrollToHash);
  }, []);

  return (
    <MarketingShell notFound={notFound}>
      <div className="landing-page-root">
        {/* Full-viewport Hero */}
        <Hero />

        {/* Claim shapes ticker sits directly below the hero */}
        <div className="shell landing-shell">
          <TickerRow />
          <TrustRow />
          <HowItWorks />
          <Catches />
          <Dimensions />
          <Scenarios />
          <BenchmarkBand />
          <Limits />
          <Faq />
        </div>

        {/* Full-width call to action closing band */}
        <CtaBand />
      </div>
    </MarketingShell>
  );
}
