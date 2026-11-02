"""OpenAlex API connector for comprehensive scientific literature and institution metadata."""
from __future__ import annotations

import logging
from typing import Optional
from urllib.parse import quote

from .base import BaseConnector, SourceRecord

log = logging.getLogger("custodia.openalex")


class OpenAlexConnector(BaseConnector):
    """Integrates with api.openalex.org for scholarly citations, concepts, and institutional data."""

    def __init__(self, transport=None):
        super().__init__(name="OpenAlex", timeout=6.0, cache_ttl_seconds=7200.0, transport=transport)
        self.base_url = "https://api.openalex.org"

    def lookup(self, identifier: str) -> Optional[SourceRecord]:
        clean_id = identifier.strip()
        cache_key = f"id:{clean_id}"
        cached = self._get_cache(cache_key)
        if cached is not None:
            return cached

        # Handle OpenAlex ID (W...) or DOI
        if clean_id.startswith("10.") or "doi.org" in clean_id:
            url = f"{self.base_url}/works/https://doi.org/{quote(clean_id.replace('https://doi.org/', ''))}"
        else:
            url = f"{self.base_url}/works/{quote(clean_id)}"

        r = self._safe_request("GET", url)
        if not r or r.status_code != 200:
            return None

        try:
            it = r.json()
            title = it.get("title") or "Scholarly Paper"
            authors = [a.get("author", {}).get("display_name", "") for a in it.get("authorships", []) if a.get("author")]
            venue = it.get("primary_location", {}).get("source", {}).get("display_name") or "Academic Source"
            pub_date = it.get("publication_date") or str(it.get("publication_year", ""))
            doi = (it.get("doi") or "").replace("https://doi.org/", "")
            cites = it.get("cited_by_count", 0)

            rec = SourceRecord(
                source_id=f"openalex:{it.get('id', clean_id)}",
                source_name="OpenAlex",
                source_type="literature",
                title=title,
                authors=authors[:5],
                publisher=venue,
                publication_date=pub_date,
                doi=doi if doi else None,
                url=it.get("doi") or it.get("id") or f"https://openalex.org/{clean_id}",
                snippet=f"Indexed in OpenAlex with {cites} citations. Primary venue: {venue}.",
                credibility_score=0.92,
                peer_reviewed=True,
            )
            self._set_cache(cache_key, rec)
            return rec
        except Exception as ex:
            log.warning("OpenAlex lookup error: %s", ex)
            return None

    def search(self, query: str, limit: int = 5) -> list[SourceRecord]:
        clean_q = query.strip()
        if not clean_q:
            return []

        cache_key = f"search:{clean_q}:{limit}"
        cached = self._get_cache(cache_key)
        if cached is not None:
            return cached

        url = f"{self.base_url}/works?search={quote(clean_q)}&per-page={limit}&select=id,title,authorships,publication_date,publication_year,primary_location,doi,cited_by_count"
        r = self._safe_request("GET", url)
        if not r or r.status_code != 200:
            return []

        results = []
        try:
            items = r.json().get("results", [])
            for it in items:
                title = it.get("title")
                if not title:
                    continue
                authors = [a.get("author", {}).get("display_name", "") for a in it.get("authorships", []) if a.get("author")]
                venue = (it.get("primary_location") or {}).get("source", {}).get("display_name") or "Scholarly Publication"
                pub_date = it.get("publication_date") or str(it.get("publication_year", ""))
                doi = (it.get("doi") or "").replace("https://doi.org/", "")
                cites = it.get("cited_by_count", 0)

                results.append(
                    SourceRecord(
                        source_id=f"openalex:{it.get('id')}",
                        source_name="OpenAlex",
                        source_type="literature",
                        title=title,
                        authors=authors[:4],
                        publisher=venue,
                        publication_date=pub_date,
                        doi=doi if doi else None,
                        url=it.get("doi") or f"https://openalex.org/{it.get('id')}",
                        snippet=f"Work published in {venue} ({cites} citations).",
                        credibility_score=0.90,
                        peer_reviewed=True,
                    )
                )
            self._set_cache(cache_key, results)
            return results
        except Exception as ex:
            log.warning("OpenAlex search parse error: %s", ex)
            return []
