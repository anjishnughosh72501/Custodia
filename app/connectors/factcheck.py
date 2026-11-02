"""Google Fact Check Tools API connector for independent fact-check records and claim reviews."""
from __future__ import annotations

import logging
import os
from typing import Optional
from urllib.parse import quote

from .base import BaseConnector, SourceRecord

log = logging.getLogger("custodia.factcheck")


class FactCheckConnector(BaseConnector):
    """Integrates with Google Fact Check Tools API to find previous authoritative fact checks."""

    def __init__(self, api_key: Optional[str] = None, transport=None):
        super().__init__(name="Google Fact Check", timeout=6.0, cache_ttl_seconds=7200.0, transport=transport)
        self.api_key = api_key or os.getenv("GEMINI_API_KEY") or os.getenv("FACTCHECK_API_KEY")
        self.base_url = "https://factchecktools.googleapis.com/v1alpha1"

    def lookup(self, identifier: str) -> Optional[SourceRecord]:
        return None  # FactCheck does not have direct IDs, only queries

    def search(self, query: str, limit: int = 5) -> list[SourceRecord]:
        clean_q = query.strip()
        if not clean_q or not self.api_key:
            return []

        cache_key = f"search:{clean_q}:{limit}"
        cached = self._get_cache(cache_key)
        if cached is not None:
            return cached

        url = f"{self.base_url}/claims:search?query={quote(clean_q)}&pageSize={limit}&key={self.api_key}"
        r = self._safe_request("GET", url)
        if not r or r.status_code != 200:
            return []

        results = []
        try:
            claims = r.json().get("claims", [])
            for c in claims:
                claim_text = c.get("text", "")
                claimant = c.get("claimant", "Unknown Claimant")
                claim_date = c.get("claimDate")
                reviews = c.get("claimReview", [])
                for rev in reviews:
                    publisher = rev.get("publisher", {}).get("name", "Fact Checker")
                    url = rev.get("url", "")
                    rating = rev.get("textualRating", "Unrated")
                    title = rev.get("title") or f"Fact Check by {publisher}: {claim_text[:80]}"

                    results.append(
                        SourceRecord(
                            source_id=f"factcheck:{url}",
                            source_name="Google Fact Check",
                            source_type="fact_check",
                            title=title,
                            authors=[publisher],
                            publisher=publisher,
                            publication_date=rev.get("reviewDate") or claim_date,
                            url=url or "https://toolbox.google.com/factcheck/explorer",
                            snippet=f"Claim: \"{claim_text}\" (Claimant: {claimant}). Rating by {publisher}: {rating}.",
                            credibility_score=0.88,
                            peer_reviewed=False,
                        )
                    )
                    if len(results) >= limit:
                        break
                if len(results) >= limit:
                    break

            self._set_cache(cache_key, results)
            return results
        except Exception as ex:
            log.warning("Fact Check search parse error: %s", ex)
            return []
