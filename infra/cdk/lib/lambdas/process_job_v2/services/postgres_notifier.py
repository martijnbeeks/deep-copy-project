"""
PostgreSQL job status notifier.

Updates the frontend PostgreSQL database directly when a job completes or fails,
eliminating the need for client-side polling as the primary sync mechanism.

Uses pg8000 (already a dependency for PromptService) with the same DATABASE_URL.
"""

import json
import logging
from typing import Optional
from urllib.parse import urlparse, parse_qs

ALLOWED_CALLBACK_PATH = "/api/webhooks/job-complete"

import pg8000.native

logger = logging.getLogger(__name__)


def _parse_database_url(database_url: str) -> dict:
    """Parse a PostgreSQL connection URL into pg8000 connection parameters."""
    parsed = urlparse(database_url)
    params = {
        "user": parsed.username or "postgres",
        "password": parsed.password or "",
        "host": parsed.hostname or "localhost",
        "port": parsed.port or 5432,
        "database": (parsed.path or "/postgres").lstrip("/"),
    }

    query_params = parse_qs(parsed.query)
    sslmode = query_params.get("sslmode", [None])[0]
    if sslmode and sslmode != "disable":
        import ssl
        ssl_context = ssl.create_default_context()
        params["ssl_context"] = ssl_context

    return params


class PostgresNotifier:
    """
    Notifies the frontend PostgreSQL database of job status changes.

    Called by the orchestrator when a job succeeds or fails, so the
    dashboard reflects the correct state without requiring polling.
    """

    def __init__(self, database_url: str):
        self._conn_params = _parse_database_url(database_url)

    def _connect(self) -> pg8000.native.Connection:
        ssl_context = self._conn_params.pop("ssl_context", None)
        try:
            return pg8000.native.Connection(
                **self._conn_params,
                ssl_context=ssl_context,
            )
        finally:
            # Restore ssl_context so the params dict stays reusable
            if ssl_context is not None:
                self._conn_params["ssl_context"] = ssl_context

    def update_job_status(
        self,
        job_id: str,
        status: str,
        progress: int = 0,
    ) -> None:
        """
        Update the job status and progress in PostgreSQL.

        Args:
            job_id: The job UUID (same as the DeepCopy job ID).
            status: Lowercase status string (e.g. 'completed', 'failed', 'processing').
            progress: Progress percentage (0-100).
        """
        conn = None
        try:
            conn = self._connect()
            conn.run(
                "UPDATE jobs SET status = :status, progress = :progress, "
                "updated_at = NOW() WHERE id = :job_id",
                status=status,
                progress=progress,
                job_id=job_id,
            )
            logger.info(
                "PostgreSQL job %s updated: status=%s progress=%d",
                job_id, status, progress,
            )
        except Exception as e:
            # Non-fatal: DynamoDB is the source of truth, PostgreSQL is a convenience sync.
            # Polling will catch up if this fails.
            logger.warning("Failed to update PostgreSQL for job %s: %s", job_id, e)
        finally:
            if conn is not None:
                try:
                    conn.close()
                except Exception:
                    pass

    def notify_completed(self, job_id: str) -> None:
        """Mark a job as completed with 100% progress."""
        self.update_job_status(job_id, "completed", 100)

    def notify_failed(self, job_id: str) -> None:
        """Mark a job as failed."""
        self.update_job_status(job_id, "failed", 0)

    def notify_running(self, job_id: str) -> None:
        """Mark a job as processing (running)."""
        self.update_job_status(job_id, "processing", 50)

    def send_callback(
        self,
        callback_url: str,
        job_id: str,
        status: str,
        webhook_secret: str,
    ) -> None:
        """
        Send an HTTP callback to the frontend webhook endpoint.

        This triggers result processing (fetching results from S3 and storing
        them in PostgreSQL) which the Lambda can't do directly.

        Args:
            callback_url: The webhook URL to call.
            job_id: The job UUID.
            status: The job status (e.g. 'completed', 'failed').
            webhook_secret: Shared secret for HMAC authentication.
        """
        import hashlib
        import hmac
        import urllib.request

        try:
            parsed = urlparse(callback_url)
            if parsed.scheme != "https" or parsed.path != ALLOWED_CALLBACK_PATH:
                logger.warning(
                    "Callback URL rejected (scheme=%s path=%s): %s",
                    parsed.scheme, parsed.path, callback_url,
                )
                return

            payload = json.dumps({
                "jobId": job_id,
                "status": status,
            }).encode("utf-8")

            signature = hmac.new(
                webhook_secret.encode("utf-8"),
                payload,
                hashlib.sha256,
            ).hexdigest()

            req = urllib.request.Request(
                callback_url,
                data=payload,
                headers={
                    "Content-Type": "application/json",
                    "X-Webhook-Signature": signature,
                },
                method="POST",
            )

            with urllib.request.urlopen(req, timeout=10) as resp:
                logger.info(
                    "Callback sent to %s for job %s: HTTP %d",
                    callback_url, job_id, resp.status,
                )

        except Exception as e:
            # Non-fatal: the PostgreSQL status update already happened,
            # and polling will pick up result processing if the callback fails.
            logger.warning(
                "Callback to %s failed for job %s: %s",
                callback_url, job_id, e,
            )
