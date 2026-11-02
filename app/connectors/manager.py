"""Connector manager orchestrating parallel queries with bounded concurrency, deduplication, and source rankings."""
from __future__ import annotations

import concurrent.futures
import logging
import re
from typing import Optional

from .base import BaseConnector, SourceRecord
from .clinical_trials import ClinicalTrialsConnector
from .crossref import CrossrefConnector
from .factcheck import FactCheckConnector
from .openalex import OpenAlexConnector
from .pubmed import PubMedConnector

log = logging.getLogger("custodia.connectors")

DOI_REGEX = re.compile(r"10\.\d{4,9}/[-._;()/:A-Za-z0-9]+")
NCT_REGEX = re.compile(r"NCT\d{8}", re.IGNORECASE)
PMID_REGEX = re.compile(r"\bPMID:?\s*(\d{7,9})\b", re.IGNORECASE)


class ConnectorManager:
    """Manages all external evidence connectors with bounded concurrency and circuit breaking."""

    def __init__(
        self,
        crossref: Optional[CrossrefConnector] = None,
        openalex: Optional[OpenAlexConnector] = None,
        pubmed: Optional[PubMedConnector] = None,
        clinical_trials: Optional[ClinicalTrialsConnector] = None,
        factcheck: Optional[FactCheckConnector] = None,
    ):
        self.connectors: dict[str, BaseConnector] = {
            "crossref": crossref or CrossrefConnector(),
            "openalex": openalex or OpenAlexConnector(),
            "pubmed": pubmed or PubMedConnector(),
            "clinical_trials": clinical_trials or ClinicalTrialsConnector(),
            "factcheck": factcheck or FactCheckConnector(),
        }
        self._executor = concurrent.futures.ThreadPoolExecutor(max_workers=5)

    def extract_identifiers(self, text: str) -> dict[str, list[str]]:
        """Extract explicit scholarly identifiers from text to perform targeted direct lookups."""
        dois = list(set(DOI_REGEX.findall(text)))
        ncts = list(set(m.upper() for m in NCT_REGEX.findall(text)))
        pmids = list(set(PMID_REGEX.findall(text)))
        return {"dois": dois, "ncts": ncts, "pmids": pmids}

    def search_all(self, query: str, limit_per_source: int = 3) -> list[SourceRecord]:
        """Query multiple registries in parallel, deduplicate by URL/DOI, and rank by credibility."""
        clean_q = query.strip()
        if not clean_q:
            return []

        # 1. Check for explicit identifiers first
        ids = self.extract_identifiers(clean_q)
        direct_records: list[SourceRecord] = []

        if ids["dois"]:
            for d in ids["dois"][:2]:
                rec = self.connectors["crossref"].lookup(d) or self.connectors["openalex"].lookup(d)
                if rec:
                    direct_records.append(rec)

        if ids["ncts"]:
            for n in ids["ncts"][:2]:
                rec = self.connectors["clinical_trials"].lookup(n)
                if rec:
                    direct_records.append(rec)

        if ids["pmids"]:
            for p in ids["pmids"][:2]:
                rec = self.connectors["pubmed"].lookup(p)
                if rec:
                    direct_records.append(rec)

        # 2. General parallel search across connectors
        futures = {}
        for name, connector in self.connectors.items():
            f = self._executor.submit(connector.search, clean_q, limit_per_source)
            futures[f] = name

        all_results: list[SourceRecord] = list(direct_records)
        for f in concurrent.futures.as_completed(futures, timeout=8.0):
            name = futures[f]
            try:
                records = f.result()
                all_results.extend(records)
            except Exception as ex:
                log.warning("Connector %s failed during search: %s", name, ex)

        # 3. Deduplicate by URL or normalized DOI/NCT/PMID
        seen_keys = set()
        deduped: list[SourceRecord] = []
        for r in all_results:
            key = r.doi or r.nct_id or r.pmid or r.url
            if key not in seen_keys:
                seen_keys.add(key)
                deduped.append(r)

        # 4. Sort by credibility score descending, then publication date
        deduped.sort(key=lambda x: (x.credibility_score, x.publication_date or ""), reverse=True)
        return deduped

    def health(self) -> dict[str, dict]:
        return {name: conn.health() for name, conn in self.connectors.items()}
