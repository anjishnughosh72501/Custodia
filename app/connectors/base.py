"""Base connector interface, caching, retry logic, and circuit breaker for real-world evidence sources."""
from __future__ import annotations

import abc
import datetime
import hashlib
import logging
import random
import threading
import time
from typing import Any, Optional

import httpx
from pydantic import BaseModel, Field

log = logging.getLogger("custodia.connectors")


class SourceRecord(BaseModel):
    """Normalized evidence record from an external real-world registry or API."""
    source_id: str
    source_name: str
    source_type: str = "literature"  # literature | clinical_trial | fact_check | registry
    title: str
    authors: list[str] = Field(default_factory=list)
    publisher: Optional[str] = None
    publication_date: Optional[str] = None
    doi: Optional[str] = None
    pmid: Optional[str] = None
    nct_id: Optional[str] = None
    url: str
    snippet: str
    credibility_score: float = 0.80  # 0.0 to 1.0
    peer_reviewed: bool = False
    retraction_notice: Optional[str] = None
    retrieved_at: str = Field(default_factory=lambda: datetime.datetime.now(datetime.timezone.utc).isoformat())


class ConnectorCircuitBreaker:
    """Circuit breaker for external public APIs."""
    def __init__(self, failure_threshold: int = 3, cooldown_seconds: float = 90.0):
        self.failure_threshold = failure_threshold
        self.cooldown_seconds = cooldown_seconds
        self.failures = 0
        self.tripped_at: Optional[float] = None
        self._lock = threading.Lock()

    def record_success(self):
        with self._lock:
            self.failures = 0
            self.tripped_at = None

    def record_failure(self):
        with self._lock:
            self.failures += 1
            if self.failures >= self.failure_threshold:
                self.tripped_at = time.monotonic()
                log.warning("Connector circuit breaker tripped for %ss", self.cooldown_seconds)

    def is_open(self) -> bool:
        with self._lock:
            if self.tripped_at is None:
                return False
            if time.monotonic() - self.tripped_at > self.cooldown_seconds:
                self.tripped_at = None
                self.failures = self.failure_threshold - 1
                return False
            return True


class BaseConnector(abc.ABC):
    """Abstract connector defining interface, timeouts, retries, and caching."""

    def __init__(
        self,
        name: str,
        timeout: float = 6.0,
        cache_ttl_seconds: float = 3600.0,
        transport: Optional[httpx.BaseTransport] = None,
    ):
        self.name = name
        self.timeout = timeout
        self.cache_ttl = cache_ttl_seconds
        self.circuit_breaker = ConnectorCircuitBreaker()
        self._cache: dict[str, tuple[Any, float]] = {}
        self._lock = threading.Lock()
        self._http = httpx.Client(
            timeout=httpx.Timeout(timeout),
            transport=transport,
            limits=httpx.Limits(max_keepalive_connections=5, max_connections=10),
            headers={"User-Agent": "CustodiaEvidenceVerifier/1.0 (mailto:custodia-eval@project.internal)"},
        )

    def _get_cache(self, key: str) -> Optional[Any]:
        with self._lock:
            if key in self._cache:
                val, expiry = self._cache[key]
                if time.monotonic() < expiry:
                    return val
                del self._cache[key]
        return None

    def _set_cache(self, key: str, val: Any, ttl: Optional[float] = None):
        with self._lock:
            if len(self._cache) > 300:
                self._cache.clear()
            self._cache[key] = (val, time.monotonic() + (ttl or self.cache_ttl))

    def _safe_request(self, method: str, url: str, **kwargs) -> Optional[httpx.Response]:
        if self.circuit_breaker.is_open():
            log.warning("%s connector circuit breaker is OPEN, skipping request to %s", self.name, url)
            return None

        for attempt in range(2):
            try:
                r = self._http.request(method, url, **kwargs)
                if r.status_code == 200:
                    self.circuit_breaker.record_success()
                    return r
                if r.status_code == 429:
                    self.circuit_breaker.record_failure()
                    time.sleep(0.5 + random.uniform(0.1, 0.3))
                    continue
                if r.status_code in (404, 422):
                    return r
                if r.status_code >= 500:
                    self.circuit_breaker.record_failure()
                    continue
            except (httpx.TimeoutException, httpx.HTTPError) as ex:
                log.warning("%s request failed: %s", self.name, ex)
                self.circuit_breaker.record_failure()
        return None

    @abc.abstractmethod
    def search(self, query: str, limit: int = 5) -> list[SourceRecord]:
        """Search connector by query keywords."""
        pass

    @abc.abstractmethod
    def lookup(self, identifier: str) -> Optional[SourceRecord]:
        """Lookup by exact identifier (DOI, PMID, NCT ID, URL)."""
        pass

    def health(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "available": not self.circuit_breaker.is_open(),
            "cached_entries": len(self._cache),
        }
