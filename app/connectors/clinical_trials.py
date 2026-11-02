"""ClinicalTrials.gov API v2 connector for clinical trial registration, status, and outcome verification."""
from __future__ import annotations

import logging
from typing import Optional
from urllib.parse import quote

from .base import BaseConnector, SourceRecord

log = logging.getLogger("custodia.clinical_trials")


class ClinicalTrialsConnector(BaseConnector):
    """Integrates with clinicaltrials.gov v2 REST API to verify claimed clinical trials, enrollment, and outcomes."""

    def __init__(self, transport=None):
        super().__init__(name="ClinicalTrials.gov", timeout=6.0, cache_ttl_seconds=7200.0, transport=transport)
        self.base_url = "https://clinicaltrials.gov/api/v2"

    def lookup(self, identifier: str) -> Optional[SourceRecord]:
        nct_id = identifier.strip().upper()
        if not nct_id.startswith("NCT"):
            return None

        cache_key = f"nct:{nct_id}"
        cached = self._get_cache(cache_key)
        if cached is not None:
            return cached

        url = f"{self.base_url}/studies/{nct_id}"
        r = self._safe_request("GET", url)
        if not r or r.status_code != 200:
            return None

        try:
            study = r.json().get("protocolSection", {})
            id_mod = study.get("identificationModule", {})
            title = id_mod.get("briefTitle") or "Clinical Study"
            sponsor = study.get("sponsorCollaboratorsModule", {}).get("leadSponsor", {}).get("name") or "Trial Sponsor"
            status = study.get("statusModule", {}).get("overallStatus") or "UNKNOWN"
            start_date = study.get("statusModule", {}).get("startDateStruct", {}).get("date")
            comp_date = study.get("statusModule", {}).get("completionDateStruct", {}).get("date")
            design = study.get("designModule", {})
            enrollment = design.get("enrollmentInfo", {}).get("count")
            has_results = r.json().get("hasResults", False)

            conditions = study.get("conditionsModule", {}).get("conditions", [])
            cond_str = ", ".join(conditions[:3]) if conditions else "Unspecified"

            snippet = (
                f"Status: {status}. Sponsor: {sponsor}. Enrollment: {enrollment or 'N/A'}. "
                f"Conditions: {cond_str}. Results posted: {'Yes' if has_results else 'No'}."
            )

            rec = SourceRecord(
                source_id=f"clinicaltrials:{nct_id}",
                source_name="ClinicalTrials.gov",
                source_type="clinical_trial",
                title=f"{title} ({nct_id})",
                authors=[sponsor],
                publisher="ClinicalTrials.gov Registry",
                publication_date=comp_date or start_date,
                nct_id=nct_id,
                url=f"https://clinicaltrials.gov/study/{nct_id}",
                snippet=snippet,
                credibility_score=0.95,
                peer_reviewed=True,
            )
            self._set_cache(cache_key, rec)
            return rec
        except Exception as ex:
            log.warning("ClinicalTrials lookup error: %s", ex)
            return None

    def search(self, query: str, limit: int = 5) -> list[SourceRecord]:
        clean_q = query.strip()
        if not clean_q:
            return []

        # If query has NCT ID format
        if "NCT" in clean_q.upper():
            for word in clean_q.split():
                if word.upper().startswith("NCT") and len(word) >= 9:
                    direct = self.lookup(word.upper())
                    if direct:
                        return [direct]

        cache_key = f"search:{clean_q}:{limit}"
        cached = self._get_cache(cache_key)
        if cached is not None:
            return cached

        url = f"{self.base_url}/studies?query.term={quote(clean_q)}&pageSize={limit}"
        r = self._safe_request("GET", url)
        if not r or r.status_code != 200:
            return []

        results = []
        try:
            studies = r.json().get("studies", [])
            for s in studies:
                proto = s.get("protocolSection", {})
                id_mod = proto.get("identificationModule", {})
                nct_id = id_mod.get("nctId")
                if not nct_id:
                    continue
                title = id_mod.get("briefTitle") or "Clinical Study"
                sponsor = proto.get("sponsorCollaboratorsModule", {}).get("leadSponsor", {}).get("name") or "Trial Sponsor"
                status = proto.get("statusModule", {}).get("overallStatus") or "UNKNOWN"
                enrollment = proto.get("designModule", {}).get("enrollmentInfo", {}).get("count")
                comp_date = proto.get("statusModule", {}).get("completionDateStruct", {}).get("date")

                results.append(
                    SourceRecord(
                        source_id=f"clinicaltrials:{nct_id}",
                        source_name="ClinicalTrials.gov",
                        source_type="clinical_trial",
                        title=f"{title} ({nct_id})",
                        authors=[sponsor],
                        publisher="ClinicalTrials.gov Registry",
                        publication_date=comp_date,
                        nct_id=nct_id,
                        url=f"https://clinicaltrials.gov/study/{nct_id}",
                        snippet=f"Registered Trial {nct_id}. Status: {status}. Planned enrollment: {enrollment or 'N/A'}.",
                        credibility_score=0.92,
                        peer_reviewed=True,
                    )
                )

            self._set_cache(cache_key, results)
            return results
        except Exception as ex:
            log.warning("ClinicalTrials search error: %s", ex)
            return []
