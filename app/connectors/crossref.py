"""Crossref REST API connector for scholarly DOI lookup and publication metadata."""
from __future__ import annotations

import logging
from typing import Optional
from urllib.parse import quote

from .base import BaseConnector, SourceRecord

log = logging.getLogger("custodia.crossref")


class CrossrefConnector(BaseConnector):
    """Integrates with api.crossref.org for peer-reviewed publication metadata and retraction checks."""

    def __init__(self, transport=None):
        super().__init__(name="Crossref", timeout=6.0, cache_ttl_seconds=7200.0, transport=transport)
        self.base_url = "https://api.crossref.org"

    def lookup(self, identifier: str) -> Optional[SourceRecord]:
        doi = identifier.strip().lower()
        if doi.startswith("https://doi.org/"):
            doi = doi[len("https://doi.org/"):]
        elif doi.startswith("http://doi.org/"):
            doi = doi[len("http://doi.org/"):]
        elif doi.startswith("doi:"):
            doi = doi[4:]

        cache_key = f"doi:{doi}"
        cached = self._get_cache(cache_key)
        if cached is not None:
            return cached

        url = f"{self.base_url}/works/{quote(doi)}"
        r = self._safe_request("GET", url)
        if not r or r.status_code != 200:
            return None

        try:
            item = r.json().get("message", {})
            title = (item.get("title") or ["Untitled Publication"])[0]
            authors = [f"{a.get('given', '')} {a.get('family', '')}".strip() for a in item.get("author", []) if a.get("family")]
            publisher = item.get("publisher") or item.get("container-title", [""])[0]
            
            # Extract date
            date_parts = item.get("published-print", {}).get("date-parts") or item.get("published-online", {}).get("date-parts") or [[]]
            pub_date = "-".join(str(p).zfill(2) for p in date_parts[0]) if date_parts and date_parts[0] else None

            # Check updates/retractions
            updates = item.get("update-to", [])
            retraction = "Document has received subsequent corrections or updates" if updates else None

            abstract = item.get("abstract") or f"Published scholarly work in {publisher}."

            rec = SourceRecord(
                source_id=f"crossref:{doi}",
                source_name="Crossref",
                source_type="literature",
                title=title,
                authors=authors[:5],
                publisher=publisher,
                publication_date=pub_date,
                doi=doi,
                url=f"https://doi.org/{doi}",
                snippet=abstract[:400],
                credibility_score=0.95,
                peer_reviewed=True,
                retraction_notice=retraction,
            )
            self._set_cache(cache_key, rec)
            return rec
        except Exception as ex:
            log.warning("Crossref parse error for DOI %s: %s", doi, ex)
            return None

    def search(self, query: str, limit: int = 5) -> list[SourceRecord]:
        clean_q = query.strip()
        if not clean_q:
            return []

        # If query looks like a DOI, do direct lookup
        if clean_q.startswith("10.") or "doi.org/10." in clean_q:
            direct = self.lookup(clean_q)
            return [direct] if direct else []

        cache_key = f"search:{clean_q}:{limit}"
        cached = self._get_cache(cache_key)
        if cached is not None:
            return cached

        url = f"{self.base_url}/works?query={quote(clean_q)}&rows={limit}&select=DOI,title,author,published-print,published-online,publisher,container-title"
        r = self._safe_request("GET", url)
        if not r or r.status_code != 200:
            return []

        results = []
        try:
            items = r.json().get("message", {}).get("items", [])
            for it in items:
                doi = it.get("DOI")
                if not doi:
                    continue
                title = (it.get("title") or ["Untitled"])[0]
                authors = [f"{a.get('given', '')} {a.get('family', '')}".strip() for a in it.get("author", []) if a.get("family")]
                publisher = it.get("publisher") or (it.get("container-title") or [""])[0]
                date_parts = it.get("published-print", {}).get("date-parts") or it.get("published-online", {}).get("date-parts") or [[]]
                pub_date = "-".join(str(p).zfill(2) for p in date_parts[0]) if date_parts and date_parts[0] else None

                results.append(
                    SourceRecord(
                        source_id=f"crossref:{doi}",
                        source_name="Crossref",
                        source_type="literature",
                        title=title,
                        authors=authors[:4],
                        publisher=publisher,
                        publication_date=pub_date,
                        doi=doi,
                        url=f"https://doi.org/{doi}",
                        snippet=f"Scholarly publication in {publisher}. Work indexed in Crossref database.",
                        credibility_score=0.92,
                        peer_reviewed=True,
                    )
                )
            self._set_cache(cache_key, results)
            return results
        except Exception as ex:
            log.warning("Crossref search parse error: %s", ex)
            return []
