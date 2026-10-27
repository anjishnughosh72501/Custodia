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
  return (
    <div className="landing-page-root">
      <div className="shell landing-shell">
        {notFound && (
          <div className="banner warn" role="alert" style={{ marginTop: 24, marginBottom: 12 }}>
            <div>
              <b>Page not found.</b> The URL you visited does not exist. We’ve brought you to the ClaimFit home page.
            </div>
          </div>
        )}

        {/* 5.1 & 5.2 Hero and interactive demo card */}
        <Hero />

        {/* 5.3 Claim shapes ticker */}
        <TickerRow />

        {/* 5.4 Not a vibe check trust row */}
        <TrustRow />

        {/* 5.5 How it works */}
        <HowItWorks />

        {/* 5.6 What it catches */}
        <Catches />

        {/* 5.7 Seven dimensions explorer */}
        <Dimensions />

        {/* 5.8 Try a scenario */}
        <Scenarios />

        {/* 5.9 Benchmark band (only renders if data exists) */}
        <BenchmarkBand />

        {/* 5.10 Limits */}
        <Limits />

        {/* 5.11 FAQ */}
        <Faq />
      </div>

      {/* 5.12 Closing call to action (full width) */}
      <CtaBand />
    </div>
  );
}
