"""Client interface to the private Custodia Secure Document Gateway (Rust).

Binds strictly to 127.0.0.1:8002.
Enforces timeouts, bounded payload sizes, and structured validation reports.
"""
from __future__ import annotations

import logging
import os
from typing import Any, Optional
import httpx

log = logging.getLogger("custodia.gateway")

DEFAULT_GATEWAY_URL = os.getenv("CUSTODIA_GATEWAY_URL", "http://127.0.0.1:8002")
GATEWAY_TIMEOUT_SECONDS = float(os.getenv("CUSTODIA_GATEWAY_TIMEOUT", "5.0"))


class GatewayClientError(Exception):
    def __init__(self, code: str, message: str, details: Optional[dict[str, Any]] = None):
        super().__init__(message)
        self.code = code
        self.details = details or {}


class SecureGatewayClient:
    """Client for memory-safe pre-parser validation via Rust gateway."""

    def __init__(self, base_url: str = DEFAULT_GATEWAY_URL, timeout: float = GATEWAY_TIMEOUT_SECONDS):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def is_available(self) -> bool:
        """Checks if the private Rust gateway is responsive on local loopback."""
        try:
            with httpx.Client(timeout=1.0) as client:
                res = client.get(f"{self.base_url}/health")
                return res.status_code == 200 and res.json().get("status") == "ok"
        except Exception:
            return False

    def validate_document(self, data: bytes, filename: str) -> dict[str, Any]:
        """Submits document to the Rust gateway for pre-parser security validation.

        Returns structured validation report containing:
        - valid: bool
        - sha256: str
        - sanitized_filename: str
        - file_type: str
        - warnings: list[str]
        - metadata: dict
        """
        url = f"{self.base_url}/validate-raw"
        headers = {
            "x-filename": filename,
            "Content-Type": "application/octet-stream",
        }

        try:
            with httpx.Client(timeout=self.timeout) as client:
                res = client.post(url, headers=headers, content=data)

                if res.status_code == 200:
                    report = res.json()
                    log.info(
                        "Rust gateway validated '%s' (sha256=%s, type=%s)",
                        report.get("sanitized_filename"),
                        report.get("sha256", "")[:12],
                        report.get("file_type"),
                    )
                    return report

                if res.status_code in (400, 422):
                    report = res.json()
                    err_code = report.get("error_code", "VALIDATION_FAILED")
                    err_msg = report.get("error_message", "Document failed security validation.")
                    log.warning(
                        "Rust gateway rejected '%s': [%s] %s",
                        filename,
                        err_code,
                        err_msg,
                    )
                    raise GatewayClientError(err_code, err_msg, report)

                if res.status_code == 503:
                    raise GatewayClientError(
                        "GATEWAY_BUSY",
                        "Security gateway is at maximum concurrency capacity. Please retry shortly.",
                    )

                raise GatewayClientError(
                    "GATEWAY_HTTP_ERROR",
                    f"Gateway returned unexpected HTTP {res.status_code}: {res.text[:200]}",
                )

        except httpx.ConnectError:
            log.warning("Rust security gateway unavailable at %s; engaging strict fallback", self.base_url)
            raise GatewayClientError(
                "GATEWAY_UNAVAILABLE",
                "Secure document gateway is offline or unreachable.",
            )
        except httpx.TimeoutException:
            log.error("Rust security gateway timed out after %.1fs on '%s'", self.timeout, filename)
            raise GatewayClientError(
                "GATEWAY_TIMEOUT",
                f"Security gateway timed out after {self.timeout}s during file inspection.",
            )


# Global singleton instance
gateway_client = SecureGatewayClient()
