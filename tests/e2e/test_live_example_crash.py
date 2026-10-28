"""Reproduce and verify fixes for live-example crash and checker failure modes.

Failure modes tested:
1. Checker chunk fails to load (e.g. network error / abort on **/assets/Checker-*.js).
   Current code: React unmounts, #root is blank (empty innerHTML or no visible content).
   Fixed code: ErrorBoundary catches it, shell remains, friendly error panel with "Reload page" and "Back to home".

2. Saved review with a different shape (e.g. 200 OK on **/api/reviews/demo-critical missing language_risks, warnings, etc.).
   Current code: TypeError during render, React unmounts, #root is blank.
   Fixed code: normalizeReview fills safe defaults or shows clear in-page message, no blank page.

3. Happy path:
   Normal navigation from landing "See a live example" loads cleanly without crash.
"""

import json
import os
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE_URL = os.getenv("CUSTODIA_URL", os.getenv("SCOPELOCK_URL", "http://127.0.0.1:8000/"))
if not BASE_URL.endswith("/"):
    BASE_URL += "/"

R: list[tuple[str, bool]] = []


def check(name: str, cond: bool, extra: str = ""):
    R.append((name, bool(cond)))
    status = "PASS" if cond else "FAIL"
    print(f"{status} {name}" + (f"  [{extra}]" if extra and not cond else ""), flush=True)


def main() -> int:
    with sync_playwright() as p:
        b = p.chromium.launch()

        # -------------------------------------------------------------
        # Test 1: Happy path
        # -------------------------------------------------------------
        pg = b.new_context(viewport={"width": 1280, "height": 900}).new_page()
        pg.goto(BASE_URL)
        pg.wait_for_selector(".hero-h1")
        pg.click("text=See a live example")
        pg.wait_for_timeout(1000)

        root_html = pg.inner_html("#root").strip()
        check("happy path: #root is not empty", len(root_html) > 0)
        has_content = pg.locator(".verdict, #workspace, .error-boundary-panel").count() > 0
        check("happy path: checker or verdict is displayed", has_content)
        pg.close()

        # -------------------------------------------------------------
        # Test 2: Chunk-load failure reproduces blank root or passes with ErrorBoundary
        # -------------------------------------------------------------
        pg_chunk = b.new_context(viewport={"width": 1280, "height": 900}).new_page()
        pg_chunk.route("**/assets/Checker-*.js", lambda r: r.abort("failed"))
        pg_chunk.goto(BASE_URL)
        pg_chunk.wait_for_selector(".hero-h1")

        pg_chunk.click("text=See a live example")
        pg_chunk.wait_for_timeout(1500)

        # On current unfixed code: #root is completely empty or blank (crashed)
        # On fixed code: error boundary panel is visible, shell/nav stays on screen, #root is not empty
        chunk_root_html = pg_chunk.inner_html("#root").strip()
        has_error_boundary = pg_chunk.locator(".error-boundary-panel, .app-error-boundary").count() > 0
        check("chunk failure: handled by error boundary, not blank root", len(chunk_root_html) > 0 and has_error_boundary)
        pg_chunk.close()

        # -------------------------------------------------------------
        # Test 3: Malformed / partial saved review (missing language_risks etc.)
        # -------------------------------------------------------------
        partial_review = {
            "id": "demo-critical",
            "claim_text": "Our platform cuts setup time by 40% for every business.",
            "evidence_text": "In a 30-day test of 120 small-business customers using Pro, median setup time fell by 30%.",
            "verdict": {
                "status": "NOT_SUPPORTED",
                "needs_human": False,
                "summary": "The claim outgrows the evidence on value and population.",
                "abstain_reasons": [],
                "counts": {},
            },
            "comparisons": [
                {
                    "dimension": "value",
                    "status": "contradicted",
                    "reason_code": "VALUE_MISMATCH",
                    "explanation": "Claim says 40%, evidence says 30%.",
                    "claim_raw": "40%",
                    "evidence_raw": "30%",
                    "claim_span": None,
                    "evidence_span": None,
                    "needs_human": False,
                }
            ],
            # Note: language_risks, warnings, rewrite, extractor_mode etc are intentionally missing!
        }

        pg_partial = b.new_context(viewport={"width": 1280, "height": 900}).new_page()
        pg_partial.route(
            "**/api/reviews/demo-critical",
            lambda r: r.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps(partial_review),
            ),
        )
        pg_partial.goto(BASE_URL + "r/demo-critical")
        pg_partial.wait_for_timeout(1500)

        partial_root_html = pg_partial.inner_html("#root").strip()
        # On current unfixed code: TypeError during render unmounts entire React tree, leaving root blank
        # On fixed code: normalized review renders verdict card without crash or displays safe fallback
        has_rendered = (
            pg_partial.locator(".verdict, .saved-review-error, .error-boundary-panel").count() > 0
        )
        check(
            "partial review: handled gracefully without blanking root",
            len(partial_root_html) > 0 and has_rendered,
        )
        pg_partial.close()

        # -------------------------------------------------------------
        # Test 4: Stale state reset on route change: /r/<id> then Back to /check
        # -------------------------------------------------------------
        pg_nav = b.new_context(viewport={"width": 1280, "height": 900}).new_page()
        # First check a claim to produce a review
        pg_nav.goto(BASE_URL + "check?example=critical")
        pg_nav.wait_for_selector("#workspace")
        pg_nav.click("text=Check claim")
        pg_nav.wait_for_selector(".verdict")
        check("nav test: initial check executed and verdict rendered", pg_nav.locator(".verdict").count() > 0)

        # Now click New check or navigate back to /check
        pg_nav.click("text=New check")
        pg_nav.wait_for_timeout(300)
        # Should reset verdict and display empty workspace / recent checks
        check("nav test: navigating to /check clears previous verdict", pg_nav.locator(".verdict").count() == 0)
        pg_nav.close()

        b.close()

    print(f"\n{sum(ok for _, ok in R)}/{len(R)} checks passed")
    return 0 if all(ok for _, ok in R) else 1


if __name__ == "__main__":
    sys.exit(main())
