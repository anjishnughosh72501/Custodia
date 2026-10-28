"""Storage layer for Custodia reviews with TTL retention and cryptographic delete tokens.

Supports:
- SqliteStore (default local and single-container deployment)
- PostgresStore (Neon/Postgres production deployment when DATABASE_URL is set)
"""
from __future__ import annotations
import abc
import datetime
import hashlib
import logging
import sqlite3
import threading
from typing import Optional
from .models import Review

log = logging.getLogger("custodia")
DEFAULT_RETENTION_DAYS = 30


class BaseStore(abc.ABC):
    """Abstract interface for Custodia review storage."""

    @abc.abstractmethod
    def save(self, review: Review, delete_token: Optional[str] = None, retention_days: int = DEFAULT_RETENTION_DAYS) -> None:
        """Saves a review along with optional hashed delete token and expiration timestamp."""
        pass

    @abc.abstractmethod
    def get(self, review_id: str) -> Optional[Review]:
        """Retrieves a review by ID, lazily pruning if expired."""
        pass

    @abc.abstractmethod
    def delete(self, review_id: str, delete_token: str) -> tuple[bool, str]:
        """Deletes a review if delete_token matches. Returns (success, reason_code)."""
        pass

    @abc.abstractmethod
    def purge_expired(self) -> int:
        """Purges all expired reviews and returns count of pruned records."""
        pass


class SqliteStore(BaseStore):
    """SQLite-backed review store."""

    def __init__(self, path: str = "custodia.db"):
        self.path = path
        self._db = sqlite3.connect(path, check_same_thread=False)
        self._lock = threading.Lock()
        with self._lock:
            # Create reviews table with created_at, expires_at, delete_token_hash
            self._db.execute(
                """
                CREATE TABLE IF NOT EXISTS reviews (
                    id TEXT PRIMARY KEY,
                    body TEXT NOT NULL,
                    created_at TIMESTAMP,
                    expires_at TIMESTAMP,
                    delete_token_hash TEXT
                )
                """
            )
            # Ensure columns exist if table was created in older schema
            cols = [row[1] for row in self._db.execute("PRAGMA table_info(reviews)").fetchall()]
            if "created_at" not in cols:
                self._db.execute("ALTER TABLE reviews ADD COLUMN created_at TIMESTAMP")
            if "expires_at" not in cols:
                self._db.execute("ALTER TABLE reviews ADD COLUMN expires_at TIMESTAMP")
            if "delete_token_hash" not in cols:
                self._db.execute("ALTER TABLE reviews ADD COLUMN delete_token_hash TEXT")
            self._db.commit()

        # Purge expired on startup
        self.purge_expired()

    def _now(self) -> datetime.datetime:
        return datetime.datetime.now(datetime.timezone.utc)

    def save(self, review: Review, delete_token: Optional[str] = None, retention_days: int = DEFAULT_RETENTION_DAYS) -> None:
        now = self._now()
        expires = now + datetime.timedelta(days=retention_days)
        tok_hash = hashlib.sha256(delete_token.encode("utf-8")).hexdigest() if delete_token else None
        body = review.model_dump_json()

        with self._lock:
            self._db.execute(
                """
                INSERT OR REPLACE INTO reviews (id, body, created_at, expires_at, delete_token_hash)
                VALUES (?, ?, ?, ?, ?)
                """,
                (review.id, body, now.isoformat(), expires.isoformat(), tok_hash),
            )
            self._db.commit()

    def get(self, review_id: str) -> Optional[Review]:
        now_iso = self._now().isoformat()
        with self._lock:
            row = self._db.execute(
                "SELECT body, expires_at FROM reviews WHERE id = ?", (review_id,)
            ).fetchone()

            if not row:
                return None

            body, expires_at = row[0], row[1]
            if expires_at and expires_at < now_iso:
                # Expired -> prune lazily
                self._db.execute("DELETE FROM reviews WHERE id = ?", (review_id,))
                self._db.commit()
                return None

        return Review.model_validate_json(body)

    def delete(self, review_id: str, delete_token: str) -> tuple[bool, str]:
        expected_hash = hashlib.sha256(delete_token.encode("utf-8")).hexdigest()
        now_iso = self._now().isoformat()

        with self._lock:
            row = self._db.execute(
                "SELECT delete_token_hash, expires_at FROM reviews WHERE id = ?", (review_id,)
            ).fetchone()

            if not row:
                return False, "NOT_FOUND"

            stored_hash, expires_at = row[0], row[1]
            if expires_at and expires_at < now_iso:
                self._db.execute("DELETE FROM reviews WHERE id = ?", (review_id,))
                self._db.commit()
                return False, "NOT_FOUND"

            if not stored_hash or stored_hash != expected_hash:
                return False, "FORBIDDEN"

            self._db.execute("DELETE FROM reviews WHERE id = ?", (review_id,))
            self._db.commit()
            return True, "OK"

    def purge_expired(self) -> int:
        now_iso = self._now().isoformat()
        with self._lock:
            cursor = self._db.execute("DELETE FROM reviews WHERE expires_at IS NOT NULL AND expires_at < ?", (now_iso,))
            count = cursor.rowcount
            self._db.commit()
            if count > 0:
                log.info("Purged %d expired review(s) from SQLite store", count)
            return count


class PostgresStore(BaseStore):
    """Postgres-backed review store (Neon compatible)."""

    def __init__(self, connection_url: str):
        import psycopg
        self.connection_url = connection_url
        self._lock = threading.Lock()
        with self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS reviews (
                        id VARCHAR(32) PRIMARY KEY,
                        body TEXT NOT NULL,
                        created_at TIMESTAMPTZ NOT NULL,
                        expires_at TIMESTAMPTZ NOT NULL,
                        delete_token_hash VARCHAR(64)
                    );
                    CREATE INDEX IF NOT EXISTS idx_reviews_expires_at ON reviews (expires_at);
                    """
                )
            conn.commit()

        self.purge_expired()

    def _connect(self):
        import psycopg
        return psycopg.connect(self.connection_url)

    def _now(self) -> datetime.datetime:
        return datetime.datetime.now(datetime.timezone.utc)

    def save(self, review: Review, delete_token: Optional[str] = None, retention_days: int = DEFAULT_RETENTION_DAYS) -> None:
        now = self._now()
        expires = now + datetime.timedelta(days=retention_days)
        tok_hash = hashlib.sha256(delete_token.encode("utf-8")).hexdigest() if delete_token else None
        body = review.model_dump_json()

        with self._lock, self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO reviews (id, body, created_at, expires_at, delete_token_hash)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        body = EXCLUDED.body,
                        expires_at = EXCLUDED.expires_at,
                        delete_token_hash = EXCLUDED.delete_token_hash
                    """,
                    (review.id, body, now, expires, tok_hash),
                )
            conn.commit()

    def get(self, review_id: str) -> Optional[Review]:
        now = self._now()
        with self._lock, self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT body, expires_at FROM reviews WHERE id = %s", (review_id,)
                )
                row = cur.fetchone()
                if not row:
                    return None
                body, expires_at = row[0], row[1]
                if expires_at and expires_at < now:
                    cur.execute("DELETE FROM reviews WHERE id = %s", (review_id,))
                    conn.commit()
                    return None

        return Review.model_validate_json(body)

    def delete(self, review_id: str, delete_token: str) -> tuple[bool, str]:
        expected_hash = hashlib.sha256(delete_token.encode("utf-8")).hexdigest()
        now = self._now()

        with self._lock, self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT delete_token_hash, expires_at FROM reviews WHERE id = %s", (review_id,)
                )
                row = cur.fetchone()
                if not row:
                    return False, "NOT_FOUND"

                stored_hash, expires_at = row[0], row[1]
                if expires_at and expires_at < now:
                    cur.execute("DELETE FROM reviews WHERE id = %s", (review_id,))
                    conn.commit()
                    return False, "NOT_FOUND"

                if not stored_hash or stored_hash != expected_hash:
                    return False, "FORBIDDEN"

                cur.execute("DELETE FROM reviews WHERE id = %s", (review_id,))
                conn.commit()
                return True, "OK"

    def purge_expired(self) -> int:
        now = self._now()
        with self._lock, self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM reviews WHERE expires_at < %s", (now,))
                count = cur.rowcount
            conn.commit()
            if count > 0:
                log.info("Purged %d expired review(s) from Postgres store", count)
            return count


# Store alias for backward compatibility
Store = SqliteStore


def build_store(database_url: Optional[str] = None, sqlite_path: str = "custodia.db") -> BaseStore:
    """Builds appropriate store based on presence of DATABASE_URL."""
    if database_url and database_url.startswith(("postgres://", "postgresql://")):
        # Handle Neon/Render postgres URI format
        conn_str = database_url
        if conn_str.startswith("postgres://"):
            conn_str = "postgresql://" + conn_str[len("postgres://"):]
        log.info("Using PostgreSQL store from DATABASE_URL")
        return PostgresStore(conn_str)
    return SqliteStore(sqlite_path)
