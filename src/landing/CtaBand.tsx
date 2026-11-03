import { Link } from "../router";
import { prefetchChecker } from "../shells/MarketingShell";
import { Magnet } from "../vendor/reactbits/Magnet";
import { LANDING_COPY } from "./copy";

export function CtaBand() {
  return (
    <section className="cta-band" aria-label="Call to action">
      <div className="cta-band-inner">
        <img src="/logo.png" alt="Custodia Logo" style={{ width: "52px", height: "52px", objectFit: "contain", margin: "0 auto 16px", display: "block" }} />
        <h2 className="cta-headline">{LANDING_COPY.ctaBand.headline}</h2>
        <p className="cta-sub">{LANDING_COPY.ctaBand.sub}</p>
        <div className="cta-actions">
          <Magnet padding={25} strength={0.25}>
            <Link href="/check" className="btn cta-btn-dark" prefetch={prefetchChecker}>
              {LANDING_COPY.ctaBand.button} →
            </Link>
          </Magnet>
        </div>
      </div>
    </section>
  );
}
