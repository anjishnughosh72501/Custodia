"""PubMed E-utilities connector for biomedical literature and clinical publication records."""
from __future__ import annotations

import logging
from typing import Optional
from urllib.parse import quote

from .base import BaseConnector, SourceRecord

log = logging.getLogger("custodia.pubmed")


class PubMedConnector(BaseConnector):
    """Integrates with NCBI E-utilities (esearch, esummary) for biomedical research verification."""

    def __init__(self, transport=None):
        super().__init__(name="PubMed", timeout=6.0, cache_ttl_seconds=7200.0, transport=transport)
        self.base_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"

    def lookup(self, identifier: str) -> Optional[SourceRecord]:
        pmid = identifier.strip().lower()
        if pmid.startswith("pmid:"):
            pmid = pmid[5:]
        elif pmid.startswith("pmid"):
            pmid = pmid[4:]
        pmid = pmid.strip()

        if not pmid.isdigit():
            return None

        cache_key = f"pmid:{pmid}"
        cached = self._get_cache(cache_key)
        if cached is not None:
            return cached

        url = f"{self.base_url}/esummary.fcgi?db=pubmed&id={pmid}&retmode=json"
        r = self._safe_request("GET", url)
        if not r or r.status_code != 200:
            return None

        try:
            res = r.json().get("result", {})
            doc = res.get(pmid)
            if not doc:
                return None

            title = doc.get("title") or "Biomedical Publication"
            authors = [a.get("name", "") for a in doc.get("authors", []) if a.get("name")]
            journal = doc.get("source") or "Medical Journal"
            pub_date = doc.get("pubdate")
            article_ids = {i.get("idtype"): i.get("value") for i in doc.get("articleids", [])}
            doi = article_ids.get("doi")

            rec = SourceRecord(
                source_id=f"pubmed:{pmid}",
                source_name="PubMed",
                source_type="literature",
                title=title,
                authors=authors[:5],
                publisher=journal,
                publication_date=pub_date,
                doi=doi,
                pmid=pmid,
                url=f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
                snippet=f"PubMed indexed study in {journal}. PMID: {pmid}.",
                credibility_score=0.96,
                peer_reviewed=True,
            )
            self._set_cache(cache_key, rec)
            return rec
        except Exception as ex:
            log.warning("PubMed lookup parse error: %s", ex)
            return None

    def search(self, query: str, limit: int = 5) -> list[SourceRecord]:
        clean_q = query.strip()
        if not clean_q:
            return []

        # If query is a PMID, do direct lookup
        if clean_q.isdigit() or clean_q.lower().startswith("pmid"):
            direct = self.lookup(clean_q)
            return [direct] if direct else []

        cache_key = f"search:{clean_q}:{limit}"
        cached = self._get_cache(cache_key)
        if cached is not None:
            return cached

        # Step 1: ESearch to find PMIDs
        esearch_url = f"{self.base_url}/esearch.fcgi?db=pubmed&term={quote(clean_q)}&retmax={limit}&retmode=json"
        r1 = self._safe_request("GET", esearch_url)
        if not r1 or r1.status_code != 200:
            return []

        try:
            id_list = r1.json().get("esearchresult", {}).get("idlist", [])
            if not id_list:
                return []

            # Step 2: ESummary to get summaries for PMIDs
            id_str = ",".join(id_list)
            esummary_url = f"{self.base_url}/esummary.fcgi?db=pubmed&id={id_str}&retmode=json"
            r2 = self._safe_request("GET", esummary_url)
            if not r2 or r2.status_code != 200:
                return []

            results = []
            res_dict = r2.json().get("result", {})
            for pid in id_list:
                doc = res_dict.get(pid)
                if not doc:
                    continue
                title = doc.get("title") or "Biomedical Publication"
                authors = [a.get("name", "") for a in doc.get("authors", []) if a.get("name")]
                journal = doc.get("source") or "Biomedical Literature"
                pub_date = doc.get("pubdate")
                article_ids = {i.get("idtype"): i.get("value") for i in doc.get("articleids", [])}
                doi = article_ids.get("doi")

                results.append(
                    SourceRecord(
                        source_id=f"pubmed:{pid}",
                        source_name="PubMed",
                        source_type="literature",
                        title=title,
                        authors=authors[:4],
                        publisher=journal,
                        publication_date=pub_date,
                        doi=doi,
                        pmid=pid,
                        url=f"https://pubmed.ncbi.nlm.nih.gov/{pid}/",
                        snippet=f"PubMed research indexed in {journal}. Verified peer-reviewed entry.",
                        credibility_score=0.96,
                        peer_reviewed=True,
                    )
                )

            self._set_cache(cache_key, results)
            return results
        except Exception as ex:
            log.warning("PubMed search error: %s", ex)
            return []
