"""Storage layer for Custodia reviews with TTL retention and cryptographic delete tokens.

Supports:
- SqliteStore (default local and single-container deployment)
- PostgresStore (Neon/Postgres production deployment when DATABASE_URL is set)
"""
from __future__ import annotations
import abc
import datetime
import hashlib
import json
import logging
import sqlite3
import threading
import uuid
from typing import Optional
from .models import Review

log = logging.getLogger("custodia")
DEFAULT_RETENTION_DAYS = 30


class BaseStore(abc.ABC):
    """Abstract interface for Custodia review storage, user authentication, and rate tracking."""

    @abc.abstractmethod
    def save(
        self,
        review: Review,
        delete_token: Optional[str] = None,
        retention_days: int = DEFAULT_RETENTION_DAYS,
        user_id: Optional[str] = None,
    ) -> None:
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

    @abc.abstractmethod
    def create_user(self, user_id: str, email: str, password_hash: str) -> dict:
        """Creates a new user record."""
        pass

    @abc.abstractmethod
    def get_user_by_email(self, email: str) -> Optional[dict]:
        """Fetches a user by normalized lowercase email."""
        pass

    @abc.abstractmethod
    def get_user_by_id(self, user_id: str) -> Optional[dict]:
        """Fetches a user by user_id."""
        pass

    @abc.abstractmethod
    def create_session(self, id_hash: str, user_id: str, expires_at: datetime.datetime) -> None:
        """Creates an authenticated session."""
        pass

    @abc.abstractmethod
    def get_session(self, id_hash: str) -> Optional[dict]:
        """Retrieves an active session if not expired."""
        pass

    @abc.abstractmethod
    def delete_session(self, id_hash: str) -> None:
        """Revokes a session by token hash."""
        pass

    @abc.abstractmethod
    def purge_expired_sessions(self) -> int:
        """Purges expired sessions."""
        pass

    @abc.abstractmethod
    def get_anon_usage(self, anon_id: str) -> int:
        """Returns checks_used for an anonymous token."""
        pass

    @abc.abstractmethod
    def get_ip_usage(self, ip_hash: str) -> int:
        """Returns cumulative checks used across this IP hash."""
        pass

    @abc.abstractmethod
    def increment_anon_usage(self, anon_id: str, ip_hash: str) -> int:
        """Increments usage counter for an anonymous token."""
        pass

    @abc.abstractmethod
    def attach_reviews_to_user(self, user_id: str, review_ids: list[str]) -> int:
        """Attaches unclaimed anonymous reviews to an authenticated user account."""
        pass

    @abc.abstractmethod
    def get_user_reviews(self, user_id: str) -> list[Review]:
        """Returns reviews owned by a user."""
        pass

    @abc.abstractmethod
    def save_revision(
        self,
        review_id: str,
        claim_text: str,
        evidence_text: str,
        verdict: dict,
        confidence_map: Optional[dict] = None,
        sources: Optional[list[dict]] = None,
        suggested_rewrite: Optional[str] = None,
        reverified_status: Optional[str] = None,
        reviewer_id: Optional[str] = None,
        reviewer_action: str = "automated_check",
        notes: str = "",
    ) -> dict:
        """Saves a versioned audit revision of a claim verification."""
        pass

    @abc.abstractmethod
    def get_revisions(self, review_id: str, user_id: Optional[str] = None) -> list[dict]:
        """Returns all versioned revisions for an auditable review, enforcing user ownership."""
        pass

    @abc.abstractmethod
    def record_decision(
        self, review_id: str, user_id: str, decision: str, notes: str = ""
    ) -> dict:
        """Records a human reviewer audit decision (APPROVED, REJECTED, FLAGGED_LEGAL, REVISE_EVIDENCE)."""
        pass


class SqliteStore(BaseStore):
    """SQLite-backed review and user store."""

    def __init__(self, path: str = "custodia.db"):
        self.path = path
        self._db = sqlite3.connect(path, check_same_thread=False)
        self._lock = threading.Lock()
        with self._lock:
            # Reviews table with created_at, expires_at, delete_token_hash, user_id
            self._db.execute(
                """
                CREATE TABLE IF NOT EXISTS reviews (
                    id TEXT PRIMARY KEY,
                    body TEXT NOT NULL,
                    created_at TIMESTAMP,
                    expires_at TIMESTAMP,
                    delete_token_hash TEXT,
                    user_id TEXT
                )
                """
            )
            cols = [row[1] for row in self._db.execute("PRAGMA table_info(reviews)").fetchall()]
            if "created_at" not in cols:
                self._db.execute("ALTER TABLE reviews ADD COLUMN created_at TIMESTAMP")
            if "expires_at" not in cols:
                self._db.execute("ALTER TABLE reviews ADD COLUMN expires_at TIMESTAMP")
            if "delete_token_hash" not in cols:
                self._db.execute("ALTER TABLE reviews ADD COLUMN delete_token_hash TEXT")
            if "user_id" not in cols:
                self._db.execute("ALTER TABLE reviews ADD COLUMN user_id TEXT")

            # Users table
            self._db.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    email TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    created_at TIMESTAMP NOT NULL
                )
                """
            )

            # Sessions table
            self._db.execute(
                """
                CREATE TABLE IF NOT EXISTS sessions (
                    id_hash TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    expires_at TIMESTAMP NOT NULL,
                    created_at TIMESTAMP NOT NULL,
                    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
                )
                """
            )

            # Anon usage table
            # NOTE: Clearing cookies is a known bypass; the IP counter only slows it down.
            self._db.execute(
                """
                CREATE TABLE IF NOT EXISTS anon_usage (
                    anon_id TEXT PRIMARY KEY,
                    checks_used INTEGER NOT NULL DEFAULT 0,
                    ip_hash TEXT,
                    created_at TIMESTAMP NOT NULL
                )
                """
            )

            self._db.execute("CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews (user_id)")
            self._db.execute("CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at)")
            self._db.execute("CREATE INDEX IF NOT EXISTS idx_anon_usage_ip_hash ON anon_usage (ip_hash)")

            # Revisions audit trail table
            self._db.execute(
                """
                CREATE TABLE IF NOT EXISTS revisions (
                    id TEXT PRIMARY KEY,
                    review_id TEXT NOT NULL,
                    version INTEGER NOT NULL,
                    claim_text TEXT NOT NULL,
                    evidence_text TEXT NOT NULL,
                    sources_json TEXT,
                    verdict_json TEXT NOT NULL,
                    confidence_map_json TEXT,
                    suggested_rewrite TEXT,
                    reverified_status TEXT,
                    reviewer_id TEXT,
                    reviewer_action TEXT DEFAULT 'automated_check',
                    notes TEXT,
                    created_at TIMESTAMP NOT NULL,
                    FOREIGN KEY(review_id) REFERENCES reviews(id) ON DELETE CASCADE
                )
                """
            )
            self._db.execute("CREATE INDEX IF NOT EXISTS idx_revisions_review_id ON revisions (review_id)")
            self._db.commit()

        # Purge expired on startup
        self.purge_expired()
        self.purge_expired_sessions()

    def _now(self) -> datetime.datetime:
        return datetime.datetime.now(datetime.timezone.utc)

    def save(
        self,
        review: Review,
        delete_token: Optional[str] = None,
        retention_days: int = DEFAULT_RETENTION_DAYS,
        user_id: Optional[str] = None,
    ) -> None:
        now = self._now()
        expires = now + datetime.timedelta(days=retention_days)
        tok_hash = hashlib.sha256(delete_token.encode("utf-8")).hexdigest() if delete_token else None
        target_uid = user_id if user_id is not None else review.user_id
        review.user_id = target_uid
        body = review.model_dump_json()

        with self._lock:
            self._db.execute(
                """
                INSERT OR REPLACE INTO reviews (id, body, created_at, expires_at, delete_token_hash, user_id)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (review.id, body, now.isoformat(), expires.isoformat(), tok_hash, target_uid),
            )
            self._db.commit()

    def get(self, review_id: str) -> Optional[Review]:
        now_iso = self._now().isoformat()
        with self._lock:
            row = self._db.execute(
                "SELECT body, expires_at, user_id FROM reviews WHERE id = ?", (review_id,)
            ).fetchone()

            if not row:
                return None

            body, expires_at, user_id = row[0], row[1], row[2]
            if expires_at and expires_at < now_iso:
                # Expired -> prune lazily
                self._db.execute("DELETE FROM reviews WHERE id = ?", (review_id,))
                self._db.commit()
                return None

        review = Review.model_validate_json(body)
        review.user_id = user_id
        return review

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

    def create_user(self, user_id: str, email: str, password_hash: str) -> dict:
        now_iso = self._now().isoformat()
        clean_email = email.strip().lower()
        with self._lock:
            self._db.execute(
                "INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
                (user_id, clean_email, password_hash, now_iso),
            )
            self._db.commit()
        return {"id": user_id, "email": clean_email, "created_at": now_iso}

    def get_user_by_email(self, email: str) -> Optional[dict]:
        clean_email = email.strip().lower()
        with self._lock:
            row = self._db.execute(
                "SELECT id, email, password_hash, created_at FROM users WHERE email = ?",
                (clean_email,),
            ).fetchone()
            if not row:
                return None
            return {"id": row[0], "email": row[1], "password_hash": row[2], "created_at": str(row[3])}

    def get_user_by_id(self, user_id: str) -> Optional[dict]:
        with self._lock:
            row = self._db.execute(
                "SELECT id, email, password_hash, created_at FROM users WHERE id = ?",
                (user_id,),
            ).fetchone()
            if not row:
                return None
            return {"id": row[0], "email": row[1], "password_hash": row[2], "created_at": str(row[3])}

    def create_session(self, id_hash: str, user_id: str, expires_at: datetime.datetime) -> None:
        now_iso = self._now().isoformat()
        expires_iso = expires_at.isoformat()
        with self._lock:
            self._db.execute(
                "INSERT INTO sessions (id_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)",
                (id_hash, user_id, expires_iso, now_iso),
            )
            self._db.commit()

    def get_session(self, id_hash: str) -> Optional[dict]:
        now_iso = self._now().isoformat()
        with self._lock:
            row = self._db.execute(
                """
                SELECT s.id_hash, s.user_id, s.expires_at, s.created_at, u.email
                FROM sessions s
                JOIN users u ON s.user_id = u.id
                WHERE s.id_hash = ?
                """,
                (id_hash,),
            ).fetchone()
            if not row:
                return None
            id_h, uid, exp_iso, cr_iso, email = row
            if exp_iso and exp_iso < now_iso:
                self._db.execute("DELETE FROM sessions WHERE id_hash = ?", (id_hash,))
                self._db.commit()
                return None
            return {
                "id_hash": id_h,
                "user_id": uid,
                "expires_at": exp_iso,
                "created_at": cr_iso,
                "user": {"id": uid, "email": email, "created_at": cr_iso},
            }

    def delete_session(self, id_hash: str) -> None:
        with self._lock:
            self._db.execute("DELETE FROM sessions WHERE id_hash = ?", (id_hash,))
            self._db.commit()

    def purge_expired_sessions(self) -> int:
        now_iso = self._now().isoformat()
        with self._lock:
            cursor = self._db.execute("DELETE FROM sessions WHERE expires_at < ?", (now_iso,))
            cnt = cursor.rowcount
            self._db.commit()
            return cnt

    def get_anon_usage(self, anon_id: str) -> int:
        with self._lock:
            row = self._db.execute("SELECT checks_used FROM anon_usage WHERE anon_id = ?", (anon_id,)).fetchone()
            return row[0] if row else 0

    def get_ip_usage(self, ip_hash: str) -> int:
        # Clearing cookies is a known bypass; the IP counter only slows it down.
        with self._lock:
            row = self._db.execute("SELECT SUM(checks_used) FROM anon_usage WHERE ip_hash = ?", (ip_hash,)).fetchone()
            return int(row[0]) if row and row[0] is not None else 0

    def increment_anon_usage(self, anon_id: str, ip_hash: str) -> int:
        now_iso = self._now().isoformat()
        with self._lock:
            row = self._db.execute("SELECT checks_used FROM anon_usage WHERE anon_id = ?", (anon_id,)).fetchone()
            if row:
                count = row[0] + 1
                self._db.execute(
                    "UPDATE anon_usage SET checks_used = ?, ip_hash = ? WHERE anon_id = ?",
                    (count, ip_hash, anon_id),
                )
            else:
                count = 1
                self._db.execute(
                    "INSERT INTO anon_usage (anon_id, checks_used, ip_hash, created_at) VALUES (?, ?, ?, ?)",
                    (anon_id, count, ip_hash, now_iso),
                )
            self._db.commit()
            return count

    def attach_reviews_to_user(self, user_id: str, review_ids: list[str]) -> int:
        if not review_ids:
            return 0
        updated = 0
        with self._lock:
            for rid in review_ids:
                cur = self._db.execute(
                    "UPDATE reviews SET user_id = ? WHERE id = ? AND (user_id IS NULL OR user_id = '')",
                    (user_id, rid),
                )
                if cur.rowcount > 0:
                    updated += cur.rowcount
            self._db.commit()
        return updated

    def get_user_reviews(self, user_id: str) -> list[Review]:
        now_iso = self._now().isoformat()
        reviews = []
        with self._lock:
            rows = self._db.execute(
                "SELECT body, expires_at, user_id FROM reviews WHERE user_id = ? ORDER BY created_at DESC",
                (user_id,),
            ).fetchall()
            for row in rows:
                body, expires_at, uid = row[0], row[1], row[2]
                if expires_at and expires_at < now_iso:
                    continue
                try:
                    r = Review.model_validate_json(body)
                    r.user_id = uid
                    reviews.append(r)
                except Exception:
                    pass
        return reviews

    def save_revision(
        self,
        review_id: str,
        claim_text: str,
        evidence_text: str,
        verdict: dict,
        confidence_map: Optional[dict] = None,
        sources: Optional[list[dict]] = None,
        suggested_rewrite: Optional[str] = None,
        reverified_status: Optional[str] = None,
        reviewer_id: Optional[str] = None,
        reviewer_action: str = "automated_check",
        notes: str = "",
    ) -> dict:
        rev_id = uuid.uuid4().hex
        now_iso = self._now().isoformat()
        with self._lock:
            cur = self._db.execute("SELECT MAX(version) FROM revisions WHERE review_id = ?", (review_id,))
            row = cur.fetchone()
            cur_version = row[0] if row and row[0] is not None else 0
            new_version = cur_version + 1

            self._db.execute(
                """
                INSERT INTO revisions (
                    id, review_id, version, claim_text, evidence_text, sources_json,
                    verdict_json, confidence_map_json, suggested_rewrite, reverified_status,
                    reviewer_id, reviewer_action, notes, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    rev_id,
                    review_id,
                    new_version,
                    claim_text,
                    evidence_text,
                    json.dumps(sources or []),
                    json.dumps(verdict),
                    json.dumps(confidence_map or {}),
                    suggested_rewrite,
                    reverified_status,
                    reviewer_id,
                    reviewer_action,
                    notes,
                    now_iso,
                ),
            )
            self._db.commit()

        return {
            "id": rev_id,
            "review_id": review_id,
            "version": new_version,
            "claim_text": claim_text,
            "evidence_text": evidence_text,
            "sources": sources or [],
            "verdict": verdict,
            "confidence_map": confidence_map or {},
            "suggested_rewrite": suggested_rewrite,
            "reverified_status": reverified_status,
            "reviewer_id": reviewer_id,
            "reviewer_action": reviewer_action,
            "notes": notes,
            "created_at": now_iso,
        }

    def get_revisions(self, review_id: str, user_id: Optional[str] = None) -> list[dict]:
        with self._lock:
            # Enforce user data isolation
            rev_row = self._db.execute("SELECT user_id FROM reviews WHERE id = ?", (review_id,)).fetchone()
            if not rev_row:
                return []
            owner_id = rev_row[0]
            if user_id and owner_id and owner_id != user_id:
                # User does not own this review
                return []

            rows = self._db.execute(
                """
                SELECT id, review_id, version, claim_text, evidence_text, sources_json,
                       verdict_json, confidence_map_json, suggested_rewrite, reverified_status,
                       reviewer_id, reviewer_action, notes, created_at
                FROM revisions WHERE review_id = ? ORDER BY version ASC
                """,
                (review_id,),
            ).fetchall()

        out = []
        for r in rows:
            out.append(
                {
                    "id": r[0],
                    "review_id": r[1],
                    "version": r[2],
                    "claim_text": r[3],
                    "evidence_text": r[4],
                    "sources": json.loads(r[5] or "[]"),
                    "verdict": json.loads(r[6] or "{}"),
                    "confidence_map": json.loads(r[7] or "{}"),
                    "suggested_rewrite": r[8],
                    "reverified_status": r[9],
                    "reviewer_id": r[10],
                    "reviewer_action": r[11],
                    "notes": r[12],
                    "created_at": str(r[13]),
                }
            )
        return out

    def record_decision(
        self, review_id: str, user_id: str, decision: str, notes: str = ""
    ) -> dict:
        revisions = self.get_revisions(review_id, user_id)
        if not revisions:
            # If no prior revisions exist, check the review body
            review = self.get(review_id)
            if not review:
                raise ValueError("Review not found or unauthorized.")
            return self.save_revision(
                review_id=review_id,
                claim_text=review.claim,
                evidence_text=review.evidence,
                verdict=review.verdict.model_dump(),
                confidence_map=None,
                suggested_rewrite=review.rewrite.text if review.rewrite else None,
                reviewer_id=user_id,
                reviewer_action=decision,
                notes=notes,
            )

        latest = revisions[-1]
        return self.save_revision(
            review_id=review_id,
            claim_text=latest["claim_text"],
            evidence_text=latest["evidence_text"],
            verdict=latest["verdict"],
            confidence_map=latest.get("confidence_map"),
            sources=latest.get("sources"),
            suggested_rewrite=latest.get("suggested_rewrite"),
            reverified_status=latest.get("reverified_status"),
            reviewer_id=user_id,
            reviewer_action=decision,
            notes=notes,
        )


class PostgresStore(BaseStore):
    """Postgres-backed review and user store (Neon compatible)."""

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
                        delete_token_hash VARCHAR(64),
                        user_id VARCHAR(64)
                    );
                    CREATE INDEX IF NOT EXISTS idx_reviews_expires_at ON reviews (expires_at);
                    CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews (user_id);

                    CREATE TABLE IF NOT EXISTS users (
                        id VARCHAR(64) PRIMARY KEY,
                        email VARCHAR(255) UNIQUE NOT NULL,
                        password_hash TEXT NOT NULL,
                        created_at TIMESTAMPTZ NOT NULL
                    );

                    CREATE TABLE IF NOT EXISTS sessions (
                        id_hash VARCHAR(64) PRIMARY KEY,
                        user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        expires_at TIMESTAMPTZ NOT NULL,
                        created_at TIMESTAMPTZ NOT NULL
                    );
                    CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);

                    -- NOTE: Clearing cookies is a known bypass; the IP counter only slows it down.
                    CREATE TABLE IF NOT EXISTS anon_usage (
                        anon_id VARCHAR(64) PRIMARY KEY,
                        checks_used INTEGER NOT NULL DEFAULT 0,
                        ip_hash VARCHAR(64),
                        created_at TIMESTAMPTZ NOT NULL
                    );
                    CREATE INDEX IF NOT EXISTS idx_anon_usage_ip_hash ON anon_usage (ip_hash);
                    """
                )
                # Ensure user_id column exists if reviews table existed previously
                cur.execute(
                    """
                    DO $$
                    BEGIN
                        IF NOT EXISTS (
                            SELECT 1 FROM information_schema.columns 
                            WHERE table_name='reviews' AND column_name='user_id'
                        ) THEN
                            ALTER TABLE reviews ADD COLUMN user_id VARCHAR(64);
                        END IF;
                    END $$;
                    """
                )
            conn.commit()

        self.purge_expired()
        self.purge_expired_sessions()

    def _connect(self):
        import psycopg
        return psycopg.connect(self.connection_url)

    def _now(self) -> datetime.datetime:
        return datetime.datetime.now(datetime.timezone.utc)

    def save(
        self,
        review: Review,
        delete_token: Optional[str] = None,
        retention_days: int = DEFAULT_RETENTION_DAYS,
        user_id: Optional[str] = None,
    ) -> None:
        now = self._now()
        expires = now + datetime.timedelta(days=retention_days)
        tok_hash = hashlib.sha256(delete_token.encode("utf-8")).hexdigest() if delete_token else None
        target_uid = user_id if user_id is not None else review.user_id
        review.user_id = target_uid
        body = review.model_dump_json()

        with self._lock, self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO reviews (id, body, created_at, expires_at, delete_token_hash, user_id)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        body = EXCLUDED.body,
                        expires_at = EXCLUDED.expires_at,
                        delete_token_hash = EXCLUDED.delete_token_hash,
                        user_id = COALESCE(EXCLUDED.user_id, reviews.user_id)
                    """,
                    (review.id, body, now, expires, tok_hash, target_uid),
                )
            conn.commit()

    def get(self, review_id: str) -> Optional[Review]:
        now = self._now()
        with self._lock, self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT body, expires_at, user_id FROM reviews WHERE id = %s", (review_id,)
                )
                row = cur.fetchone()
                if not row:
                    return None
                body, expires_at, user_id = row[0], row[1], row[2]
                if expires_at and expires_at < now:
                    cur.execute("DELETE FROM reviews WHERE id = %s", (review_id,))
                    conn.commit()
                    return None

        review = Review.model_validate_json(body)
        review.user_id = user_id
        return review

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

    def create_user(self, user_id: str, email: str, password_hash: str) -> dict:
        now = self._now()
        clean_email = email.strip().lower()
        with self._lock, self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO users (id, email, password_hash, created_at) VALUES (%s, %s, %s, %s)",
                    (user_id, clean_email, password_hash, now),
                )
            conn.commit()
        return {"id": user_id, "email": clean_email, "created_at": now.isoformat()}

    def get_user_by_email(self, email: str) -> Optional[dict]:
        clean_email = email.strip().lower()
        with self._lock, self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, email, password_hash, created_at FROM users WHERE email = %s",
                    (clean_email,),
                )
                row = cur.fetchone()
                if not row:
                    return None
                return {"id": row[0], "email": row[1], "password_hash": row[2], "created_at": str(row[3])}

    def get_user_by_id(self, user_id: str) -> Optional[dict]:
        with self._lock, self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, email, password_hash, created_at FROM users WHERE id = %s",
                    (user_id,),
                )
                row = cur.fetchone()
                if not row:
                    return None
                return {"id": row[0], "email": row[1], "password_hash": row[2], "created_at": str(row[3])}

    def create_session(self, id_hash: str, user_id: str, expires_at: datetime.datetime) -> None:
        now = self._now()
        with self._lock, self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO sessions (id_hash, user_id, expires_at, created_at) VALUES (%s, %s, %s, %s)",
                    (id_hash, user_id, expires_at, now),
                )
            conn.commit()

    def get_session(self, id_hash: str) -> Optional[dict]:
        now = self._now()
        with self._lock, self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT s.id_hash, s.user_id, s.expires_at, s.created_at, u.email
                    FROM sessions s
                    JOIN users u ON s.user_id = u.id
                    WHERE s.id_hash = %s
                    """,
                    (id_hash,),
                )
                row = cur.fetchone()
                if not row:
                    return None
                id_h, uid, exp, cr, email = row
                if exp and exp < now:
                    cur.execute("DELETE FROM sessions WHERE id_hash = %s", (id_hash,))
                    conn.commit()
                    return None
                return {
                    "id_hash": id_h,
                    "user_id": uid,
                    "expires_at": exp.isoformat() if hasattr(exp, "isoformat") else str(exp),
                    "created_at": cr.isoformat() if hasattr(cr, "isoformat") else str(cr),
                    "user": {
                        "id": uid,
                        "email": email,
                        "created_at": cr.isoformat() if hasattr(cr, "isoformat") else str(cr),
                    },
                }

    def delete_session(self, id_hash: str) -> None:
        with self._lock, self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM sessions WHERE id_hash = %s", (id_hash,))
            conn.commit()

    def purge_expired_sessions(self) -> int:
        now = self._now()
        with self._lock, self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM sessions WHERE expires_at < %s", (now,))
                cnt = cur.rowcount
            conn.commit()
            return cnt

    def get_anon_usage(self, anon_id: str) -> int:
        with self._lock, self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT checks_used FROM anon_usage WHERE anon_id = %s", (anon_id,))
                row = cur.fetchone()
                return row[0] if row else 0

    def get_ip_usage(self, ip_hash: str) -> int:
        # Clearing cookies is a known bypass; the IP counter only slows it down.
        with self._lock, self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT SUM(checks_used) FROM anon_usage WHERE ip_hash = %s", (ip_hash,))
                row = cur.fetchone()
                return int(row[0]) if row and row[0] is not None else 0

    def increment_anon_usage(self, anon_id: str, ip_hash: str) -> int:
        now = self._now()
        with self._lock, self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO anon_usage (anon_id, checks_used, ip_hash, created_at)
                    VALUES (%s, 1, %s, %s)
                    ON CONFLICT (anon_id) DO UPDATE SET
                        checks_used = anon_usage.checks_used + 1,
                        ip_hash = EXCLUDED.ip_hash
                    RETURNING checks_used
                    """,
                    (anon_id, ip_hash, now),
                )
                row = cur.fetchone()
                count = row[0] if row else 1
            conn.commit()
            return count

    def attach_reviews_to_user(self, user_id: str, review_ids: list[str]) -> int:
        if not review_ids:
            return 0
        updated = 0
        with self._lock, self._connect() as conn:
            with conn.cursor() as cur:
                for rid in review_ids:
                    cur.execute(
                        "UPDATE reviews SET user_id = %s WHERE id = %s AND (user_id IS NULL OR user_id = '')",
                        (user_id, rid),
                    )
                    if cur.rowcount > 0:
                        updated += cur.rowcount
            conn.commit()
        return updated

    def get_user_reviews(self, user_id: str) -> list[Review]:
        now = self._now()
        reviews = []
        with self._lock, self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT body, expires_at, user_id FROM reviews WHERE user_id = %s ORDER BY created_at DESC",
                    (user_id,),
                )
                rows = cur.fetchall()
                for row in rows:
                    body, expires_at, uid = row[0], row[1], row[2]
                    if expires_at and expires_at < now:
                        continue
                    try:
                        r = Review.model_validate_json(body)
                        r.user_id = uid
                        reviews.append(r)
                    except Exception:
                        pass
        return reviews

    def save_revision(
        self,
        review_id: str,
        claim_text: str,
        evidence_text: str,
        verdict: dict,
        confidence_map: Optional[dict] = None,
        sources: Optional[list[dict]] = None,
        suggested_rewrite: Optional[str] = None,
        reverified_status: Optional[str] = None,
        reviewer_id: Optional[str] = None,
        reviewer_action: str = "automated_check",
        notes: str = "",
    ) -> dict:
        rev_id = uuid.uuid4().hex
        now_iso = self._now().isoformat()
        with self._lock, self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    CREATE TABLE IF NOT EXISTS revisions (
                        id TEXT PRIMARY KEY,
                        review_id TEXT NOT NULL,
                        version INTEGER NOT NULL,
                        claim_text TEXT NOT NULL,
                        evidence_text TEXT NOT NULL,
                        sources_json TEXT,
                        verdict_json TEXT NOT NULL,
                        confidence_map_json TEXT,
                        suggested_rewrite TEXT,
                        reverified_status TEXT,
                        reviewer_id TEXT,
                        reviewer_action TEXT DEFAULT 'automated_check',
                        notes TEXT,
                        created_at TIMESTAMP NOT NULL
                    )
                    """
                )
                cur.execute("SELECT MAX(version) FROM revisions WHERE review_id = %s", (review_id,))
                row = cur.fetchone()
                cur_version = row[0] if row and row[0] is not None else 0
                new_version = cur_version + 1

                cur.execute(
                    """
                    INSERT INTO revisions (
                        id, review_id, version, claim_text, evidence_text, sources_json,
                        verdict_json, confidence_map_json, suggested_rewrite, reverified_status,
                        reviewer_id, reviewer_action, notes, created_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        rev_id,
                        review_id,
                        new_version,
                        claim_text,
                        evidence_text,
                        json.dumps(sources or []),
                        json.dumps(verdict),
                        json.dumps(confidence_map or {}),
                        suggested_rewrite,
                        reverified_status,
                        reviewer_id,
                        reviewer_action,
                        notes,
                        now_iso,
                    ),
                )
            conn.commit()

        return {
            "id": rev_id,
            "review_id": review_id,
            "version": new_version,
            "claim_text": claim_text,
            "evidence_text": evidence_text,
            "sources": sources or [],
            "verdict": verdict,
            "confidence_map": confidence_map or {},
            "suggested_rewrite": suggested_rewrite,
            "reverified_status": reverified_status,
            "reviewer_id": reviewer_id,
            "reviewer_action": reviewer_action,
            "notes": notes,
            "created_at": now_iso,
        }

    def get_revisions(self, review_id: str, user_id: Optional[str] = None) -> list[dict]:
        with self._lock, self._connect() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT user_id FROM reviews WHERE id = %s", (review_id,))
                rev_row = cur.fetchone()
                if not rev_row:
                    return []
                owner_id = rev_row[0]
                if user_id and owner_id and owner_id != user_id:
                    return []

                cur.execute(
                    """
                    SELECT id, review_id, version, claim_text, evidence_text, sources_json,
                           verdict_json, confidence_map_json, suggested_rewrite, reverified_status,
                           reviewer_id, reviewer_action, notes, created_at
                    FROM revisions WHERE review_id = %s ORDER BY version ASC
                    """,
                    (review_id,),
                )
                rows = cur.fetchall()

        out = []
        for r in rows:
            out.append(
                {
                    "id": r[0],
                    "review_id": r[1],
                    "version": r[2],
                    "claim_text": r[3],
                    "evidence_text": r[4],
                    "sources": json.loads(r[5] or "[]"),
                    "verdict": json.loads(r[6] or "{}"),
                    "confidence_map": json.loads(r[7] or "{}"),
                    "suggested_rewrite": r[8],
                    "reverified_status": r[9],
                    "reviewer_id": r[10],
                    "reviewer_action": r[11],
                    "notes": r[12],
                    "created_at": str(r[13]),
                }
            )
        return out

    def record_decision(
        self, review_id: str, user_id: str, decision: str, notes: str = ""
    ) -> dict:
        revisions = self.get_revisions(review_id, user_id)
        if not revisions:
            review = self.get(review_id)
            if not review:
                raise ValueError("Review not found or unauthorized.")
            return self.save_revision(
                review_id=review_id,
                claim_text=review.claim,
                evidence_text=review.evidence,
                verdict=review.verdict.model_dump(),
                confidence_map=None,
                suggested_rewrite=review.rewrite.text if review.rewrite else None,
                reviewer_id=user_id,
                reviewer_action=decision,
                notes=notes,
            )

        latest = revisions[-1]
        return self.save_revision(
            review_id=review_id,
            claim_text=latest["claim_text"],
            evidence_text=latest["evidence_text"],
            verdict=latest["verdict"],
            confidence_map=latest.get("confidence_map"),
            sources=latest.get("sources"),
            suggested_rewrite=latest.get("suggested_rewrite"),
            reverified_status=latest.get("reverified_status"),
            reviewer_id=user_id,
            reviewer_action=decision,
            notes=notes,
        )


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
