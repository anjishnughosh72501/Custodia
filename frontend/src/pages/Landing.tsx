import { Link } from "../router";
import { prefetchChecker } from "../Shell";

interface LandingProps {
  notFound?: boolean;
}

export default function Landing({ notFound }: LandingProps) {
  return (
    <div className="shell landing-page">
      {notFound && (
        <div className="banner warn" role="alert" style={{ marginTop: 24 }}>
          <div>
            <b>Page not found.</b> The page you requested does not exist. We’ve brought you to the ClaimFit home page.
          </div>
        </div>
      )}
      <section className="hero-section">
        <div className="hero-copy">
          <div className="eyebrow-pill">Claim checker</div>
          <h1>Catch claims that outgrow their evidence before you publish.</h1>
          <p className="hero-sub">
            Paste a marketing claim and the evidence behind it. ClaimFit compares seven dimensions, shows the exact words each finding rests on, and sends anything unclear to a person.
          </p>
          <div className="hero-actions">
            <Link href="/check" className="btn primary" prefetch={prefetchChecker}>
              Check a claim
            </Link>
            <Link href="/check?example=critical" className="btn secondary">
              See a live example
            </Link>
          </div>
          <p className="hero-disclaimer">Checks your supplied evidence only. It cannot tell you a claim is true.</p>
        </div>
      </section>
    </div>
  );
}
